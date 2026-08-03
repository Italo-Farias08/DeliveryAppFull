const { Resend } = require('resend');

function hasResendConfig() {
  return !!process.env.RESEND_API_KEY;
}

async function sendLoginCodeEmail(to, code) {
  if (!hasResendConfig()) {
    // Sem Resend configurado: loga no console para não travar o desenvolvimento local.
    console.warn(`[email] RESEND_API_KEY não configurado. Código para ${to}: ${code}`);
    return { delivered: false };
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  const { data, error } = await resend.emails.send({
    from: process.env.RESEND_FROM || 'onboarding@resend.dev',
    to,
    subject: 'Seu código de verificação',
    text: `Seu código de verificação é: ${code}\n\nEle expira em 10 minutos.`,
    html: `<p>Seu código de verificação é:</p><h1 style="letter-spacing:4px">${code}</h1><p>Ele expira em 10 minutos.</p>`,
  });

  if (error) {
    console.error('[email] Erro ao enviar via Resend:', error);
    throw new Error('Falha ao enviar e-mail de verificação');
  }

  return { delivered: true, id: data?.id };
}

module.exports = { sendLoginCodeEmail, hasResendConfig };