const { Router } = require('express');
const asyncHandler = require('../../utils/asyncHandler');
const { requireAdminKey } = require('./admin.middleware');
const paymentsService = require('../payments/payments.service');

const router = Router();

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

// Marca um acerto como pago -- use depois que o restaurante te transferir
// o valor da comissão da semana (Pix, TED etc.), fora do app.
router.patch(
  '/settlements/:id/mark-paid',
  asyncHandler(async (req, res) => {
    const settlement = await paymentsService.markSettlementPaid(req.params.id);
    res.json(settlement);
  })
);

module.exports = router;
