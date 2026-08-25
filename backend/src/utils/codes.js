const crypto = require('crypto');

// Gera código numérico de 4 dígitos usado para confirmar retirada (restaurante)
// e confirmar entrega (cliente) de um pedido.
// crypto.randomInt (CSPRNG) em vez de Math.random(): Math.random() não é
// seguro para nada que precise ser imprevisível (é gerado por um algoritmo
// determinístico, mais fácil de prever a sequência).
function generateFourDigitCode() {
  return String(crypto.randomInt(1000, 10000));
}

module.exports = { generateFourDigitCode };