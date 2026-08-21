const { Router } = require('express');
const asyncHandler = require('../../utils/asyncHandler');
const service = require('./payments.service');

const router = Router();

// Rota PÚBLICA (sem autenticação) — é o próprio Mercado Pago que chama
// aqui pra avisar que um pagamento mudou de status. Não dá pra exigir
// Bearer token porque quem chama é o servidor do MP, não o app.
router.post(
  '/webhook',
  asyncHandler(async (req, res) => {
    // O Mercado Pago manda o id do pagamento tanto na query (?data.id=...
    // no formato antigo) quanto no corpo (formato atual). Aceita os dois
    // pra não depender de qual versão de webhook está configurada no
    // painel do Mercado Pago.
    const paymentId =
      req.body?.data?.id || req.query['data.id'] || (req.body?.type === 'payment' ? req.body?.id : null);

    if (!paymentId) {
      // pode ser notificação de outro tipo (ex: merchant_order) — ignora
      return res.status(200).json({ received: true });
    }

    try {
      await service.processPaymentNotification(paymentId);
    } catch (err) {
      // Loga mas SEMPRE responde 200: se responder erro, o Mercado Pago
      // fica reenviando a mesma notificação sem parar. Se algo falhar de
      // verdade, dá pra investigar pelo log e reprocessar manualmente.
      console.error('Erro ao processar webhook do Mercado Pago:', err.message);
    }
    res.status(200).json({ received: true });
  })
);

// Página simples pra onde o Mercado Pago devolve o usuário depois do
// checkout (back_urls). O app não depende dela pra saber que o pagamento
// foi aprovado (isso é o webhook + socket em tempo real) — ela só existe
// pra fechar a aba/navegador do checkout com uma mensagem amigável.
router.get('/return', (req, res) => {
  const status = req.query.status;
  const messages = {
    success: 'Pagamento aprovado! Pode voltar para o app.',
    pending: 'Pagamento em processamento (comum no Pix). Volte para o app em instantes.',
    failure: 'Pagamento não foi concluído. Volte para o app para tentar novamente.',
  };
  res.send(`
    <html>
      <head><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
      <body style="font-family: -apple-system, sans-serif; text-align:center; padding:40px 20px;">
        <h2>${messages[status] || 'Pagamento processado.'}</h2>
        <p>Você já pode fechar esta janela e voltar para o aplicativo.</p>
      </body>
    </html>
  `);
});

module.exports = router;
