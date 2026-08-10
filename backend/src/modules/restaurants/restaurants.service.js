const { pool } = require('../../config/db');

async function listRestaurants(categoryId) {
  const params = [];
  let where = 'WHERE is_published = true';
  if (categoryId) {
    params.push(categoryId);
    where += ` AND category_id = $${params.length}`;
  }
  const result = await pool.query(
    `SELECT id, tenant_id AS "tenantId", category_id AS "categoryId", name, rating, rating_count AS "ratingCount",
            delivery_time_min AS "deliveryTimeMin", delivery_time_max AS "deliveryTimeMax",
            delivery_fee AS "deliveryFee", image, banner, is_open AS "isOpen",
            street, number, complement, neighborhood, city, state, zip, lat, lng
     FROM restaurants
     ${where}
     ORDER BY rating DESC`,
    params
  );
  return result.rows;
}

async function getRestaurantById(id) {
  const restaurantResult = await pool.query(
    `SELECT id, tenant_id AS "tenantId", category_id AS "categoryId", name, rating, rating_count AS "ratingCount",
            delivery_time_min AS "deliveryTimeMin", delivery_time_max AS "deliveryTimeMax",
            delivery_fee AS "deliveryFee", image, banner, is_open AS "isOpen",
            street, number, complement, neighborhood, city, state, zip, lat, lng
     FROM restaurants
     WHERE id = $1 AND is_published = true`,
    [id]
  );
  if (restaurantResult.rowCount === 0) return null;
  const restaurant = restaurantResult.rows[0];

  const categoriesResult = await pool.query(
    `SELECT id, restaurant_id AS "restaurantId", name, sort_order AS "sortOrder"
     FROM menu_categories
     WHERE restaurant_id = $1
     ORDER BY sort_order, name`,
    [id]
  );
  restaurant.menuCategories = categoriesResult.rows;

  const menuResult = await pool.query(
    `SELECT id, restaurant_id AS "restaurantId", category_id AS "categoryId",
            name, description, price, image, is_available AS "isAvailable"
     FROM menu_items
     WHERE restaurant_id = $1
     ORDER BY name`,
    [id]
  );
  const menuItemIds = menuResult.rows.map((m) => m.id);
  let addonsByItem = {};
  if (menuItemIds.length > 0) {
    const addonsResult = await pool.query(
      `SELECT id, menu_item_id AS "menuItemId", name, price, is_available AS "isAvailable"
       FROM menu_item_addons
       WHERE menu_item_id = ANY($1::uuid[]) AND is_available = true
       ORDER BY created_at`,
      [menuItemIds]
    );
    for (const addon of addonsResult.rows) {
      (addonsByItem[addon.menuItemId] ||= []).push(addon);
    }
  }
  restaurant.menu = menuResult.rows.map((item) => ({ ...item, addons: addonsByItem[item.id] || [] }));
  return restaurant;
}

async function search(query) {
  const q = `%${query.toLowerCase()}%`;
  const result = await pool.query(
    `SELECT DISTINCT r.id, r.tenant_id AS "tenantId", r.category_id AS "categoryId", r.name, r.rating, r.rating_count AS "ratingCount",
            r.delivery_time_min AS "deliveryTimeMin", r.delivery_time_max AS "deliveryTimeMax",
            r.delivery_fee AS "deliveryFee", r.image, r.banner, r.is_open AS "isOpen"
     FROM restaurants r
     LEFT JOIN menu_items m ON m.restaurant_id = r.id
     WHERE r.is_published = true AND (LOWER(r.name) LIKE $1 OR LOWER(m.name) LIKE $1)
     ORDER BY r.name`,
    [q]
  );
  return result.rows;
}

module.exports = { listRestaurants, getRestaurantById, search };