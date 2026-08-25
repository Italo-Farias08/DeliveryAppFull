const { Router } = require('express');
const controller = require('./auth.controller');
const { authLimiter, codeVerifyLimiter } = require('../../middlewares/rateLimit');

const router = Router();

// authLimiter: trava força bruta de senha/registro em massa (por IP).
// codeVerifyLimiter: mais apertado ainda -- é aqui que alguém tentaria
// "adivinhar" o código de 6 dígitos de login ou de reset de senha.
router.post('/register', authLimiter, controller.register);
router.post('/login', authLimiter, controller.login);
router.post('/login/verify-code', codeVerifyLimiter, controller.verifyCode);
router.post('/forgot-password', authLimiter, controller.forgotPassword);
router.post('/reset-password', codeVerifyLimiter, controller.resetPassword);

module.exports = router;
