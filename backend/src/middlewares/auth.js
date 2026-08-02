const { verifyToken } = require('../utils/jwt');
const AppError = require('../utils/AppError');

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(new AppError('Token não informado', 401));
  }
  const token = header.split(' ')[1];
  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    next(new AppError('Token inválido ou expirado', 401));
  }
}

function authorize(...roles) {
  return function (req, res, next) {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError('Acesso negado para este perfil', 403));
    }
    next();
  };
}

module.exports = { authenticate, authorize };
