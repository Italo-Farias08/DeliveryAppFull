// Taxa de comissão da plataforma sobre o SUBTOTAL de cada pedido (não conta
// taxa de entrega). Configurável via COMMISSION_RATE no .env, 12% se não
// setado. Usado tanto no pagamento online (Mercado Pago, em
// payments.service.js) quanto no pagamento na entrega (dinheiro/cartão/Pix
// coletado pelo entregador, em deliverer.service.js) -- os dois lados
// precisam usar exatamente o mesmo valor, por isso fica num lugar só.
const COMMISSION_RATE = Number(process.env.COMMISSION_RATE || 12);

function calculateCommission(subtotal) {
  return Number((Number(subtotal) * (COMMISSION_RATE / 100)).toFixed(2));
}

module.exports = { COMMISSION_RATE, calculateCommission };
