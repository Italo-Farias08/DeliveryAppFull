const authService = require('./auth.service');
const { registerSchema, loginSchema, verifyCodeSchema, forgotPasswordSchema, resetPasswordSchema } = require('./auth.schema');
const asyncHandler = require('../../utils/asyncHandler');

const register = asyncHandler(async (req, res) => {
  console.log('DEBUG RAW BODY >>>', JSON.stringify(req.body));
  const data = registerSchema.parse(req.body);
  let result;
  if (data.role === 'restaurant') {
    result = await authService.registerRestaurantAccount(data);
  } else {
    result = await authService.registerClientOrDeliverer(data);
  }
  res.status(201).json(result);
});

const login = asyncHandler(async (req, res) => {
  const data = loginSchema.parse(req.body);
  const result = await authService.requestLoginCode(data);
  res.json(result);
});

const verifyCode = asyncHandler(async (req, res) => {
  const data = verifyCodeSchema.parse(req.body);
  const result = await authService.verifyLoginCode(data);
  res.json(result);
});

const forgotPassword = asyncHandler(async (req, res) => {
  const data = forgotPasswordSchema.parse(req.body);
  const result = await authService.requestPasswordReset(data);
  res.json(result);
});

const resetPassword = asyncHandler(async (req, res) => {
  const data = resetPasswordSchema.parse(req.body);
  const result = await authService.resetPassword(data);
  res.json(result);
});

module.exports = { register, login, verifyCode, forgotPassword, resetPassword };
