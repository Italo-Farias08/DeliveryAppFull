const { pool } = require('../../config/db');

async function listRestaurants(categoryId) {
  const params = [];
  let where = '';
  if (categoryId) {
    params.push(categoryId);
    where = 'WHERE category_id = $1';
  }
  const result = await pool.query(
    `SELECT id, tenant_id AS "tenantId", category_id AS "categoryId", name, rating,
            delivery_time_min AS "deliveryTimeMin", delivery_time_max AS "deliveryTimeMax",
            delivery_fee AS "deliveryFee", image, is_open AS "isOpen"
     FROM restaurants
     ${where}
     ORDER BY rating DESC`,
    params
  );
  return result.rows;
}

async function getRestaurantById(id) {
  const restaurantResult = await pool.query(
    `SELECT id, tenant_id AS "tenantId", category_id AS "categoryId", name, rating,
            delivery_time_min AS "deliveryTimeMin", delivery_time_max AS "deliveryTimeMax",
            delivery_fee AS "deliveryFee", image, is_open AS "isOpen"
     FROM restaurants
     WHERE id = $1`,
    [id]
  );
  if (restaurantResult.rowCount === 0) return null;
  const restaurant = restaurantResult.rows[0];
  const menuResult = await pool.query(
    `SELECT id, restaurant_id AS "restaurantId", name, description, price, image, is_available AS "isAvailable"
     FROM menu_items
     WHERE restaurant_id = $1
     ORDER BY name`,
    [id]
  );
  restaurant.menu = menuResult.rows;
  return restaurant;
}

async function search(query) {
  const q = `%${query.toLowerCase()}%`;
  const result = await pool.query(
    `SELECT DISTINCT r.id, r.tenant_id AS "tenantId", r.category_id AS "categoryId", r.name, r.rating,
            r.delivery_time_min AS "deliveryTimeMin", r.delivery_time_max AS "deliveryTimeMax",
            r.delivery_fee AS "deliveryFee", r.image, r.is_open AS "isOpen"
     FROM restaurants r
     LEFT JOIN menu_items m ON m.restaurant_id = r.id
     WHERE LOWER(r.name) LIKE $1 OR LOWER(m.name) LIKE $1
     ORDER BY r.name`,
    [q]
  );
  return result.rows;
}

module.exports = { listRestaurants, getRestaurantById, search };
