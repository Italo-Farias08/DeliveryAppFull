const { pool } = require('../../config/db');
const AppError = require('../../utils/AppError');
const { toClient, toTenant } = require('../../realtime/socket');
const { sendPushToUser, sendPushToTenant } = require('../../utils/push');

async function getOrderParties(orderId) {
  const result = await pool.query(
    `SELECT id, client_id AS "clientId", tenant_id AS "tenantId" FROM orders WHERE id = $1`,
    [orderId]
  );
  if (result.rowCount === 0) throw new AppError('Pedido não encontrado', 404);
  return result.rows[0];
}

async function listMessages(orderId) {
  const result = await pool.query(
    `SELECT id, sender_role AS "senderRole", message, created_at AS "createdAt"
     FROM order_messages
     WHERE order_id = $1
     ORDER BY created_at ASC`,
    [orderId]
  );
  return result.rows;
}

async function sendMessage(orderId, senderRole, senderId, message) {
  const order = await getOrderParties(orderId);
  const result = await pool.query(
    `INSERT INTO order_messages (order_id, sender_role, sender_id, message)
     VALUES ($1, $2, $3, $4)
     RETURNING id, sender_role AS "senderRole", message, created_at AS "createdAt"`,
    [orderId, senderRole, senderId, message]
  );
  const saved = result.rows[0];
  const payload = { orderId, ...saved };
  // manda para os dois lados — quem escreveu já atualiza pela resposta HTTP,
  // mas o socket garante que o outro lado da conversa recebe na hora
  toClient(order.clientId, 'order:message', payload);
  toTenant(order.tenantId, 'order:message', payload);

  // push só pra quem não escreveu a mensagem -- quem enviou já vê na hora
  // pela própria tela de chat
  if (senderRole === 'restaurant') {
    sendPushToUser(order.clientId, {
      title: 'Nova mensagem do restaurante 💬',
      body: message,
      data: { orderId, type: 'order:message' },
    });
  } else {
    sendPushToTenant(order.tenantId, {
      title: 'Nova mensagem do cliente 💬',
      body: message,
      data: { orderId, type: 'order:message' },
    });
  }

  return saved;
}

module.exports = { getOrderParties, listMessages, sendMessage };
