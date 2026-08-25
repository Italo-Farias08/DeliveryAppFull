const { pool } = require('../../config/db');
const AppError = require('../../utils/AppError');
const { toClient, toTenant, toDeliverers } = require('../../realtime/socket');
const { sendPushToUser, sendPushToTenant } = require('../../utils/push');
const { COMMISSION_RATE, calculateCommission } = require('../../utils/commission');

// Endereço da loja (pra ir buscar o pedido) vem separado do endereço do
// cliente (pra ir entregar), com prefixo "restaurant" — os dois podem
// aparecer juntos no mesmo pedido, então não dá pra usar os mesmos nomes.
const MINE_SELECT = `
  SELECT o.id, o.status, o.total, o.delivery_fee AS "deliveryFee", o.created_at AS "createdAt",
         o.ready_at AS "readyAt", o.picked_up_at AS "pickedUpAt", o.delivered_at AS "deliveredAt",
         o.payment_timing AS "paymentTiming", o.payment_method AS "paymentMethod", o.change_for AS "changeFor",
         r.name AS "restaurantName", r.image AS "restaurantImage",
         r.street AS "restaurantStreet", r.number AS "restaurantNumber",
         r.neighborhood AS "restaurantNeighborhood", r.city AS "restaurantCity",
         r.lat AS "restaurantLat", r.lng AS "restaurantLng",
         a.street, a.number, a.neighborhood, a.city
  FROM orders o
  JOIN restaurants r ON r.id = o.restaurant_id
  LEFT JOIN addresses a ON a.id = o.address_id
`;

async function setAvailability(userId, isAvailable) {
  const result = await pool.query(
    `UPDATE deliverer_profiles SET is_available = $1 WHERE user_id = $2
     RETURNING is_available AS "isAvailable"`,
    [isAvailable, userId]
  );
  if (result.rowCount === 0) throw new AppError('Perfil de entregador não encontrado', 404);
  return result.rows[0];
}

// Radar: pedidos prontos, buscando entregador e ainda sem ninguém designado
async function listAvailable() {
  const result = await pool.query(
    `SELECT o.id, o.total, o.delivery_fee AS "deliveryFee", o.created_at AS "createdAt", o.ready_at AS "readyAt",
            o.payment_timing AS "paymentTiming", o.payment_method AS "paymentMethod", o.change_for AS "changeFor",
            r.name AS "restaurantName", r.image AS "restaurantImage",
            r.street AS "restaurantStreet", r.number AS "restaurantNumber",
            r.neighborhood AS "restaurantNeighborhood", r.city AS "restaurantCity",
            r.lat AS "restaurantLat", r.lng AS "restaurantLng",
            a.street, a.number, a.neighborhood, a.city
     FROM orders o
     JOIN restaurants r ON r.id = o.restaurant_id
     LEFT JOIN addresses a ON a.id = o.address_id
     WHERE o.status = 'procurando_entregador' AND o.deliverer_id IS NULL
     ORDER BY o.ready_at ASC NULLS LAST, o.created_at ASC`
  );
  return result.rows;
}

async function listMine(delivererId) {
  const result = await pool.query(
    `${MINE_SELECT}
     WHERE o.deliverer_id = $1
     ORDER BY o.created_at DESC`,
    [delivererId]
  );
  return result.rows;
}

// Entregador aceita a corrida — some do radar dos outros entregadores
async function acceptOrder(delivererId, orderId) {
  const result = await pool.query(
    `UPDATE orders SET deliverer_id = $1
     WHERE id = $2 AND status = 'procurando_entregador' AND deliverer_id IS NULL
     RETURNING id, status, tenant_id AS "tenantId", client_id AS "clientId"`,
    [delivererId, orderId]
  );
  if (result.rowCount === 0) throw new AppError('Pedido indisponível — já foi aceito por outro entregador', 409);
  const order = result.rows[0];

  toDeliverers('order:taken', { id: order.id });
  toTenant(order.tenantId, 'order:courierAssigned', { id: order.id });
  toClient(order.clientId, 'order:status', { id: order.id, status: order.status });
  sendPushToTenant(order.tenantId, {
    title: 'Entregador designado 🛵',
    body: 'Um entregador aceitou a corrida e vai buscar o pedido.',
    data: { orderId: order.id, type: 'order:courierAssigned' },
  });
  sendPushToUser(order.clientId, {
    title: 'Entregador a caminho do restaurante 🛵',
    body: 'Já achamos um entregador pro seu pedido.',
    data: { orderId: order.id, type: 'order:status', status: order.status },
  });

  return { id: order.id, status: order.status };
}

// Entregador informa o código que o restaurante mostrou, confirmando a retirada
async function confirmPickup(delivererId, orderId, code) {
  const orderResult = await pool.query(
    `SELECT id, pickup_code AS "pickupCode", status, tenant_id AS "tenantId", client_id AS "clientId"
     FROM orders WHERE id = $1 AND deliverer_id = $2`,
    [orderId, delivererId]
  );
  if (orderResult.rowCount === 0) throw new AppError('Pedido não encontrado para este entregador', 404);
  const order = orderResult.rows[0];
  if (order.status !== 'procurando_entregador') {
    throw new AppError('Este pedido não está aguardando retirada', 409);
  }
  if (String(code).trim() !== order.pickupCode) {
    throw new AppError('Código de retirada incorreto', 400);
  }

  const result = await pool.query(
    `UPDATE orders SET status = 'a_caminho', picked_up_at = now()
     WHERE id = $1
     RETURNING id, status`,
    [orderId]
  );
  toTenant(order.tenantId, 'order:status', { id: order.id, status: result.rows[0].status });
  toClient(order.clientId, 'order:status', { id: order.id, status: result.rows[0].status });
  sendPushToUser(order.clientId, {
    title: 'Pedido a caminho! 🚴',
    body: 'O entregador retirou seu pedido e já está indo até você.',
    data: { orderId: order.id, type: 'order:status', status: result.rows[0].status },
  });
  return result.rows[0];
}

// Entregador informa o código que o cliente tem, confirmando a entrega final
async function confirmDelivery(delivererId, orderId, code) {
  const orderResult = await pool.query(
    `SELECT id, delivery_code AS "deliveryCode", status, tenant_id AS "tenantId", client_id AS "clientId",
            payment_timing AS "paymentTiming", subtotal
     FROM orders WHERE id = $1 AND deliverer_id = $2`,
    [orderId, delivererId]
  );
  if (orderResult.rowCount === 0) throw new AppError('Pedido não encontrado para este entregador', 404);
  const order = orderResult.rows[0];
  if (order.status !== 'a_caminho') {
    throw new AppError('Este pedido ainda não está a caminho', 409);
  }
  if (String(code).trim() !== order.deliveryCode) {
    throw new AppError('Código de entrega incorreto', 400);
  }

  // Pedido com pagamento na ENTREGA: o entregador/restaurante acabou de
  // receber (em dinheiro, cartão ou Pix) na hora da entrega, então marca
  // como pago agora -- e já trava a comissão devida à plataforma sobre esse
  // pedido, do mesmo jeito que o webhook do Mercado Pago faz pro pagamento
  // online (ver payments.service.js). A diferença é o SENTIDO do dinheiro:
  // aqui é o restaurante que vai dever essa comissão à plataforma no acerto
  // semanal, já que o valor não passou pela conta da plataforma (ver
  // comentário em getPendingCommission, em payments.service.js).
  // Pedido pago pelo app (Mercado Pago) já chega aqui pago, com comissão já
  // travada -- não mexe em nada dele.
  const isOfflinePayment = order.paymentTiming === 'entrega';
  const commissionAmount = isOfflinePayment ? calculateCommission(order.subtotal) : null;

  const result = await pool.query(
    `UPDATE orders SET status = 'entregue', delivered_at = now(),
            payment_status = CASE WHEN payment_timing = 'entrega' THEN 'pago' ELSE payment_status END,
            paid_at = CASE WHEN payment_timing = 'entrega' THEN now() ELSE paid_at END,
            commission_rate = CASE WHEN payment_timing = 'entrega' THEN $2 ELSE commission_rate END,
            commission_amount = CASE WHEN payment_timing = 'entrega' THEN $3 ELSE commission_amount END
     WHERE id = $1
     RETURNING id, status`,
    [orderId, COMMISSION_RATE, commissionAmount]
  );
  toTenant(order.tenantId, 'order:status', { id: order.id, status: result.rows[0].status });
  toClient(order.clientId, 'order:status', { id: order.id, status: result.rows[0].status });
  sendPushToUser(order.clientId, {
    title: 'Pedido entregue! 🎉',
    body: 'Seu pedido foi entregue. Bom apetite!',
    data: { orderId: order.id, type: 'order:status', status: result.rows[0].status },
  });
  return result.rows[0];
}

// Entregador desiste da corrida ANTES de retirar o pedido na loja (ex:
// pneu furou, trânsito impossível). Só funciona nessa janela porque depois
// da retirada o pedido já está fisicamente com ele -- devolver pro radar
// nesse ponto deixaria outro entregador "aceitando" uma comida que não
// está mais no restaurante. Volta pro radar pra qualquer entregador pegar.
async function abandonOrder(delivererId, orderId) {
  const result = await pool.query(
    `UPDATE orders SET deliverer_id = NULL
     WHERE id = $1 AND deliverer_id = $2 AND status = 'procurando_entregador'
     RETURNING id, status, tenant_id AS "tenantId", client_id AS "clientId"`,
    [orderId, delivererId]
  );
  if (result.rowCount === 0) {
    throw new AppError(
      'Não foi possível devolver essa corrida — ela já pode ter sido retirada ou não pertence mais a você.',
      409
    );
  }
  const order = result.rows[0];

  const radarResult = await pool.query(
    `SELECT o.id, o.total, o.delivery_fee AS "deliveryFee", o.created_at AS "createdAt", o.ready_at AS "readyAt",
            r.name AS "restaurantName", r.image AS "restaurantImage",
            r.street AS "restaurantStreet", r.number AS "restaurantNumber",
            r.neighborhood AS "restaurantNeighborhood", r.city AS "restaurantCity",
            r.lat AS "restaurantLat", r.lng AS "restaurantLng",
            a.street, a.number, a.neighborhood, a.city
     FROM orders o
     JOIN restaurants r ON r.id = o.restaurant_id
     LEFT JOIN addresses a ON a.id = o.address_id
     WHERE o.id = $1`,
    [orderId]
  );

  toDeliverers('order:available', radarResult.rows[0]);
  toTenant(order.tenantId, 'order:courierAssigned', { id: order.id, status: order.status, delivererId: null });
  toClient(order.clientId, 'order:status', { id: order.id, status: order.status });
  sendPushToTenant(order.tenantId, {
    title: 'Procurando novo entregador 🔄',
    body: 'O entregador anterior não pôde seguir com a corrida. Já voltou pro radar de outros entregadores.',
    data: { orderId: order.id, type: 'order:courierAssigned' },
  });

  return { id: order.id, status: order.status };
}

// Perfil de vínculo do entregador (usado pra mostrar na tela se ele já
// está vinculado a algum restaurante, e a qual).
async function getProfile(userId) {
  const result = await pool.query(
    `SELECT dp.tenant_id AS "tenantId", t.name AS "tenantName"
     FROM deliverer_profiles dp
     LEFT JOIN tenants t ON t.id = dp.tenant_id
     WHERE dp.user_id = $1`,
    [userId]
  );
  if (result.rowCount === 0) throw new AppError('Perfil de entregador não encontrado', 404);
  return result.rows[0];
}

// Vincula (ou troca) o restaurante do entregador usando o código de
// convite -- igual à validação que já existia no cadastro, só que agora
// pode ser chamada a qualquer momento, não só na criação da conta.
async function linkToRestaurant(userId, inviteCode) {
  const tenantResult = await pool.query('SELECT id, name FROM tenants WHERE deliverer_invite_code = $1', [
    inviteCode.toUpperCase(),
  ]);
  if (tenantResult.rowCount === 0) {
    throw new AppError('Código do restaurante inválido — confira com o restaurante e tente de novo', 400);
  }
  const tenant = tenantResult.rows[0];
  const result = await pool.query(
    `UPDATE deliverer_profiles SET tenant_id = $1 WHERE user_id = $2 RETURNING tenant_id AS "tenantId"`,
    [tenant.id, userId]
  );
  if (result.rowCount === 0) throw new AppError('Perfil de entregador não encontrado', 404);
  return { tenantId: tenant.id, tenantName: tenant.name };
}

// Desvincula, voltando o entregador a ser autônomo (radar público).
async function unlinkFromRestaurant(userId) {
  const result = await pool.query(
    `UPDATE deliverer_profiles SET tenant_id = NULL WHERE user_id = $1 RETURNING tenant_id AS "tenantId"`,
    [userId]
  );
  if (result.rowCount === 0) throw new AppError('Perfil de entregador não encontrado', 404);
  return { tenantId: null };
}

module.exports = {
  setAvailability,
  listAvailable,
  listMine,
  acceptOrder,
  confirmPickup,
  confirmDelivery,
  abandonOrder,
  getProfile,
  linkToRestaurant,
  unlinkFromRestaurant,
};