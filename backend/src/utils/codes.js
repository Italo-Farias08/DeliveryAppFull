// Gera código numérico de 4 dígitos usado para confirmar retirada (restaurante)
// e confirmar entrega (cliente) de um pedido.
function generateFourDigitCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

module.exports = { generateFourDigitCode };
