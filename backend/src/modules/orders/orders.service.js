const { pool } = require('../../config/db');
const AppError = require('../../utils/AppError');
const { generateFourDigitCode } = require('../../utils/codes');
const { toTenant } = require('../../realtime/socket');
const { sendPushToTenant } = require('../../utils/push');

const ORDER_SELECT = `
  SELECT o.id, o.status, o.subtotal, o.delivery_fee AS "deliveryFee", o.total,
         o.delivery_code AS "deliveryCode",
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
      'SELECT id, tenant_id, delivery_fee, restaurant_open_now(id) AS is_open_now FROM restaurants WHERE id = $1',
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
    const deliveryFee = Number(restaurant.delivery_fee);
    const total = subtotal + deliveryFee;

    const pickupCode = generateFourDigitCode();
    const deliveryCode = generateFourDigitCode();

    const orderResult = await client.query(
      `INSERT INTO orders (tenant_id, restaurant_id, client_id, address_id, status, pickup_code, delivery_code, subtotal, delivery_fee, total)
       VALUES ($1, $2, $3, $4, 'pendente', $5, $6, $7, $8, $9)
       RETURNING id`,
      [restaurant.tenant_id, data.restaurantId, clientId, data.addressId || null, pickupCode, deliveryCode, subtotal, deliveryFee, total]
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

    // avisa o restaurante em tempo real que um pedido novo chegou pra aceitar
    // (usa o mesmo formato que a tela do restaurante espera, com nome do cliente e endereço)
    const tenantOrderResult = await pool.query(
      `SELECT o.id, o.status, o.subtotal, o.delivery_fee AS "deliveryFee", o.total,
              o.pickup_code AS "pickupCode", o.created_at AS "createdAt",
              c.name AS "clientName", c.phone AS "clientPhone",
              a.street, a.number, a.complement, a.neighborhood, a.city, a.state, a.lat, a.lng
       FROM orders o
       JOIN users c ON c.id = o.client_id
       LEFT JOIN addresses a ON a.id = o.address_id
       WHERE o.id = $1`,
      [orderId]
    );
    const tenantOrder = { ...tenantOrderResult.rows[0], items: order.items };
    toTenant(restaurant.tenant_id, 'order:new', tenantOrder);
    sendPushToTenant(restaurant.tenant_id, {
      title: 'Novo pedido! 🛎️',
      body: `${tenantOrder.clientName} acabou de fazer um pedido.`,
      data: { orderId: order.id, type: 'order:new' },
    });

    return order;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function listOrdersByClient(clientId) {
  const result = await pool.query(
    `${ORDER_SELECT}
     WHERE o.client_id = $1
     ORDER BY o.created_at DESC`,
    [clientId]
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
  const result = await pool.query(
    `UPDATE orders SET status = 'cancelado', cancelled_at = now(), cancel_reason = $1
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