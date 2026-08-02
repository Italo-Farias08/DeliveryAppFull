const AppError = require('../../utils/AppError');

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
    `SELECT id, restaurant_id AS "restaurantId", client_id AS "clientId", deliverer_id AS "delivererId",
            status, subtotal, delivery_fee AS "deliveryFee", total, created_at AS "createdAt"
     FROM orders
     WHERE tenant_id = $1
     ORDER BY created_at DESC`,
    [tenantId]
  );
  return ordersResult.rows;
}

async function updateOrderStatus(db, tenantId, orderId, status) {
  const result = await db.query(
    `UPDATE orders SET status = $1
     WHERE id = $2 AND tenant_id = $3
     RETURNING id, status`,
    [status, orderId, tenantId]
  );
  if (result.rowCount === 0) throw new AppError('Pedido não encontrado nesta conta', 404);
  return result.rows[0];
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
  updateOrderStatus,
};
