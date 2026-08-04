const { Router } = require('express');
const { z } = require('zod');
const asyncHandler = require('../../utils/asyncHandler');
const { authenticate, authorize } = require('../../middlewares/auth');
const service = require('./deliverer.service');

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

module.exports = router;
