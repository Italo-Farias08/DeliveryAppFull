const { pool } = require('../../config/db');
const AppError = require('../../utils/AppError');
const { toClient, toTenant, toDeliverers } = require('../../realtime/socket');
const { sendPushToUser, sendPushToTenant } = require('../../utils/push');

// Endereço da loja (pra ir buscar o pedido) vem separado do endereço do
// cliente (pra ir entregar), com prefixo "restaurant" — os dois podem
// aparecer juntos no mesmo pedido, então não dá pra usar os mesmos nomes.
const MINE_SELECT = `
  SELECT o.id, o.status, o.total, o.delivery_fee AS "deliveryFee", o.created_at AS "createdAt",
         o.ready_at AS "readyAt", o.picked_up_at AS "pickedUpAt", o.delivered_at AS "deliveredAt",
         r.name AS "restaurantName",
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
            r.name AS "restaurantName",
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
    `SELECT id, delivery_code AS "deliveryCode", status, tenant_id AS "tenantId", client_id AS "clientId"
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

  const result = await pool.query(
    `UPDATE orders SET status = 'entregue', delivered_at = now()
     WHERE id = $1
     RETURNING id, status`,
    [orderId]
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

module.exports = { setAvailability, listAvailable, listMine, acceptOrder, confirmPickup, confirmDelivery };
