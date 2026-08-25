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