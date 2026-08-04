const AppError = require('../../utils/AppError');
const { pool } = require('../../config/db');
const { toClient, toDeliverers } = require('../../realtime/socket');

const TENANT_ORDER_SELECT = `
  SELECT o.id, o.restaurant_id AS "restaurantId", o.client_id AS "clientId",
         o.deliverer_id AS "delivererId", o.status, o.subtotal, o.delivery_fee AS "deliveryFee",
         o.total, o.pickup_code AS "pickupCode",
         o.created_at AS "createdAt", o.accepted_at AS "acceptedAt", o.ready_at AS "readyAt",
         o.picked_up_at AS "pickedUpAt", o.delivered_at AS "deliveredAt",
         c.name AS "clientName", c.phone AS "clientPhone",
         a.street, a.number, a.complement, a.neighborhood, a.city, a.state,
         a.lat, a.lng,
         d.name AS "delivererName", d.phone AS "delivererPhone"
  FROM orders o
  JOIN users c ON c.id = o.client_id
  LEFT JOIN addresses a ON a.id = o.address_id
  LEFT JOIN users d ON d.id = o.deliverer_id
`;

async function listRestaurants(db) {
  const result = await db.query(
    `SELECT id, category_id AS "categoryId", name, rating, delivery_time_min AS "deliveryTimeMin",
            delivery_time_max AS "deliveryTimeMax", delivery_fee AS "deliveryFee", image, is_open AS "isOpen"
     FROM restaurants
     ORDER BY created_at DESC`
  );
  return result.rows;
}

async function createRestaurant(db, tenantId, data) {
  const result = await db.query(
    `INSERT INTO restaurants (tenant_id, category_id, name, delivery_time_min, delivery_time_max, delivery_fee, image, is_open)
     VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, true))
     RETURNING id, category_id AS "categoryId", name, rating, delivery_time_min AS "deliveryTimeMin",
               delivery_time_max AS "deliveryTimeMax", delivery_fee AS "deliveryFee", image, is_open AS "isOpen"`,
    [tenantId, data.categoryId, data.name, data.deliveryTimeMin, data.deliveryTimeMax, data.deliveryFee, data.image || null, data.isOpen]
  );
  return result.rows[0];
}

async function updateRestaurant(db, restaurantId, data) {
  const result = await db.query(
    `UPDATE restaurants
     SET category_id = $1, name = $2, delivery_time_min = $3, delivery_time_max = $4,
         delivery_fee = $5, image = $6, is_open = COALESCE($7, is_open)
     WHERE id = $8
     RETURNING id, category_id AS "categoryId", name, rating, delivery_time_min AS "deliveryTimeMin",
               delivery_time_max AS "deliveryTimeMax", delivery_fee AS "deliveryFee", image, is_open AS "isOpen"`,
    [data.categoryId, data.name, data.deliveryTimeMin, data.deliveryTimeMax, data.deliveryFee, data.image || null, data.isOpen, restaurantId]
  );
  if (result.rowCount === 0) throw new AppError('Restaurante não encontrado nesta conta', 404);
  return result.rows[0];
}

async function ensureRestaurantOwnedByTenant(db, restaurantId, tenantId) {
  const result = await db.query('SELECT id FROM restaurants WHERE id = $1 AND tenant_id = $2', [restaurantId, tenantId]);
  if (result.rowCount === 0) throw new AppError('Restaurante não encontrado nesta conta', 404);
}

async function listMenuItems(db, restaurantId) {
  const result = await db.query(
    `SELECT id, restaurant_id AS "restaurantId", name, description, price, image, is_available AS "isAvailable"
     FROM menu_items
     WHERE restaurant_id = $1
     ORDER BY created_at DESC`,
    [restaurantId]
  );
  return result.rows;
}

async function createMenuItem(db, tenantId, restaurantId, data) {
  const result = await db.query(
    `INSERT INTO menu_items (tenant_id, restaurant_id, name, description, price, image, is_available)
     VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, true))
     RETURNING id, restaurant_id AS "restaurantId", name, description, price, image, is_available AS "isAvailable"`,
    [tenantId, restaurantId, data.name, data.description || null, data.price, data.image || null, data.isAvailable]
  );
  return result.rows[0];
}

async function updateMenuItem(db, menuItemId, data) {
  const result = await db.query(
    `UPDATE menu_items
     SET name = $1, description = $2, price = $3, image = $4, is_available = COALESCE($5, is_available)
     WHERE id = $6
     RETURNING id, restaurant_id AS "restaurantId", name, description, price, image, is_available AS "isAvailable"`,
    [data.name, data.description || null, data.price, data.image || null, data.isAvailable, menuItemId]
  );
  if (result.rowCount === 0) throw new AppError('Item de cardápio não encontrado nesta conta', 404);
  return result.rows[0];
}

async function deleteMenuItem(db, menuItemId) {
  const result = await db.query('DELETE FROM menu_items WHERE id = $1', [menuItemId]);
  if (result.rowCount === 0) throw new AppError('Item de cardápio não encontrado nesta conta', 404);
}

async function listOrders(db, tenantId) {
  const ordersResult = await db.query(
    `${TENANT_ORDER_SELECT}
     WHERE o.tenant_id = $1
     ORDER BY o.created_at DESC`,
    [tenantId]
  );
  const orders = ordersResult.rows;
  if (orders.length === 0) return orders;
  const itemsResult = await db.query(
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

// Restaurante aceita o pedido: pendente -> preparando
async function acceptOrder(db, tenantId, orderId) {
  const result = await db.query(
    `UPDATE orders SET status = 'preparando', accepted_at = now()
     WHERE id = $1 AND tenant_id = $2 AND status = 'pendente'
     RETURNING id, status, client_id AS "clientId"`,
    [orderId, tenantId]
  );
  if (result.rowCount === 0) {
    throw new AppError('Pedido não encontrado ou não está mais pendente', 409);
  }
  const order = result.rows[0];
  toClient(order.clientId, 'order:status', { id: order.id, status: order.status });
  return order;
}

// Restaurante recusa o pedido: pendente -> cancelado
async function rejectOrder(db, tenantId, orderId, reason) {
  const result = await db.query(
    `UPDATE orders SET status = 'cancelado', cancelled_at = now(), cancel_reason = $1
     WHERE id = $2 AND tenant_id = $3 AND status = 'pendente'
     RETURNING id, status, client_id AS "clientId"`,
    [reason || 'Recusado pelo restaurante', orderId, tenantId]
  );
  if (result.rowCount === 0) {
    throw new AppError('Pedido não encontrado ou não está mais pendente', 409);
  }
  const order = result.rows[0];
  toClient(order.clientId, 'order:status', { id: order.id, status: order.status, cancelReason: reason });
  return order;
}

// Restaurante marca como pronto: preparando -> procurando_entregador
// Nesse momento o pedido entra no radar dos entregadores.
async function markOrderReady(db, tenantId, orderId) {
  const result = await db.query(
    `UPDATE orders SET status = 'procurando_entregador', ready_at = now()
     WHERE id = $1 AND tenant_id = $2 AND status = 'preparando'
     RETURNING id, status, client_id AS "clientId", restaurant_id AS "restaurantId", total,
               delivery_fee AS "deliveryFee", pickup_code AS "pickupCode",
               created_at AS "createdAt", ready_at AS "readyAt", address_id AS "addressId"`,
    [orderId, tenantId]
  );
  if (result.rowCount === 0) {
    throw new AppError('Pedido não encontrado ou ainda não está em preparo', 409);
  }
  const order = result.rows[0];
  const restaurantResult = await db.query('SELECT name FROM restaurants WHERE id = $1', [order.restaurantId]);
  const addressResult = await db.query(
    'SELECT street, number, neighborhood, city FROM addresses WHERE id = $1',
    [order.addressId]
  );
  const address = addressResult.rows[0] || {};
  toClient(order.clientId, 'order:status', { id: order.id, status: order.status });
  toDeliverers('order:available', {
    id: order.id,
    total: order.total,
    deliveryFee: order.deliveryFee,
    createdAt: order.createdAt,
    readyAt: order.readyAt,
    restaurantName: restaurantResult.rows[0]?.name || '',
    street: address.street,
    number: address.number,
    neighborhood: address.neighborhood,
    city: address.city,
  });
  return { id: order.id, status: order.status };
}

module.exports = {
  listRestaurants,
  createRestaurant,
  updateRestaurant,
  ensureRestaurantOwnedByTenant,
  listMenuItems,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  listOrders,
  acceptOrder,
  rejectOrder,
  markOrderReady,
};
