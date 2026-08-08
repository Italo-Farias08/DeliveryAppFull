const AppError = require('../../utils/AppError');
const { pool } = require('../../config/db');
const { toClient, toDeliverers } = require('../../realtime/socket');
const { sendPushToUser, sendPushToDeliverers } = require('../../utils/push');

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

const RESTAURANT_SELECT_FIELDS = `id, category_id AS "categoryId", name, rating, delivery_time_min AS "deliveryTimeMin",
            delivery_time_max AS "deliveryTimeMax", delivery_fee AS "deliveryFee", image, banner, is_open AS "isOpen"`;

async function listRestaurants(db) {
  const result = await db.query(
    `SELECT ${RESTAURANT_SELECT_FIELDS}
     FROM restaurants
     ORDER BY created_at DESC`
  );
  return result.rows;
}

async function createRestaurant(db, tenantId, data) {
  const result = await db.query(
    `INSERT INTO restaurants (tenant_id, category_id, name, delivery_time_min, delivery_time_max, delivery_fee, image, banner, is_open)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, true))
     RETURNING ${RESTAURANT_SELECT_FIELDS}`,
    [tenantId, data.categoryId, data.name, data.deliveryTimeMin, data.deliveryTimeMax, data.deliveryFee, data.image || null, data.banner || null, data.isOpen]
  );
  return result.rows[0];
}

async function updateRestaurant(db, restaurantId, data) {
  // image/banner só são sobrescritos quando vierem no payload — assim,
  // salvar outros campos (ex: abrir/fechar a loja) não apaga a foto que já
  // tinha sido enviada pela rota de upload.
  const result = await db.query(
    `UPDATE restaurants
     SET category_id = $1, name = $2, delivery_time_min = $3, delivery_time_max = $4,
         delivery_fee = $5, image = COALESCE($6, image), banner = COALESCE($7, banner),
         is_open = COALESCE($8, is_open)
     WHERE id = $9
     RETURNING ${RESTAURANT_SELECT_FIELDS}`,
    [data.categoryId, data.name, data.deliveryTimeMin, data.deliveryTimeMax, data.deliveryFee, data.image || null, data.banner || null, data.isOpen, restaurantId]
  );
  if (result.rowCount === 0) throw new AppError('Restaurante não encontrado nesta conta', 404);
  return result.rows[0];
}

// Usadas pelas rotas de upload (multipart/form-data) — trocam só a foto,
// sem exigir o restante do payload do restaurante.
async function updateRestaurantLogo(db, restaurantId, tenantId, imageUrl) {
  const result = await db.query(
    `UPDATE restaurants SET image = $1 WHERE id = $2 AND tenant_id = $3
     RETURNING ${RESTAURANT_SELECT_FIELDS}`,
    [imageUrl, restaurantId, tenantId]
  );
  if (result.rowCount === 0) throw new AppError('Restaurante não encontrado nesta conta', 404);
  return result.rows[0];
}

async function updateRestaurantBanner(db, restaurantId, tenantId, bannerUrl) {
  const result = await db.query(
    `UPDATE restaurants SET banner = $1 WHERE id = $2 AND tenant_id = $3
     RETURNING ${RESTAURANT_SELECT_FIELDS}`,
    [bannerUrl, restaurantId, tenantId]
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
    `SELECT id, restaurant_id AS "restaurantId", category_id AS "categoryId",
            name, description, price, image, is_available AS "isAvailable"
     FROM menu_items
     WHERE restaurant_id = $1
     ORDER BY created_at DESC`,
    [restaurantId]
  );
  return result.rows;
}

async function createMenuItem(db, tenantId, restaurantId, data) {
  const result = await db.query(
    `INSERT INTO menu_items (tenant_id, restaurant_id, category_id, name, description, price, image, is_available)
     VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, true))
     RETURNING id, restaurant_id AS "restaurantId", category_id AS "categoryId",
               name, description, price, image, is_available AS "isAvailable"`,
    [tenantId, restaurantId, data.categoryId || null, data.name, data.description || null, data.price, data.image || null, data.isAvailable]
  );
  return result.rows[0];
}

async function updateMenuItem(db, menuItemId, data) {
  // Mesma lógica do restaurante: só troca a imagem se ela vier no payload,
  // pra editar nome/preço não apagar a foto já enviada.
  const result = await db.query(
    `UPDATE menu_items
     SET name = $1, description = $2, price = $3, image = COALESCE($4, image),
         is_available = COALESCE($5, is_available), category_id = $6
     WHERE id = $7
     RETURNING id, restaurant_id AS "restaurantId", category_id AS "categoryId",
               name, description, price, image, is_available AS "isAvailable"`,
    [data.name, data.description || null, data.price, data.image || null, data.isAvailable, data.categoryId || null, menuItemId]
  );
  if (result.rowCount === 0) throw new AppError('Item de cardápio não encontrado nesta conta', 404);
  return result.rows[0];
}

async function listMenuCategories(db, restaurantId) {
  const result = await db.query(
    `SELECT id, restaurant_id AS "restaurantId", name, sort_order AS "sortOrder"
     FROM menu_categories
     WHERE restaurant_id = $1
     ORDER BY sort_order, name`,
    [restaurantId]
  );
  return result.rows;
}

async function createMenuCategory(db, tenantId, restaurantId, data) {
  const result = await db.query(
    `INSERT INTO menu_categories (tenant_id, restaurant_id, name, sort_order)
     VALUES ($1, $2, $3, COALESCE($4, 0))
     RETURNING id, restaurant_id AS "restaurantId", name, sort_order AS "sortOrder"`,
    [tenantId, restaurantId, data.name, data.sortOrder]
  );
  return result.rows[0];
}

async function updateMenuCategory(db, categoryId, data) {
  const result = await db.query(
    `UPDATE menu_categories
     SET name = $1, sort_order = COALESCE($2, sort_order)
     WHERE id = $3
     RETURNING id, restaurant_id AS "restaurantId", name, sort_order AS "sortOrder"`,
    [data.name, data.sortOrder, categoryId]
  );
  if (result.rowCount === 0) throw new AppError('Categoria não encontrada nesta conta', 404);
  return result.rows[0];
}

async function deleteMenuCategory(db, categoryId) {
  // Os itens dessa categoria não são apagados: category_id vira null
  // (ON DELETE SET NULL no banco) e eles voltam a aparecer em "Todos".
  await db.query('DELETE FROM menu_categories WHERE id = $1', [categoryId]);
}

// Usada pela rota de upload de foto do item (multipart/form-data).
async function updateMenuItemImage(db, menuItemId, tenantId, imageUrl) {
  const result = await db.query(
    `UPDATE menu_items SET image = $1 WHERE id = $2 AND tenant_id = $3
     RETURNING id, restaurant_id AS "restaurantId", name, description, price, image, is_available AS "isAvailable"`,
    [imageUrl, menuItemId, tenantId]
  );
  if (result.rowCount === 0) throw new AppError('Item de cardápio não encontrado nesta conta', 404);
  return result.rows[0];
}

async function deleteMenuItem(db, menuItemId) {
  const result = await db.query('DELETE FROM menu_items WHERE id = $1', [menuItemId]);
  if (result.rowCount === 0) throw new AppError('Item de cardápio não encontrado nesta conta', 404);
}

const ADDON_SELECT_FIELDS = `id, menu_item_id AS "menuItemId", name, price, is_available AS "isAvailable"`;

async function ensureMenuItemOwnedByTenant(db, menuItemId, tenantId) {
  const result = await db.query('SELECT id FROM menu_items WHERE id = $1 AND tenant_id = $2', [menuItemId, tenantId]);
  if (result.rowCount === 0) throw new AppError('Item de cardápio não encontrado nesta conta', 404);
}

async function listAddons(db, menuItemId) {
  const result = await db.query(
    `SELECT ${ADDON_SELECT_FIELDS} FROM menu_item_addons WHERE menu_item_id = $1 ORDER BY created_at`,
    [menuItemId]
  );
  return result.rows;
}

async function createAddon(db, tenantId, menuItemId, data) {
  const result = await db.query(
    `INSERT INTO menu_item_addons (tenant_id, menu_item_id, name, price, is_available)
     VALUES ($1, $2, $3, $4, COALESCE($5, true))
     RETURNING ${ADDON_SELECT_FIELDS}`,
    [tenantId, menuItemId, data.name, data.price, data.isAvailable]
  );
  return result.rows[0];
}

async function updateAddon(db, addonId, data) {
  const result = await db.query(
    `UPDATE menu_item_addons
     SET name = $1, price = $2, is_available = COALESCE($3, is_available)
     WHERE id = $4
     RETURNING ${ADDON_SELECT_FIELDS}`,
    [data.name, data.price, data.isAvailable, addonId]
  );
  if (result.rowCount === 0) throw new AppError('Adicional não encontrado nesta conta', 404);
  return result.rows[0];
}

async function deleteAddon(db, addonId) {
  const result = await db.query('DELETE FROM menu_item_addons WHERE id = $1', [addonId]);
  if (result.rowCount === 0) throw new AppError('Adicional não encontrado nesta conta', 404);
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
  sendPushToUser(order.clientId, {
    title: 'Pedido aceito! 👍',
    body: 'O restaurante aceitou seu pedido e já vai começar a preparar.',
    data: { orderId: order.id, type: 'order:status', status: order.status },
  });
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
  sendPushToUser(order.clientId, {
    title: 'Pedido recusado 😕',
    body: reason || 'O restaurante recusou seu pedido.',
    data: { orderId: order.id, type: 'order:status', status: order.status },
  });
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
  sendPushToUser(order.clientId, {
    title: 'Pedido pronto! 📦',
    body: 'Seu pedido está pronto e já estamos buscando um entregador.',
    data: { orderId: order.id, type: 'order:status', status: order.status },
  });
  sendPushToDeliverers({
    title: 'Nova corrida disponível 🛵',
    body: `${restaurantResult.rows[0]?.name || 'Um restaurante'} tem uma entrega esperando.`,
    data: { orderId: order.id, type: 'order:available' },
  });
  return { id: order.id, status: order.status };
}

module.exports = {
  listRestaurants,
  createRestaurant,
  updateRestaurant,
  updateRestaurantLogo,
  updateRestaurantBanner,
  ensureRestaurantOwnedByTenant,
  listMenuItems,
  createMenuItem,
  updateMenuItem,
  updateMenuItemImage,
  deleteMenuItem,
  listMenuCategories,
  createMenuCategory,
  updateMenuCategory,
  deleteMenuCategory,
  listOrders,
  acceptOrder,
  rejectOrder,
  markOrderReady,
  ensureMenuItemOwnedByTenant,
  listAddons,
  createAddon,
  updateAddon,
  deleteAddon,
};
