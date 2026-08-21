const { Router } = require('express');
const { z } = require('zod');
const asyncHandler = require('../../utils/asyncHandler');
const AppError = require('../../utils/AppError');
const { authenticate, authorize } = require('../../middlewares/auth');
const service = require('./orders.service');
const messagesService = require('../messages/messages.service');
const paymentsService = require('../payments/payments.service');
const { createOrderSchema } = require('./orders.schema');

const router = Router();

router.use(authenticate, authorize('client'));

const messageSchema = z.object({ message: z.string().min(1).max(1000) });
const cancelOrderSchema = z.object({ reason: z.string().min(1).max(300).optional() });
const rateOrderSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});
// Paginação da lista de pedidos: por padrão 20 por página (a tela pede a
// próxima página ao chegar perto do fim da lista, tipo "carregar mais").
const listOrdersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
// Paginação do chat: a tela pede mensagens mais antigas passando `before`
// (o created_at da mensagem mais antiga já carregada).
const listMessagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  before: z.string().datetime().optional(),
});

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
    const { limit, offset } = listOrdersQuerySchema.parse(req.query);
    const orders = await service.listOrdersByClient(req.user.sub, { limit, offset });
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

// Gera o link de pagamento (Checkout Pro) do Mercado Pago pro pedido.
// O app abre esse link (initPoint) num navegador/webview; o cliente paga
// lá (Pix, crédito ou débito) e o Mercado Pago confirma via webhook.
router.post(
  '/:id/pay',
  asyncHandler(async (req, res) => {
    const payment = await paymentsService.createPaymentForOrder(req.user.sub, req.params.id);
    res.json(payment);
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

router.post(
  '/:id/rating',
  asyncHandler(async (req, res) => {
    const { rating, comment } = rateOrderSchema.parse(req.body);
    const saved = await service.rateOrder(req.user.sub, req.params.id, rating, comment);
    res.status(201).json(saved);
  })
);

router.get(
  '/:id/messages',
  asyncHandler(async (req, res) => {
    const order = await messagesService.getOrderParties(req.params.id);
    if (order.clientId !== req.user.sub) throw new AppError('Acesso negado', 403);
    const { limit, before } = listMessagesQuerySchema.parse(req.query);
    res.json(await messagesService.listMessages(req.params.id, { limit, before }));
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