const { Router } = require('express');
const asyncHandler = require('../../utils/asyncHandler');
const { requireAdminKey } = require('./admin.middleware');
const { authLimiter } = require('../../middlewares/rateLimit');
const paymentsService = require('../payments/payments.service');

const router = Router();

// authLimiter aqui é defesa extra: a ADMIN_API_KEY é uma chave só (sem
// usuário/senha), então travar tentativas por IP ajuda até você trocá-la
// por uma bem mais longa e aleatória (ver aviso em admin.middleware.js).
router.use(authLimiter);
router.use(requireAdminKey);

// Lista todos os acertos (de todos os restaurantes), pendentes primeiro.
router.get(
  '/settlements',
  asyncHandler(async (req, res) => {
    res.json(await paymentsService.listAllSettlements());
  })
);

// Fecha a semana: agrupa os pedidos pagos ainda "soltos" de cada
// restaurante num novo acerto e trava o valor de comissão devido. Rode
// isso manualmente toda semana (ex: toda segunda de manhã), ou configure
// um cron/scheduled job pra chamar esse endpoint automaticamente.
router.post(
  '/settlements/generate',
  asyncHandler(async (req, res) => {
    const settlements = await paymentsService.generateWeeklySettlements();
    res.json({ generated: settlements.length, settlements });
  })
);

// Marca um acerto como pago -- use depois que VOCÊ transferir o valor
// líquido (netAmount) da semana pro restaurante (Pix, TED etc.), fora do app.
router.patch(
  '/settlements/:id/mark-paid',
  asyncHandler(async (req, res) => {
    const settlement = await paymentsService.markSettlementPaid(req.params.id);
    res.json(settlement);
  })
);

module.exports = router;