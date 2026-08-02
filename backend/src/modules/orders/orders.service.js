const { pool } = require('../../config/db');
const AppError = require('../../utils/AppError');

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

    const orderResult = await client.query(
      `INSERT INTO orders (tenant_id, restaurant_id, client_id, address_id, subtotal, delivery_fee, total)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, status, subtotal, delivery_fee AS "deliveryFee", total, created_at AS "createdAt"`,
      [restaurant.tenant_id, data.restaurantId, clientId, data.addressId || null, subtotal, deliveryFee, total]
    );
    const order = orderResult.rows[0];

    for (const item of data.items) {
      const menuItem = menuItemsById[item.menuItemId];
      await client.query(
        `INSERT INTO order_items (order_id, menu_item_id, name_snapshot, price_snapshot, qty)
         VALUES ($1, $2, $3, $4, $5)`,
        [order.id, menuItem.id, menuItem.name, menuItem.price, item.qty]
      );
    }

    await client.query('COMMIT');
    return getOrderById(order.id, clientId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function listOrdersByClient(clientId) {
  const result = await pool.query(
    `SELECT o.id, o.status, o.subtotal, o.delivery_fee AS "deliveryFee", o.total, o.created_at AS "createdAt",
            r.name AS "restaurantName"
     FROM orders o
     JOIN restaurants r ON r.id = o.restaurant_id
     WHERE o.client_id = $1
     ORDER BY o.created_at DESC`,
    [clientId]
  );
  return result.rows;
}

async function getOrderById(orderId, clientId) {
  const orderResult = await pool.query(
    `SELECT o.id, o.status, o.subtotal, o.delivery_fee AS "deliveryFee", o.total, o.created_at AS "createdAt",
            r.name AS "restaurantName"
     FROM orders o
     JOIN restaurants r ON r.id = o.restaurant_id
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
