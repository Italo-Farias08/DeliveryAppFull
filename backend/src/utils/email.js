const { Resend } = require('resend');
const nodemailer = require('nodemailer');

function hasBrevoConfig() {
  return !!(process.env.BREVO_API_KEY && process.env.BREVO_SENDER_EMAIL);
}

function hasGmailConfig() {
  return !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

function hasResendConfig() {
  return !!process.env.RESEND_API_KEY;
}

let gmailTransporter = null;
function getGmailTransporter() {
  if (!gmailTransporter) {
    gmailTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
  }
  return gmailTransporter;
}

async function sendViaBrevo(to, subject, text, html) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'api-key': process.env.BREVO_API_KEY,
    },
    body: JSON.stringify({
      sender: { email: process.env.BREVO_SENDER_EMAIL, name: 'Delivery App' },
      to: [{ email: to }],
      subject,
      textContent: text,
      htmlContent: html,
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error('[email] Erro ao enviar via Brevo:', res.status, errorBody);
    throw new Error('Falha ao enviar e-mail de verificação');
  }

  const data = await res.json();
  return { delivered: true, id: data.messageId };
}

async function sendLoginCodeEmail(to, code) {
  const subject = 'Seu código de verificação';
  const text = `Seu código de verificação é: ${code}\n\nEle expira em 10 minutos.`;
  const html = `<p>Seu código de verificação é:</p><h1 style="letter-spacing:4px">${code}</h1><p>Ele expira em 10 minutos.</p>`;

  // Prioridade: Brevo (HTTP API, sem exigir domínio, funciona no Railway) >
  // Gmail (SMTP, pode ser bloqueado pelo host) > Resend (HTTP API, mas exige
  // domínio verificado pra mandar pra qualquer destinatário) > log no console.
  if (hasBrevoConfig()) {
    return sendViaBrevo(to, subject, text, html);
  }

  if (hasGmailConfig()) {
    try {
      const info = await getGmailTransporter().sendMail({
        from: `"Delivery App" <${process.env.GMAIL_USER}>`,
        to,
        subject,
        text,
        html,
      });
      return { delivered: true, id: info.messageId };
    } catch (err) {
      console.error('[email] Erro ao enviar via Gmail:', err.message);
      throw new Error('Falha ao enviar e-mail de verificação');
    }
  }

  if (hasResendConfig()) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM || 'onboarding@resend.dev',
      to,
      subject,
      text,
      html,
    });
    if (error) {
      console.error('[email] Erro ao enviar via Resend:', error);
      throw new Error('Falha ao enviar e-mail de verificação');
    }
    return { delivered: true, id: data?.id };
  }

  // Sem nenhum provedor configurado: loga no console para não travar o dev local.
  console.warn(`[email] Nenhum provedor de e-mail configurado. Código para ${to}: ${code}`);
  return { delivered: false };
}

module.exports = { sendLoginCodeEmail, hasResendConfig, hasGmailConfig, hasBrevoConfig };