const { Expo } = require('expo-server-sdk');
const { pool } = require('../config/db');

const expo = new Expo();

/**
 * Manda push (Expo Push Notifications) pra uma lista de usuários,
 * respeitando o toggle de notificações de cada um.
 *
 * Continua funcionando mesmo se o Expo/rede falhar: nunca lança erro pra
 * quem chamou, porque notificação nunca deve derrubar o fluxo principal
 * (criar pedido, mudar status etc.) -- na pior das hipóteses, só loga.
 *
 * @param {string[]} userIds
 * @param {{ title: string, body: string, data?: object }} message
 */
async function sendPushToUsers(userIds, { title, body, data = {} }) {
  try {
    const ids = [...new Set(userIds)].filter(Boolean);
    if (ids.length === 0) return;

    const { rows } = await pool.query(
      `SELECT pt.token
       FROM push_tokens pt
       JOIN users u ON u.id = pt.user_id
       WHERE pt.user_id = ANY($1::uuid[]) AND u.notifications_enabled = true`,
      [ids]
    );

    const tokens = rows.map((r) => r.token).filter((t) => Expo.isExpoPushToken(t));
    if (tokens.length === 0) return;

    const messages = tokens.map((to) => ({
      to,
      sound: 'default',
      title,
      body,
      data,
    }));

    const chunks = expo.chunkPushNotifications(messages);
    const invalidTokens = [];

    for (const chunk of chunks) {
      const receipts = await expo.sendPushNotificationsAsync(chunk);
      receipts.forEach((receipt, i) => {
        // token cancelado/desinstalado -- limpamos pra não tentar de novo
        if (receipt.status === 'error' && receipt.details?.error === 'DeviceNotRegistered') {
          invalidTokens.push(chunk[i].to);
        }
      });
    }

    if (invalidTokens.length > 0) {
      await pool.query('DELETE FROM push_tokens WHERE token = ANY($1::text[])', [invalidTokens]);
    }
  } catch (err) {
    console.error('Falha ao enviar push notification:', err.message);
  }
}

async function sendPushToUser(userId, message) {
  return sendPushToUsers([userId], message);
}

async function sendPushToTenant(tenantId, message) {
  const { rows } = await pool.query(
    `SELECT id FROM users WHERE tenant_id = $1 AND role = 'restaurant'`,
    [tenantId]
  );
  return sendPushToUsers(rows.map((r) => r.id), message);
}

async function sendPushToDeliverers(message) {
  const { rows } = await pool.query(`SELECT id FROM users WHERE role = 'deliverer'`);
  return sendPushToUsers(rows.map((r) => r.id), message);
}

module.exports = { sendPushToUser, sendPushToUsers, sendPushToTenant, sendPushToDeliverers };
