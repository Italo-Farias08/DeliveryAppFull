const { Router } = require('express');
const { z } = require('zod');
const asyncHandler = require('../../utils/asyncHandler');
const AppError = require('../../utils/AppError');
const { authenticate, authorize } = require('../../middlewares/auth');
const service = require('./orders.service');
const messagesService = require('../messages/messages.service');
const { createOrderSchema } = require('./orders.schema');

const router = Router();

router.use(authenticate, authorize('client'));

const messageSchema = z.object({ message: z.string().min(1).max(1000) });
const cancelOrderSchema = z.object({ reason: z.string().min(1).max(300).optional() });

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = createOrderSchema.parse(req.body);
    const order = await service.createOrder(req.user.sub, data);
    res.status(201).json(order);
  })
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const orders = await service.listOrdersByClient(req.user.sub);
    res.json(orders);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const order = await service.getOrderById(req.params.id, req.user.sub);
    res.json(order);
  })
);

router.patch(
  '/:id/cancel',
  asyncHandler(async (req, res) => {
    const { reason } = cancelOrderSchema.parse(req.body ?? {});
    const order = await service.cancelOrder(req.user.sub, req.params.id, reason);
    res.json(order);
  })
);

router.get(
  '/:id/messages',
  asyncHandler(async (req, res) => {
    const order = await messagesService.getOrderParties(req.params.id);
    if (order.clientId !== req.user.sub) throw new AppError('Acesso negado', 403);
    res.json(await messagesService.listMessages(req.params.id));
  })
);

router.post(
  '/:id/messages',
  asyncHandler(async (req, res) => {
    const { message } = messageSchema.parse(req.body);
    const order = await messagesService.getOrderParties(req.params.id);
    if (order.clientId !== req.user.sub) throw new AppError('Acesso negado', 403);
    const saved = await messagesService.sendMessage(req.params.id, 'client', req.user.sub, message);
    res.status(201).json(saved);
  })
);

module.exports = router;