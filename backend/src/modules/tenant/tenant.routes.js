const { Router } = require('express');
const { z } = require('zod');
const asyncHandler = require('../../utils/asyncHandler');
const AppError = require('../../utils/AppError');
const { authenticate, authorize } = require('../../middlewares/auth');
const tenantContext = require('../../middlewares/tenantContext');
const messagesService = require('../messages/messages.service');
const controller = require('./tenant.controller');

const router = Router();

router.use(authenticate, authorize('restaurant'), tenantContext);

router.get('/restaurants', controller.listRestaurants);
router.post('/restaurants', controller.createRestaurant);
router.put('/restaurants/:id', controller.updateRestaurant);

router.get('/restaurants/:restaurantId/menu-items', controller.listMenuItems);
router.post('/restaurants/:restaurantId/menu-items', controller.createMenuItem);
router.put('/menu-items/:menuItemId', controller.updateMenuItem);
router.delete('/menu-items/:menuItemId', controller.deleteMenuItem);

router.get('/orders', controller.listOrders);
router.patch('/orders/:orderId/accept', controller.acceptOrder);
router.patch('/orders/:orderId/reject', controller.rejectOrder);
router.patch('/orders/:orderId/ready', controller.markOrderReady);

const messageSchema = z.object({ message: z.string().min(1).max(1000) });

router.get(
  '/orders/:orderId/messages',
  asyncHandler(async (req, res) => {
    const order = await messagesService.getOrderParties(req.params.orderId);
    if (order.tenantId !== req.tenantId) throw new AppError('Acesso negado', 403);
    res.json(await messagesService.listMessages(req.params.orderId));
  })
);

router.post(
  '/orders/:orderId/messages',
  asyncHandler(async (req, res) => {
    const { message } = messageSchema.parse(req.body);
    const order = await messagesService.getOrderParties(req.params.orderId);
    if (order.tenantId !== req.tenantId) throw new AppError('Acesso negado', 403);
    const saved = await messagesService.sendMessage(req.params.orderId, 'restaurant', req.user.sub, message);
    res.status(201).json(saved);
  })
);

module.exports = router;
