const { Router } = require('express');
const asyncHandler = require('../../utils/asyncHandler');
const { authenticate, authorize } = require('../../middlewares/auth');
const service = require('./orders.service');
const { createOrderSchema } = require('./orders.schema');

const router = Router();

router.use(authenticate, authorize('client'));

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

module.exports = router;
