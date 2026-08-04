const asyncHandler = require('../../utils/asyncHandler');
const service = require('./tenant.service');
const { restaurantSchema, menuItemSchema, rejectOrderSchema } = require('./tenant.schema');

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
  listMenuItems,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  listOrders,
  acceptOrder,
  rejectOrder,
  markOrderReady,
};
