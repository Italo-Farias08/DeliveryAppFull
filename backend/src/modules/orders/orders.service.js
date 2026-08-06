const { pool } = require('../../config/db');
const AppError = require('../../utils/AppError');
const { generateFourDigitCode } = require('../../utils/codes');
const { toTenant } = require('../../realtime/socket');

const ORDER_SELECT = `
  SELECT o.id, o.status, o.subtotal, o.delivery_fee AS "deliveryFee", o.total,
         o.delivery_code AS "deliveryCode",
         o.created_at AS "createdAt", o.accepted_at AS "acceptedAt", o.ready_at AS "readyAt",
         o.picked_up_at AS "pickedUpAt", o.delivered_at AS "deliveredAt", o.cancelled_at AS "cancelledAt",
         o.cancel_reason AS "cancelReason",
         r.id AS "restaurantId", r.name AS "restaurantName", r.image AS "restaurantImage",
         d.name AS "delivererName", d.phone AS "delivererPhone"
  FROM orders o
  JOIN restaurants r ON r.id = o.restaurant_id
  LEFT JOIN users d ON d.id = o.deliverer_id
`;

async function createOrder(clientId, data) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const restaurantResult = await client.query(
      'SELECT id, tenant_id, delivery_fee, is_open FROM restaurants WHERE id = $1',
      [data.restaurantId]
    );
    if (restaurantResult.rowCount === 0) throw new AppError('Restaurante não encontrado', 404);
    const restaurant = restaurantResult.rows[0];
    if (!restaurant.is_open) throw new AppError('Restaurante fechado no momento', 400);

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

    if (data.addressId) {
      const addressResult = await client.query(
        'SELECT id FROM addresses WHERE id = $1 AND user_id = $2',
        [data.addressId, clientId]
      );
      if (addressResult.rowCount === 0) throw new AppError('Endereço inválido', 400);
    }

    const subtotal = data.items.reduce((sum, item) => {
      const menuItem = menuItemsById[item.menuItemId];
      return sum + Number(menuItem.price) * item.qty;
    }, 0);
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
      await client.query(
        `INSERT INTO order_items (order_id, menu_item_id, name_snapshot, price_snapshot, qty)
         VALUES ($1, $2, $3, $4, $5)`,
        [orderId, menuItem.id, menuItem.name, menuItem.price, item.qty]
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
    `SELECT order_id AS "orderId", id, name_snapshot AS name, price_snapshot AS price, qty
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

async function getOrderById(orderId, clientId) {
  const orderResult = await pool.query(
    `${ORDER_SELECT}
     WHERE o.id = $1 AND o.client_id = $2`,
    [orderId, clientId]
  );
  if (orderResult.rowCount === 0) throw new AppError('Pedido não encontrado', 404);
  const order = orderResult.rows[0];
  const itemsResult = await pool.query(
    `SELECT id, name_snapshot AS name, price_snapshot AS price, qty
     FROM order_items
     WHERE order_id = $1`,
    [orderId]
  );
  order.items = itemsResult.rows;
  return order;
}

module.exports = { createOrder, listOrdersByClient, getOrderById };