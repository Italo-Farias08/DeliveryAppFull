const { MercadoPagoConfig } = require('mercadopago');

// MP_ACCESS_TOKEN é o token SECRETO (do backend). Nunca deve ir pro app.
// Em desenvolvimento, use o token de TESTE (começa com "TEST-"); em
// produção, o token de produção (começa com "APP_USR-").
if (!process.env.MP_ACCESS_TOKEN) {
  console.warn(
    '[mercadopago] MP_ACCESS_TOKEN não configurado no .env — os pagamentos vão falhar até você configurar.'
  );
}

const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN || '',
});

module.exports = { mpClient };
