const { pool } = require('../../config/db');

// Raio de entrega padrão (km) usado pra filtrar/ordenar restaurantes pela
// localização do cliente -- mesmo princípio do iFood: uma loja só aparece
// pra quem ela realmente alcança. É isso que evita o cliente ver duas
// lojas da mesma franquia ao mesmo tempo (só a mais próxima entra no raio).
const DELIVERY_RADIUS_KM = 8;

// Fórmula de Haversine em SQL: calcula a distância (km) em linha reta
// entre o ponto do cliente ($<latParam>, $<lngParam>) e a coluna lat/lng
// de cada linha. LEAST/GREATEST evita erro de domínio do acos() por
// arredondamento de ponto flutuante quando os pontos são quase idênticos.
function distanceKmExpr(latParam, lngParam, latCol, lngCol) {
  return `(6371 * acos(LEAST(1, GREATEST(-1,
      cos(radians($${latParam})) * cos(radians(${latCol})) * cos(radians(${lngCol}) - radians($${lngParam}))
      + sin(radians($${latParam})) * sin(radians(${latCol}))
    ))))`;
}

async function listRestaurants(categoryId, lat, lng) {
  const params = [];
  let where = 'WHERE is_published = true';
  if (categoryId) {
    params.push(categoryId);
    where += ` AND category_id = $${params.length}`;
  }

  let distanceSelect = '';
  let orderBy = 'ORDER BY rating DESC';
  const hasLocation = lat != null && lng != null;
  if (hasLocation) {
    params.push(lat);
    const latParam = params.length;
    params.push(lng);
    const lngParam = params.length;
    const distanceExpr = distanceKmExpr(latParam, lngParam, 'lat', 'lng');
    distanceSelect = `, ${distanceExpr} AS "distanceKm"`;
    // Lojas sem lat/lng cadastrado ainda aparecem (fail-open, pra não
    // sumir com quem esqueceu de preencher a Localização), só ficam
    // por último na ordenação.
    where += ` AND (lat IS NULL OR ${distanceExpr} <= ${DELIVERY_RADIUS_KM})`;
    orderBy = `ORDER BY (lat IS NULL) ASC, "distanceKm" ASC NULLS LAST, rating DESC`;
  }

  const result = await pool.query(
    `SELECT id, tenant_id AS "tenantId", category_id AS "categoryId", name, rating, rating_count AS "ratingCount",
            delivery_time_min AS "deliveryTimeMin", delivery_time_max AS "deliveryTimeMax",
            delivery_fee AS "deliveryFee", min_order_value AS "minOrderValue", image, banner, restaurant_open_now(id) AS "isOpen",
            street, number, complement, neighborhood, city, state, zip, lat, lng,
            EXISTS (SELECT 1 FROM menu_items mi WHERE mi.restaurant_id = restaurants.id AND mi.promo_price IS NOT NULL) AS "hasPromo"
            ${distanceSelect}
     FROM restaurants
     ${where}
     ${orderBy}`,
    params
  );
  return result.rows;
}

async function getRestaurantById(id) {
  const restaurantResult = await pool.query(
    `SELECT id, tenant_id AS "tenantId", category_id AS "categoryId", name, rating, rating_count AS "ratingCount",
            delivery_time_min AS "deliveryTimeMin", delivery_time_max AS "deliveryTimeMax",
            delivery_fee AS "deliveryFee", min_order_value AS "minOrderValue", image, banner, restaurant_open_now(id) AS "isOpen",
            street, number, complement, neighborhood, city, state, zip, lat, lng,
            EXISTS (SELECT 1 FROM menu_items mi WHERE mi.restaurant_id = restaurants.id AND mi.promo_price IS NOT NULL) AS "hasPromo"
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
            name, description, price, promo_price AS "promoPrice", image, is_available AS "isAvailable"
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

async function search(query, lat, lng) {
  const q = `%${query.toLowerCase()}%`;
  const params = [q];

  let distanceSelect = '';
  let radiusFilter = '';
  let orderBy = 'ORDER BY r.name';
  const hasLocation = lat != null && lng != null;
  if (hasLocation) {
    params.push(lat);
    const latParam = params.length;
    params.push(lng);
    const lngParam = params.length;
    const distanceExpr = distanceKmExpr(latParam, lngParam, 'r.lat', 'r.lng');
    distanceSelect = `, ${distanceExpr} AS "distanceKm"`;
    radiusFilter = ` AND (r.lat IS NULL OR ${distanceExpr} <= ${DELIVERY_RADIUS_KM})`;
    // Nota: com SELECT DISTINCT, o ORDER BY só pode usar colunas que estão
    // no SELECT -- por isso comparamos "distanceKm" (já selecionada) em
    // vez de r.lat de novo.
    orderBy = `ORDER BY "distanceKm" IS NULL ASC, "distanceKm" ASC NULLS LAST, r.name`;
  }

  const result = await pool.query(
    `SELECT DISTINCT r.id, r.tenant_id AS "tenantId", r.category_id AS "categoryId", r.name, r.rating, r.rating_count AS "ratingCount",
            r.delivery_time_min AS "deliveryTimeMin", r.delivery_time_max AS "deliveryTimeMax",
            r.delivery_fee AS "deliveryFee", r.min_order_value AS "minOrderValue", r.image, r.banner, restaurant_open_now(r.id) AS "isOpen",
            EXISTS (SELECT 1 FROM menu_items mi2 WHERE mi2.restaurant_id = r.id AND mi2.promo_price IS NOT NULL) AS "hasPromo"
            ${distanceSelect}
     FROM restaurants r
     LEFT JOIN menu_items m ON m.restaurant_id = r.id
     WHERE r.is_published = true AND (LOWER(r.name) LIKE $1 OR LOWER(m.name) LIKE $1)${radiusFilter}
     ${orderBy}`,
    params
  );
  return result.rows;
}

// Busca por ITEM de cardápio (não por restaurante/categoria): quem digita
// "carne", por exemplo, quer ver todos os pratos com "carne" no nome/desc,
// vindos de restaurantes diferentes -- cada item já vem com o nome e a
// logo do restaurante de origem, pra ficar claro de onde vem o pedido.
async function searchItems(query, lat, lng) {
  const q = `%${query.toLowerCase()}%`;
  const params = [q];

  let radiusFilter = '';
  let orderBy = 'ORDER BY (LOWER(mi.name) LIKE $1) DESC, mi.name';
  const hasLocation = lat != null && lng != null;
  if (hasLocation) {
    params.push(lat);
    const latParam = params.length;
    params.push(lng);
    const lngParam = params.length;
    const distanceExpr = distanceKmExpr(latParam, lngParam, 'r.lat', 'r.lng');
    radiusFilter = ` AND (r.lat IS NULL OR ${distanceExpr} <= ${DELIVERY_RADIUS_KM})`;
    orderBy = `ORDER BY (LOWER(mi.name) LIKE $1) DESC, (r.lat IS NULL) ASC, ${distanceExpr} ASC NULLS LAST, mi.name`;
  }

  const result = await pool.query(
    `SELECT mi.id, mi.restaurant_id AS "restaurantId", mi.category_id AS "categoryId",
            mi.name, mi.description, mi.price, mi.promo_price AS "promoPrice", mi.image, mi.is_available AS "isAvailable",
            r.name AS "restaurantName", r.image AS "restaurantImage",
            restaurant_open_now(r.id) AS "restaurantIsOpen"
     FROM menu_items mi
     JOIN restaurants r ON r.id = mi.restaurant_id
     WHERE r.is_published = true
       AND (LOWER(mi.name) LIKE $1 OR LOWER(mi.description) LIKE $1)${radiusFilter}
     ${orderBy}
     LIMIT 60`,
    params
  );
  return result.rows;
}

module.exports = { listRestaurants, getRestaurantById, search, searchItems };