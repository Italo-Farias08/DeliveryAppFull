const { Router } = require('express');
const { z } = require('zod');
const asyncHandler = require('../../utils/asyncHandler');
const AppError = require('../../utils/AppError');
const { authenticate, authorize } = require('../../middlewares/auth');
const service = require('./deliverer.service');
const messagesService = require('../messages/messages.service');

const router = Router();

router.use(authenticate, authorize('deliverer'));

const availabilitySchema = z.object({ isAvailable: z.boolean() });

router.patch(
  '/availability',
  asyncHandler(async (req, res) => {
    const { isAvailable } = availabilitySchema.parse(req.body);
    const result = await service.setAvailability(req.user.sub, isAvailable);
    res.json(result);
  })
);

// Radar: corridas disponíveis agora (também chega via socket "order:available")
router.get(
  '/orders/available',
  asyncHandler(async (req, res) => {
    const orders = await service.listAvailable();
    res.json(orders);
  })
);

router.get(
  '/orders/mine',
  asyncHandler(async (req, res) => {
    const orders = await service.listMine(req.user.sub);
    res.json(orders);
  })
);

router.patch(
  '/orders/:id/accept',
  asyncHandler(async (req, res) => {
    const result = await service.acceptOrder(req.user.sub, req.params.id);
    res.json(result);
  })
);

const codeSchema = z.object({ code: z.string().min(4).max(4) });

router.patch(
  '/orders/:id/confirm-pickup',
  asyncHandler(async (req, res) => {
    const { code } = codeSchema.parse(req.body);
    const result = await service.confirmPickup(req.user.sub, req.params.id, code);
    res.json(result);
  })
);

router.patch(
  '/orders/:id/confirm-delivery',
  asyncHandler(async (req, res) => {
    const { code } = codeSchema.parse(req.body);
    const result = await service.confirmDelivery(req.user.sub, req.params.id, code);
    res.json(result);
  })
);

// Devolver a corrida pro radar -- só funciona antes da retirada na loja
router.patch(
  '/orders/:id/abandon',
  asyncHandler(async (req, res) => {
    const result = await service.abandonOrder(req.user.sub, req.params.id);
    res.json(result);
  })
);

const messageSchema = z.object({ message: z.string().min(1).max(1000) });

router.get(
  '/orders/:id/messages',
  asyncHandler(async (req, res) => {
    const order = await messagesService.getOrderParties(req.params.id);
    if (order.delivererId !== req.user.sub) throw new AppError('Acesso negado', 403);
    res.json(await messagesService.listMessages(req.params.id));
  })
);

router.post(
  '/orders/:id/messages',
  asyncHandler(async (req, res) => {
    const { message } = messageSchema.parse(req.body);
    const order = await messagesService.getOrderParties(req.params.id);
    if (order.delivererId !== req.user.sub) throw new AppError('Acesso negado', 403);
    const saved = await messagesService.sendMessage(req.params.id, 'deliverer', req.user.sub, message);
    res.status(201).json(saved);
  })
);

module.exports = router;
