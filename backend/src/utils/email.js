const nodemailer = require('nodemailer');

function hasSmtpConfig() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function sendLoginCodeEmail(to, code) {
  if (!hasSmtpConfig()) {
    // Sem SMTP configurado: loga no console para não travar o desenvolvimento local.
    console.warn(`[email] SMTP não configurado. Código para ${to}: ${code}`);
    return { delivered: false };
  }

  const transporter = getTransporter();
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: 'Seu código de verificação',
    text: `Seu código de verificação é: ${code}\n\nEle expira em 10 minutos.`,
    html: `<p>Seu código de verificação é:</p><h1 style="letter-spacing:4px">${code}</h1><p>Ele expira em 10 minutos.</p>`,
  });
  return { delivered: true };
}

module.exports = { sendLoginCodeEmail, hasSmtpConfig };
