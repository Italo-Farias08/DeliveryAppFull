const asyncHandler = require('../../utils/asyncHandler');
const AppError = require('../../utils/AppError');
const service = require('./tenant.service');
const { restaurantSchema, restaurantLocationSchema, menuItemSchema, menuCategorySchema, rejectOrderSchema, addonSchema } = require('./tenant.schema');
const { saveProcessedImage } = require('../../middlewares/upload');
const { processImage } = require('../../utils/imageProcessing');

const listRestaurants = asyncHandler(async (req, res) => {
  const restaurants = await service.listRestaurants(req.db);
  res.json(restaurants);
});

const createRestaurant = asyncHandler(async (req, res) => {
  const data = restaurantSchema.parse(req.body);
  const restaurant = await service.createRestaurant(req.db, req.tenantId, data);
  res.status(201).json(restaurant);
});

const updateRestaurant = asyncHandler(async (req, res) => {
  const data = restaurantSchema.parse(req.body);
  const restaurant = await service.updateRestaurant(req.db, req.params.id, data);
  res.json(restaurant);
});

// Endereço/GPS da loja — aba "Localização" do painel.
const updateRestaurantLocation = asyncHandler(async (req, res) => {
  const data = restaurantLocationSchema.parse(req.body);
  const restaurant = await service.updateRestaurantLocation(req.db, req.params.id, req.tenantId, data);
  res.json(restaurant);
});

// Upload da logo do restaurante (arquivo em multipart/form-data, campo "logo").
const uploadRestaurantLogo = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError('Envie um arquivo de imagem no campo "logo".', 400);
  const processed = await processImage(req.file.buffer, 'logo');
  const url = saveProcessedImage(req, 'restaurants/logos', processed);
  const restaurant = await service.updateRestaurantLogo(req.db, req.params.id, req.tenantId, url);
  res.json(restaurant);
});

// Upload do banner (foto de capa) do restaurante (campo "banner").
const uploadRestaurantBanner = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError('Envie um arquivo de imagem no campo "banner".', 400);
  const processed = await processImage(req.file.buffer, 'banner');
  const url = saveProcessedImage(req, 'restaurants/banners', processed);
  const restaurant = await service.updateRestaurantBanner(req.db, req.params.id, req.tenantId, url);
  res.json(restaurant);
});

// Upload da foto de um item do cardápio (campo "image").
const uploadMenuItemImage = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError('Envie um arquivo de imagem no campo "image".', 400);
  const processed = await processImage(req.file.buffer, 'menuItem');
  const url = saveProcessedImage(req, 'menu-items', processed);
  const item = await service.updateMenuItemImage(req.db, req.params.menuItemId, req.tenantId, url);
  res.json(item);
});

const listMenuItems = asyncHandler(async (req, res) => {
  await service.ensureRestaurantOwnedByTenant(req.db, req.params.restaurantId, req.tenantId);
  const items = await service.listMenuItems(req.db, req.params.restaurantId);
  res.json(items);
});

const createMenuItem = asyncHandler(async (req, res) => {
  await service.ensureRestaurantOwnedByTenant(req.db, req.params.restaurantId, req.tenantId);
  const data = menuItemSchema.parse(req.body);
  const item = await service.createMenuItem(req.db, req.tenantId, req.params.restaurantId, data);
  res.status(201).json(item);
});

const updateMenuItem = asyncHandler(async (req, res) => {
  const data = menuItemSchema.parse(req.body);
  const item = await service.updateMenuItem(req.db, req.params.menuItemId, data);
  res.json(item);
});

const deleteMenuItem = asyncHandler(async (req, res) => {
  await service.deleteMenuItem(req.db, req.params.menuItemId);
  res.status(204).send();
});

const listMenuCategories = asyncHandler(async (req, res) => {
  await service.ensureRestaurantOwnedByTenant(req.db, req.params.restaurantId, req.tenantId);
  const categories = await service.listMenuCategories(req.db, req.params.restaurantId);
  res.json(categories);
});

const createMenuCategory = asyncHandler(async (req, res) => {
  await service.ensureRestaurantOwnedByTenant(req.db, req.params.restaurantId, req.tenantId);
  const data = menuCategorySchema.parse(req.body);
  const category = await service.createMenuCategory(req.db, req.tenantId, req.params.restaurantId, data);
  res.status(201).json(category);
});

const updateMenuCategory = asyncHandler(async (req, res) => {
  const data = menuCategorySchema.parse(req.body);
  const category = await service.updateMenuCategory(req.db, req.params.categoryId, data);
  res.json(category);
});

const deleteMenuCategory = asyncHandler(async (req, res) => {
  await service.deleteMenuCategory(req.db, req.params.categoryId);
  res.status(204).send();
});

const listAddons = asyncHandler(async (req, res) => {
  await service.ensureMenuItemOwnedByTenant(req.db, req.params.menuItemId, req.tenantId);
  const addons = await service.listAddons(req.db, req.params.menuItemId);
  res.json(addons);
});

const createAddon = asyncHandler(async (req, res) => {
  await service.ensureMenuItemOwnedByTenant(req.db, req.params.menuItemId, req.tenantId);
  const data = addonSchema.parse(req.body);
  const addon = await service.createAddon(req.db, req.tenantId, req.params.menuItemId, data);
  res.status(201).json(addon);
});

const updateAddon = asyncHandler(async (req, res) => {
  const data = addonSchema.parse(req.body);
  const addon = await service.updateAddon(req.db, req.params.addonId, data);
  res.json(addon);
});

const deleteAddon = asyncHandler(async (req, res) => {
  await service.deleteAddon(req.db, req.params.addonId);
  res.status(204).send();
});

const listOrders = asyncHandler(async (req, res) => {
  const orders = await service.listOrders(req.db, req.tenantId);
  res.json(orders);
});

const acceptOrder = asyncHandler(async (req, res) => {
  const order = await service.acceptOrder(req.db, req.tenantId, req.params.orderId);
  res.json(order);
});

const rejectOrder = asyncHandler(async (req, res) => {
  const { reason } = rejectOrderSchema.parse(req.body || {});
  const order = await service.rejectOrder(req.db, req.tenantId, req.params.orderId, reason);
  res.json(order);
});

const markOrderReady = asyncHandler(async (req, res) => {
  const order = await service.markOrderReady(req.db, req.tenantId, req.params.orderId);
  res.json(order);
});

module.exports = {
  listRestaurants,
  createRestaurant,
  updateRestaurant,
  updateRestaurantLocation,
  uploadRestaurantLogo,
  uploadRestaurantBanner,
  uploadMenuItemImage,
  listMenuItems,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  listMenuCategories,
  createMenuCategory,
  updateMenuCategory,
  deleteMenuCategory,
  listOrders,
  acceptOrder,
  rejectOrder,
  markOrderReady,
  listAddons,
  createAddon,
  updateAddon,
  deleteAddon,
};
