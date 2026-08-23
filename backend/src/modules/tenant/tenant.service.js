const AppError = require('../../utils/AppError');
const { pool } = require('../../config/db');
const { toClient, toTenant, toDeliverers, toDeliverer, isDelivererOnline } = require('../../realtime/socket');
const { sendPushToUser, sendPushToDeliverers } = require('../../utils/push');
const asyncHandler = require('../../utils/asyncHandler');

const TENANT_ORDER_SELECT = `
  SELECT o.id, o.restaurant_id AS "restaurantId", o.client_id AS "clientId",
         o.deliverer_id AS "delivererId", o.status, o.subtotal, o.delivery_fee AS "deliveryFee",
         o.total, o.pickup_code AS "pickupCode",
         o.payment_status AS "paymentStatus", o.payment_method AS "paymentMethod",
         o.payment_timing AS "paymentTiming", o.change_for AS "changeFor",
         o.commission_amount AS "commissionAmount",
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
            delivery_time_max AS "deliveryTimeMax", delivery_fee AS "deliveryFee", min_order_value AS "minOrderValue",
            image, banner, is_open AS "isOpen",
            restaurant_open_now(id) AS "isOpenNow",
            is_published AS "isPublished",
            street, number, complement, neighborhood, city, state, zip, lat, lng`;

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
    `INSERT INTO restaurants (tenant_id, category_id, name, delivery_time_min, delivery_time_max, delivery_fee, min_order_value, image, banner, is_open)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10, true))
     RETURNING ${RESTAURANT_SELECT_FIELDS}`,
    [tenantId, data.categoryId, data.name, data.deliveryTimeMin, data.deliveryTimeMax, data.deliveryFee, data.minOrderValue ?? 0, data.image || null, data.banner || null, data.isOpen]
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
         delivery_fee = $5, min_order_value = $6, image = COALESCE($7, image), banner = COALESCE($8, banner),
         is_open = COALESCE($9, is_open)
     WHERE id = $10
     RETURNING ${RESTAURANT_SELECT_FIELDS}`,
    [data.categoryId, data.name, data.deliveryTimeMin, data.deliveryTimeMax, data.deliveryFee, data.minOrderValue ?? 0, data.image || null, data.banner || null, data.isOpen, restaurantId]
  );
  if (result.rowCount === 0) throw new AppError('Restaurante não encontrado nesta conta', 404);
  return result.rows[0];
}

// Só publica (fica visível pros clientes) se já tiver pelo menos um item
// no cardápio -- assim ninguém acaba mostrando uma loja vazia como opção.
async function publishRestaurant(db, restaurantId, tenantId) {
  const menuCountResult = await db.query(
    `SELECT COUNT(*)::int AS count FROM menu_items WHERE restaurant_id = $1`,
    [restaurantId]
  );
  if (menuCountResult.rows[0].count === 0) {
    throw new AppError('Adicione pelo menos um item ao cardápio antes de publicar sua loja.', 400);
  }
  const result = await db.query(
    `UPDATE restaurants SET is_published = true WHERE id = $1 AND tenant_id = $2
     RETURNING ${RESTAURANT_SELECT_FIELDS}`,
    [restaurantId, tenantId]
  );
  if (result.rowCount === 0) throw new AppError('Restaurante não encontrado nesta conta', 404);
  return result.rows[0];
}

async function getRestaurantHours(db, restaurantId) {
  const result = await db.query(
    `SELECT day_of_week AS "dayOfWeek", closed,
            to_char(open_time, 'HH24:MI') AS "openTime",
            to_char(close_time, 'HH24:MI') AS "closeTime"
     FROM restaurant_hours
     WHERE restaurant_id = $1
     ORDER BY day_of_week`,
    [restaurantId]
  );
  return result.rows;
}

// Substitui a agenda inteira de uma vez (o formulário do painel sempre
// manda os 7 dias juntos) -- mais simples e seguro do que tentar casar
// diffs. Roda dentro da mesma transação de req.db, então se algo falhar no
// meio, nada fica salvo pela metade.
async function setRestaurantHours(db, restaurantId, tenantId, days) {
  const ownedResult = await db.query(`SELECT id FROM restaurants WHERE id = $1 AND tenant_id = $2`, [
    restaurantId,
    tenantId,
  ]);
  if (ownedResult.rowCount === 0) throw new AppError('Restaurante não encontrado nesta conta', 404);

  await db.query(`DELETE FROM restaurant_hours WHERE restaurant_id = $1`, [restaurantId]);

  for (const day of days) {
    await db.query(
      `INSERT INTO restaurant_hours (tenant_id, restaurant_id, day_of_week, closed, open_time, close_time)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [tenantId, restaurantId, day.dayOfWeek, day.closed, day.closed ? null : day.openTime, day.closed ? null : day.closeTime]
    );
  }

  return getRestaurantHours(db, restaurantId);
}

// Endereço/GPS da loja — rota própria (igual logo/banner), separada do
// update geral do restaurante. Assim, trocar taxa de entrega ou abrir/
// fechar a loja nunca apaga a localização já salva sem querer.
async function updateRestaurantLocation(db, restaurantId, tenantId, data) {
  const result = await db.query(
    `UPDATE restaurants
     SET street = $1, number = $2, complement = $3, neighborhood = $4,
         city = $5, state = $6, zip = $7, lat = $8, lng = $9
     WHERE id = $10 AND tenant_id = $11
     RETURNING ${RESTAURANT_SELECT_FIELDS}`,
    [
      data.street, data.number || null, data.complement || null, data.neighborhood || null,
      data.city, data.state, data.zip || null, data.lat ?? null, data.lng ?? null,
      restaurantId, tenantId,
    ]
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
            name, description, price, promo_price AS "promoPrice", image, is_available AS "isAvailable"
     FROM menu_items
     WHERE restaurant_id = $1
     ORDER BY created_at DESC`,
    [restaurantId]
  );
  return result.rows;
}

async function createMenuItem(db, tenantId, restaurantId, data) {
  const result = await db.query(
    `INSERT INTO menu_items (tenant_id, restaurant_id, category_id, name, description, price, promo_price, image, is_available)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, true))
     RETURNING id, restaurant_id AS "restaurantId", category_id AS "categoryId",
               name, description, price, promo_price AS "promoPrice", image, is_available AS "isAvailable"`,
    [tenantId, restaurantId, data.categoryId || null, data.name, data.description || null, data.price, data.promoPrice ?? null, data.image || null, data.isAvailable]
  );
  return result.rows[0];
}

async function updateMenuItem(db, menuItemId, data) {
  // Mesma lógica do restaurante: só troca a imagem se ela vier no payload,
  // pra editar nome/preço não apagar a foto já enviada.
  const result = await db.query(
    `UPDATE menu_items
     SET name = $1, description = $2, price = $3, promo_price = $4, image = COALESCE($5, image),
         is_available = COALESCE($6, is_available), category_id = $7
     WHERE id = $8
     RETURNING id, restaurant_id AS "restaurantId", category_id AS "categoryId",
               name, description, price, promo_price AS "promoPrice", image, is_available AS "isAvailable"`,
    [data.name, data.description || null, data.price, data.promoPrice ?? null, data.image || null, data.isAvailable, data.categoryId || null, menuItemId]
  );
  if (result.rowCount === 0) throw new AppError('Item de cardápio não encontrado nesta conta', 404);
  return result.rows[0];
}

// Toggle rápido de "esgotado" -- usado na área de esgotados do painel,
// pra marcar/desmarcar sem reenviar o item inteiro.
async function setMenuItemAvailability(db, menuItemId, isAvailable) {
  const result = await db.query(
    `UPDATE menu_items SET is_available = $1 WHERE id = $2
     RETURNING id, restaurant_id AS "restaurantId", category_id AS "categoryId",
               name, description, price, promo_price AS "promoPrice", image, is_available AS "isAvailable"`,
    [isAvailable, menuItemId]
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
     RETURNING id, restaurant_id AS "restaurantId", name, description, price, promo_price AS "promoPrice", image, is_available AS "isAvailable"`,
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
  // Pedido só entra na fila do restaurante depois de PAGO (ou, se já foi
  // pago e depois estornado por cancelamento, continua aparecendo pra
  // manter o histórico) -- pedido ainda aguardando pagamento no app não
  // aparece aqui, mesmo em rede (defesa extra além de simplesmente não
  // emitir o evento de socket na criação).
  // Pedidos com pagamento na ENTREGA (dinheiro, cartão ou Pix cobrado pelo
  // entregador) entram direto, independente do payment_status -- não tem
  // confirmação online nenhuma pra esperar nesses casos.
  const ordersResult = await db.query(
    `${TENANT_ORDER_SELECT}
     WHERE o.tenant_id = $1 AND (o.payment_status IN ('pago', 'estornado') OR o.payment_timing = 'entrega')
     ORDER BY o.created_at DESC`,
    [tenantId]
  );
  const orders = ordersResult.rows;
  if (orders.length === 0) return orders;
  const itemsResult = await db.query(
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

// Restaurante aceita o pedido: pendente -> preparando
async function acceptOrder(db, tenantId, orderId) {
  // payment_status = 'pago' (ou payment_timing = 'entrega', pra pagamento
  // na entrega) aqui é defesa extra -- na prática o pedido só chega até o
  // restaurante (listOrders/socket) nesses casos mesmo.
  const result = await db.query(
    `UPDATE orders SET status = 'preparando', accepted_at = now()
     WHERE id = $1 AND tenant_id = $2 AND status = 'pendente'
       AND (payment_status = 'pago' OR payment_timing = 'entrega')
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
// Se vier delivererId, o pedido já nasce atribuído ao entregador DA CASA
// (nunca passa pelo radar público). Sem delivererId, segue o fluxo normal:
// entra no radar pra qualquer entregador autônomo aceitar.
async function markOrderReady(db, tenantId, orderId, delivererId) {
  let ownDeliverer = null;
  if (delivererId) {
    const check = await pool.query(
      `SELECT u.id, u.name FROM deliverer_profiles dp
       JOIN users u ON u.id = dp.user_id
       WHERE dp.user_id = $1 AND dp.tenant_id = $2`,
      [delivererId, tenantId]
    );
    if (check.rowCount === 0) {
      throw new AppError('Esse entregador não pertence a este restaurante', 403);
    }
    ownDeliverer = check.rows[0];
  }

  const result = await db.query(
    `UPDATE orders SET status = 'procurando_entregador', ready_at = now(), deliverer_id = $3
     WHERE id = $1 AND tenant_id = $2 AND status = 'preparando'
     RETURNING id, status, client_id AS "clientId", restaurant_id AS "restaurantId", total,
               delivery_fee AS "deliveryFee", pickup_code AS "pickupCode",
               created_at AS "createdAt", ready_at AS "readyAt", address_id AS "addressId"`,
    [orderId, tenantId, ownDeliverer?.id || null]
  );
  if (result.rowCount === 0) {
    throw new AppError('Pedido não encontrado ou ainda não está em preparo', 409);
  }
  const order = result.rows[0];
  const restaurantResult = await db.query(
    `SELECT name, street AS "restaurantStreet", number AS "restaurantNumber",
            neighborhood AS "restaurantNeighborhood", city AS "restaurantCity",
            lat AS "restaurantLat", lng AS "restaurantLng"
     FROM restaurants WHERE id = $1`,
    [order.restaurantId]
  );
  const restaurant = restaurantResult.rows[0] || {};
  const addressResult = await db.query(
    'SELECT street, number, neighborhood, city FROM addresses WHERE id = $1',
    [order.addressId]
  );
  const address = addressResult.rows[0] || {};
  toClient(order.clientId, 'order:status', { id: order.id, status: order.status });
  sendPushToUser(order.clientId, {
    title: 'Pedido pronto! 📦',
    body: ownDeliverer
      ? 'Seu pedido está pronto e o entregador já está indo buscar.'
      : 'Seu pedido está pronto e já estamos buscando um entregador.',
    data: { orderId: order.id, type: 'order:status', status: order.status },
  });

  const courierPayload = {
    id: order.id,
    total: order.total,
    deliveryFee: order.deliveryFee,
    createdAt: order.createdAt,
    readyAt: order.readyAt,
    restaurantName: restaurant.name || '',
    restaurantStreet: restaurant.restaurantStreet,
    restaurantNumber: restaurant.restaurantNumber,
    restaurantNeighborhood: restaurant.restaurantNeighborhood,
    restaurantCity: restaurant.restaurantCity,
    restaurantLat: restaurant.restaurantLat,
    restaurantLng: restaurant.restaurantLng,
    street: address.street,
    number: address.number,
    neighborhood: address.neighborhood,
    city: address.city,
  };

  if (ownDeliverer) {
    toDeliverer(ownDeliverer.id, 'order:assigned', courierPayload);
    toTenant(tenantId, 'order:courierAssigned', { id: order.id, delivererId: ownDeliverer.id });
    sendPushToUser(ownDeliverer.id, {
      title: 'Nova entrega pra você 🛵',
      body: `${restaurant.name || 'Seu restaurante'} tem um pedido pronto pra retirada.`,
      data: { orderId: order.id, type: 'order:assigned' },
    });
  } else {
    toDeliverers('order:available', courierPayload);
    sendPushToDeliverers({
      title: 'Nova corrida disponível 🛵',
      body: `${restaurant.name || 'Um restaurante'} tem uma entrega esperando.`,
      data: { orderId: order.id, type: 'order:available' },
    });
  }

  return { id: order.id, status: order.status, delivererId: ownDeliverer?.id || null };
}

async function listOwnDeliverers(tenantId) {
  const result = await pool.query(
    `SELECT u.id, u.name, u.phone, dp.vehicle_type AS "vehicleType", dp.is_available AS "isAvailable"
     FROM deliverer_profiles dp
     JOIN users u ON u.id = dp.user_id
     WHERE dp.tenant_id = $1
     ORDER BY u.name ASC`,
    [tenantId]
  );
  // isOnline vem da conexão de socket em tempo real (app aberto e
  // conectado agora), não do banco -- é o que faltava pra distinguir
  // "marcou disponível uma vez e fechou o app" de "está online de fato".
  return result.rows.map((d) => ({ ...d, isOnline: isDelivererOnline(d.id) }));
}

async function removeOwnDeliverer(tenantId, delivererId) {
  const result = await pool.query(
    `UPDATE deliverer_profiles SET tenant_id = NULL WHERE user_id = $1 AND tenant_id = $2 RETURNING user_id`,
    [delivererId, tenantId]
  );
  if (result.rowCount === 0) throw new AppError('Entregador não encontrado nesta conta', 404);
}

async function getOrCreateDelivererInviteCode(tenantId) {
  const existing = await pool.query('SELECT deliverer_invite_code AS code FROM tenants WHERE id = $1', [tenantId]);
  if (existing.rows[0]?.code) return existing.rows[0].code;

  // Gera um código curto e único (6 caracteres, sem letras ambíguas tipo O/0, I/1).
  const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 10; attempt++) {
    let code = '';
    for (let i = 0; i < 6; i++) code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    try {
      const updated = await pool.query(
        'UPDATE tenants SET deliverer_invite_code = $1 WHERE id = $2 RETURNING deliverer_invite_code AS code',
        [code, tenantId]
      );
      return updated.rows[0].code;
    } catch (err) {
      if (err.code !== '23505') throw err;
    }
  }
  throw new AppError('Não foi possível gerar o código de convite, tente novamente', 500);
}

module.exports = {
  listRestaurants,
  createRestaurant,
  updateRestaurant,
  publishRestaurant,
  getRestaurantHours,
  setRestaurantHours,
  updateRestaurantLocation,
  updateRestaurantLogo,
  updateRestaurantBanner,
  ensureRestaurantOwnedByTenant,
  listMenuItems,
  createMenuItem,
  updateMenuItem,
  setMenuItemAvailability,
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
  listOwnDeliverers,
  removeOwnDeliverer,
  getOrCreateDelivererInviteCode,
};