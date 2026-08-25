const rateLimit = require('express-rate-limit');

// Limitador GERAL, aplicado em toda a API -- rede de segurança básica
// contra bots/scraping/DoS simples. Generoso o bastante pra não atrapalhar
// uso normal (o app faz bastante polling/refresh).
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Tente novamente em alguns minutos.' },
});

// Limitador APERTADO pra login/registro/verificação de código -- é aqui
// que faz sentido travar força bruta de verdade (senha, código de 6
// dígitos, reset de senha). Conta por IP.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas. Aguarde alguns minutos antes de tentar de novo.' },
});

// Ainda mais apertado -- só pra conferir o código de 6 dígitos (login) ou
// de reset de senha, que são o alvo mais óbvio de força bruta (só 1
// milhão de combinações e o código vale minutos).
const codeVerifyLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // mesma janela de validade do código
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de código. Solicite um novo código e aguarde antes de tentar de novo.' },
});

module.exports = { generalLimiter, authLimiter, codeVerifyLimiter };