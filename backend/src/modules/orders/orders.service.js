const { pool } = require('../../config/db');
const AppError = require('../../utils/AppError');
const { generateFourDigitCode } = require('../../utils/codes');
const { toTenant } = require('../../realtime/socket');
const { sendPushToTenant } = require('../../utils/push');
const { OFFLINE_PAYMENT_METHODS } = require('./orders.schema');

const ORDER_SELECT = `
  SELECT o.id, o.status, o.subtotal, o.delivery_fee AS "deliveryFee", o.total,
         o.delivery_code AS "deliveryCode",
         o.payment_status AS "paymentStatus", o.payment_method AS "paymentMethod",
         o.payment_timing AS "paymentTiming", o.change_for AS "changeFor", o.paid_at AS "paidAt",
         o.created_at AS "createdAt", o.accepted_at AS "acceptedAt", o.ready_at AS "readyAt",
         o.picked_up_at AS "pickedUpAt", o.delivered_at AS "deliveredAt", o.cancelled_at AS "cancelledAt",
         o.cancel_reason AS "cancelReason",
         r.id AS "restaurantId", r.name AS "restaurantName", r.image AS "restaurantImage",
         d.name AS "delivererName", d.phone AS "delivererPhone",
         orat.rating AS "myRating", orat.comment AS "myRatingComment"
  FROM orders o
  JOIN restaurants r ON r.id = o.restaurant_id
  LEFT JOIN users d ON d.id = o.deliverer_id
  LEFT JOIN order_ratings orat ON orat.order_id = o.id
`;

async function createOrder(clientId, data) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const restaurantResult = await client.query(
      'SELECT id, tenant_id, delivery_fee, min_order_value, restaurant_open_now(id) AS is_open_now FROM restaurants WHERE id = $1',
      [data.restaurantId]
    );
    if (restaurantResult.rowCount === 0) throw new AppError('Restaurante não encontrado', 404);
    const restaurant = restaurantResult.rows[0];
    if (!restaurant.is_open_now) throw new AppError('Restaurante fechado no momento', 400);

    const menuItemIds = data.items.map((i) => i.menuItemId);
    const menuItemsResult = await client.query(
      `SELECT id, name, price, restaurant_id FROM menu_items WHERE id = ANY($1::uuid[])`,
      [menuItemIds]
    );
    if (menuItemsResult.rowCount !== menuItemIds.length) {
      throw new AppError('Um ou mais itens do cardápio são inválidos', 400);
    }
    const menuItemsById = Object.fromEntries(menuItemsResult.rows.map((m) => [m.id, m]));
    for (const item of data.items) {
      const menuItem = menuItemsById[item.menuItemId];
      if (menuItem.restaurant_id !== data.restaurantId) {
        throw new AppError('Itens de cardápio pertencem a restaurantes diferentes', 400);
      }
    }

    // Adicionais escolhidos (ex: bacon extra) — busca todos de uma vez e
    // confere que cada um realmente pertence ao item do cardápio ao qual
    // foi vinculado no pedido, pra ninguém forjar um adicional de outro item.
    const allAddonIds = [...new Set(data.items.flatMap((i) => i.addonIds || []))];
    let addonsById = {};
    if (allAddonIds.length > 0) {
      const addonsResult = await client.query(
        `SELECT id, menu_item_id, name, price, is_available FROM menu_item_addons WHERE id = ANY($1::uuid[])`,
        [allAddonIds]
      );
      if (addonsResult.rowCount !== allAddonIds.length) {
        throw new AppError('Um ou mais adicionais são inválidos', 400);
      }
      addonsById = Object.fromEntries(addonsResult.rows.map((a) => [a.id, a]));
      for (const item of data.items) {
        for (const addonId of item.addonIds || []) {
          const addon = addonsById[addonId];
          if (addon.menu_item_id !== item.menuItemId) {
            throw new AppError('Um adicional não pertence ao item selecionado', 400);
          }
          if (!addon.is_available) {
            throw new AppError(`Adicional "${addon.name}" não está mais disponível`, 400);
          }
        }
      }
    }

    if (data.addressId) {
      const addressResult = await client.query(
        'SELECT id FROM addresses WHERE id = $1 AND user_id = $2',
        [data.addressId, clientId]
      );
      if (addressResult.rowCount === 0) throw new AppError('Endereço inválido', 400);
    }

    // Preço unitário de cada item já soma o preço dos adicionais escolhidos
    // (ex: item R$ 20 + bacon R$ 4 + borda R$ 6 = R$ 30 por unidade).
    function unitPrice(item) {
      const menuItem = menuItemsById[item.menuItemId];
      const addonsTotal = (item.addonIds || []).reduce((s, id) => s + Number(addonsById[id].price), 0);
      return Number(menuItem.price) + addonsTotal;
    }

    const subtotal = data.items.reduce((sum, item) => sum + unitPrice(item) * item.qty, 0);
    const minOrderValue = Number(restaurant.min_order_value || 0);
    if (minOrderValue > 0 && subtotal < minOrderValue) {
      throw new AppError(
        `Pedido mínimo deste restaurante é de R$ ${minOrderValue.toFixed(2)}. Adicione mais itens para continuar.`,
        400
      );
    }
    const deliveryFee = Number(restaurant.delivery_fee);
    const total = subtotal + deliveryFee;

    // 'pix_app' é pago dentro do app (Mercado Pago) -- o pedido só some da
    // fila do restaurante quando confirmado pelo webhook, como já era.
    // As demais formas são cobradas na ENTREGA pelo entregador/restaurante,
    // então o restaurante já pode ver e preparar o pedido na hora.
    const isOfflinePayment = OFFLINE_PAYMENT_METHODS.includes(data.paymentMethod);
    const paymentTiming = isOfflinePayment ? 'entrega' : 'online';
    // payment_method só é gravado já na criação pra formas de pagamento na
    // entrega -- pro Pix no app, quem grava é o webhook do Mercado Pago
    // (que sabe de verdade qual método o cliente usou lá).
    const paymentMethod = isOfflinePayment ? data.paymentMethod : null;

    if (data.changeFor != null && data.changeFor < total) {
      throw new AppError(
        `O valor para troco (R$ ${data.changeFor.toFixed(2)}) não pode ser menor que o total do pedido (R$ ${total.toFixed(2)})`,
        400
      );
    }

    const pickupCode = generateFourDigitCode();
    const deliveryCode = generateFourDigitCode();

    const orderResult = await client.query(
      `INSERT INTO orders (tenant_id, restaurant_id, client_id, address_id, status, pickup_code, delivery_code,
                            subtotal, delivery_fee, total, payment_timing, payment_method, change_for)
       VALUES ($1, $2, $3, $4, 'pendente', $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id`,
      [
        restaurant.tenant_id,
        data.restaurantId,
        clientId,
        data.addressId || null,
        pickupCode,
        deliveryCode,
        subtotal,
        deliveryFee,
        total,
        paymentTiming,
        paymentMethod,
        data.paymentMethod === 'dinheiro' ? data.changeFor ?? null : null,
      ]
    );
    const orderId = orderResult.rows[0].id;

    for (const item of data.items) {
      const menuItem = menuItemsById[item.menuItemId];
      const chosenAddons = (item.addonIds || []).map((id) => addonsById[id]);
      // Adicionais e observação ficam em colunas próprias (em vez de
      // grudados no nome do item), pra dar pra mostrar cada informação
      // separada na tela do restaurante.
      const addonsSnapshot = JSON.stringify(
        chosenAddons.map((a) => ({ name: a.name, price: Number(a.price) }))
      );
      await client.query(
        `INSERT INTO order_items (order_id, menu_item_id, name_snapshot, price_snapshot, qty, notes, addons_snapshot)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [orderId, menuItem.id, menuItem.name, unitPrice(item), item.qty, item.notes || null, addonsSnapshot]
      );
    }

    await client.query('COMMIT');
    const order = await getOrderById(orderId, clientId);

    // IMPORTANTE: pra pagamento 'pix_app', o restaurante só é avisado do
    // pedido depois que o pagamento for confirmado (ver payments.service.js
    // -> notifyOrderPaid, chamado pelo webhook do Mercado Pago). Antes disso
    // o pedido fica "pendente" com payment_status "pendente" e não aparece
    // na fila dele.
    //
    // Já pra pagamento na ENTREGA (dinheiro, cartão ou Pix cobrado pelo
    // entregador), não existe confirmação online nenhuma pra esperar -- o
    // restaurante precisa ver e começar a preparar o pedido na hora.
    if (paymentTiming === 'entrega') {
      await notifyRestaurantOfOfflineOrder(orderId, restaurant.tenant_id);
    }

    return order;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Monta o pedido no formato que o painel do restaurante espera (mesmo
// formato usado em payments.service.js -> notifyOrderPaid) e avisa em
// tempo real + push -- usado só pra pedidos com pagamento na ENTREGA, que
// não passam pelo webhook do Mercado Pago.
async function notifyRestaurantOfOfflineOrder(orderId, tenantId) {
  const result = await pool.query(
    `SELECT o.id, o.tenant_id AS "tenantId", o.client_id AS "clientId", o.status, o.subtotal,
            o.delivery_fee AS "deliveryFee", o.total, o.pickup_code AS "pickupCode", o.created_at AS "createdAt",
            o.payment_status AS "paymentStatus", o.payment_method AS "paymentMethod", o.change_for AS "changeFor",
            c.name AS "clientName", c.phone AS "clientPhone",
            a.street, a.number, a.complement, a.neighborhood, a.city, a.state, a.lat, a.lng
     FROM orders o
     JOIN users c ON c.id = o.client_id
     LEFT JOIN addresses a ON a.id = o.address_id
     WHERE o.id = $1`,
    [orderId]
  );
  if (result.rowCount === 0) return;
  const order = result.rows[0];

  const itemsResult = await pool.query(
    `SELECT order_id AS "orderId", id, name_snapshot AS name, price_snapshot AS price, qty, notes,
            addons_snapshot AS addons
     FROM order_items WHERE order_id = $1`,
    [orderId]
  );

  const tenantOrder = { ...order, items: itemsResult.rows };
  toTenant(tenantId, 'order:new', tenantOrder);

  const paymentLabel = {
    dinheiro: 'em dinheiro',
    cartao_credito: 'no cartão de crédito',
    cartao_debito: 'no cartão de débito',
    pix_entrega: 'no Pix',
  }[order.paymentMethod];
  sendPushToTenant(tenantId, {
    title: 'Novo pedido! 🛎️',
    body: `${order.clientName} fez um pedido para pagar na entrega${paymentLabel ? ` (${paymentLabel})` : ''}.`,
    data: { orderId: order.id, type: 'order:new' },
  });
}

async function listOrdersByClient(clientId, { limit = 20, offset = 0 } = {}) {
  // Paginado: sem LIMIT aqui, clientes com muitos pedidos acumulados
  // fariam essa tela buscar o histórico inteiro (e a query de itens
  // logo abaixo) toda vez que a tela de pedidos abre.
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const safeOffset = Math.max(Number(offset) || 0, 0);

  const result = await pool.query(
    `${ORDER_SELECT}
     WHERE o.client_id = $1
     ORDER BY o.created_at DESC
     LIMIT $2 OFFSET $3`,
    [clientId, safeLimit, safeOffset]
  );
  const orders = result.rows;
  if (orders.length === 0) return orders;
  const itemsResult = await pool.query(
    `SELECT order_id AS "orderId", id, name_snapshot AS name, price_snapshot AS price, qty,
            notes, addons_snapshot AS addons
     FROM order_items
     WHERE order_id = ANY($1::uuid[])`,
    [orders.map((o) => o.id)]
  );
  const itemsByOrder = {};
  for (const item of itemsResult.rows) {
    (itemsByOrder[item.orderId] ||= []).push(item);
  }
  return orders.map((o) => ({ ...o, items: itemsByOrder[o.id] || [] }));
}

// Cliente cancela o próprio pedido — só permitido enquanto o restaurante
// ainda não começou o preparo (status 'pendente'). Depois disso, o pedido
// já está em produção na cozinha e cancelar unilateralmente causaria
// prejuízo/confusão pro restaurante; nesse ponto o cliente deve falar com
// o restaurante pelo chat em vez de cancelar direto.
async function cancelOrder(clientId, orderId, reason) {
  const existing = await pool.query(
    `SELECT id, status, payment_status AS "paymentStatus", mp_payment_id AS "mpPaymentId"
     FROM orders WHERE id = $1 AND client_id = $2`,
    [orderId, clientId]
  );
  if (existing.rowCount === 0) throw new AppError('Pedido não encontrado', 404);
  const existingOrder = existing.rows[0];
  if (existingOrder.status !== 'pendente') {
    throw new AppError(
      'Pedido não encontrado ou não pode mais ser cancelado (o restaurante já começou o preparo)',
      409
    );
  }

  // Se já foi pago, precisa estornar no Mercado Pago ANTES de cancelar --
  // senão o dinheiro fica retido sem o pedido existir mais.
  if (existingOrder.paymentStatus === 'pago' && existingOrder.mpPaymentId) {
    await refundPayment(existingOrder.mpPaymentId);
  }

  const result = await pool.query(
    `UPDATE orders SET status = 'cancelado', cancelled_at = now(), cancel_reason = $1,
            payment_status = CASE WHEN payment_status = 'pago' THEN 'estornado' ELSE payment_status END
     WHERE id = $2 AND client_id = $3 AND status = 'pendente'
     RETURNING id, status, tenant_id AS "tenantId"`,
    [reason || 'Cancelado pelo cliente', orderId, clientId]
  );
  if (result.rowCount === 0) {
    throw new AppError(
      'Pedido não encontrado ou não pode mais ser cancelado (o restaurante já começou o preparo)',
      409
    );
  }
  const order = result.rows[0];
  // avisa o restaurante em tempo real, no mesmo canal que ele já escuta
  // pra mudanças de status de pedido
  toTenant(order.tenantId, 'order:cancelled', { id: order.id, status: order.status, cancelReason: reason });
  sendPushToTenant(order.tenantId, {
    title: 'Pedido cancelado',
    body: 'O cliente cancelou um pedido.',
    data: { orderId: order.id, type: 'order:cancelled' },
  });
  return { id: order.id, status: order.status };
}

// Estorna um pagamento aprovado no Mercado Pago (devolve o dinheiro
// inteiro pro cliente). Usado quando o cliente cancela um pedido que já
// tinha sido pago, antes do restaurante começar o preparo.
async function refundPayment(mpPaymentId) {
  const { PaymentRefund } = require('mercadopago');
  const { mpClient } = require('../../config/mercadopago');
  try {
    const refund = new PaymentRefund(mpClient);
    await refund.create({ payment_id: mpPaymentId });
  } catch (err) {
    throw new AppError(
      'Não foi possível estornar o pagamento automaticamente. Entre em contato com o suporte.',
      502
    );
  }
}

// Cliente avalia o pedido depois de entregue -- só uma vez por pedido
// (o restaurante rating é recalculado automaticamente pelo trigger no
// banco assim que essa avaliação é inserida).
async function rateOrder(clientId, orderId, rating, comment) {
  const orderResult = await pool.query(
    `SELECT id, status, restaurant_id AS "restaurantId" FROM orders WHERE id = $1 AND client_id = $2`,
    [orderId, clientId]
  );
  if (orderResult.rowCount === 0) throw new AppError('Pedido não encontrado', 404);
  const order = orderResult.rows[0];
  if (order.status !== 'entregue') {
    throw new AppError('Só é possível avaliar pedidos já entregues', 409);
  }

  try {
    const result = await pool.query(
      `INSERT INTO order_ratings (order_id, client_id, restaurant_id, rating, comment)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, rating, comment, created_at AS "createdAt"`,
      [orderId, clientId, order.restaurantId, rating, comment || null]
    );
    return result.rows[0];
  } catch (err) {
    if (err.code === '23505') {
      throw new AppError('Você já avaliou esse pedido', 409);
    }
    throw err;
  }
}

async function getOrderById(orderId, clientId) {
  const orderResult = await pool.query(
    `${ORDER_SELECT}
     WHERE o.id = $1 AND o.client_id = $2`,
    [orderId, clientId]
  );
  if (orderResult.rowCount === 0) throw new AppError('Pedido não encontrado', 404);
  const order = orderResult.rows[0];
  const itemsResult = await pool.query(
    `SELECT id, name_snapshot AS name, price_snapshot AS price, qty,
            notes, addons_snapshot AS addons
     FROM order_items
     WHERE order_id = $1`,
    [orderId]
  );
  order.items = itemsResult.rows;
  return order;
}

module.exports = { createOrder, listOrdersByClient, getOrderById, cancelOrder, rateOrder };