const { Router } = require('express');
const controller = require('./auth.controller');

const router = Router();

router.post('/register', controller.register);
router.post('/login', controller.login);
router.post('/login/verify-code', controller.verifyCode);

module.exports = router;
