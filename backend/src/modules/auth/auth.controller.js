const authService = require('./auth.service');
const { registerSchema, loginSchema } = require('./auth.schema');
const asyncHandler = require('../../utils/asyncHandler');

const register = asyncHandler(async (req, res) => {
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
  const result = await authService.login(data);
  res.json(result);
});

module.exports = { register, login };
