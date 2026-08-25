const crypto = require('crypto');
const AppError = require('../../utils/AppError');

// O sistema hoje só tem os papéis client/restaurant/deliverer -- não existe
// um "admin" cadastrado no banco (você, dono da plataforma, não é um
// tenant). Por isso a área de admin é protegida por uma chave simples
// (ADMIN_API_KEY no .env), enviada no header "x-admin-key", em vez de
// login. Troque essa chave por algo longo e aleatório antes de ir pra
// produção (ex: `openssl rand -hex 32`), e nunca a compartilhe.
function requireAdminKey(req, res, next) {
  const configuredKey = process.env.ADMIN_API_KEY;
  if (!configuredKey) {
    return next(new AppError('ADMIN_API_KEY não configurado no servidor', 500));
  }
  const providedKey = req.headers['x-admin-key'];
  // Comparação em tempo constante (timingSafeEqual) em vez de "!==" --
  // evita um ataque de timing conseguir descobrir a chave certa
  // caractere por caractere medindo a velocidade da resposta. Os buffers
  // precisam ter o mesmo tamanho antes de comparar, senão o próprio
  // timingSafeEqual lança erro -- por isso o length check com hash antes.
  const providedBuffer = Buffer.from(String(providedKey || ''));
  const configuredBuffer = Buffer.from(configuredKey);
  const isValid =
    providedKey != null &&
    providedBuffer.length === configuredBuffer.length &&
    crypto.timingSafeEqual(providedBuffer, configuredBuffer);
  if (!isValid) {
    return next(new AppError('Acesso negado', 401));
  }
  next();
}

module.exports = { requireAdminKey };