const { pool } = require('../../config/db');
const AppError = require('../../utils/AppError');
const { toClient, toTenant, toDeliverer } = require('../../realtime/socket');
const { sendPushToUser, sendPushToTenant } = require('../../utils/push');

async function getOrderParties(orderId) {
  const result = await pool.query(
    `SELECT id, client_id AS "clientId", tenant_id AS "tenantId", deliverer_id AS "delivererId"
     FROM orders WHERE id = $1`,
    [orderId]
  );
  if (result.rowCount === 0) throw new AppError('Pedido não encontrado', 404);
  return result.rows[0];
}

async function listMessages(orderId, { limit = 50, before } = {}) {
  // Paginado por cursor: sem isso, um chat com muita troca de mensagem
  // (cliente + restaurante + entregador) carregava a conversa inteira
  // toda vez que a tela de chat abria.
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);

  const params = [orderId];
  let beforeClause = '';
  if (before) {
    params.push(before);
    beforeClause = `AND created_at < $${params.length}`;
  }
  params.push(safeLimit);

  // Busca as `safeLimit` mensagens mais recentes (antes do cursor, se
  // houver) em ordem decrescente, depois inverte pra devolver em ordem
  // cronológica -- é o jeito de pegar "as últimas N" sem escanear a
  // tabela inteira.
  const result = await pool.query(
    `SELECT id, sender_role AS "senderRole", message, created_at AS "createdAt"
     FROM order_messages
     WHERE order_id = $1 ${beforeClause}
     ORDER BY created_at DESC
     LIMIT $${params.length}`,
    params
  );
  return result.rows.reverse();
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
  // Conversa em grupo por pedido: cliente, restaurante e (quando já tem
  // entregador designado) o entregador dividem a mesma thread. Manda pra
  // todo mundo -- quem escreveu já atualiza pela resposta HTTP, mas o
  // socket garante que os outros lados recebem na hora.
  toClient(order.clientId, 'order:message', payload);
  toTenant(order.tenantId, 'order:message', payload);
  if (order.delivererId) {
    toDeliverer(order.delivererId, 'order:message', payload);
  }

  // push só pra quem não escreveu a mensagem -- quem enviou já vê na hora
  // pela própria tela de chat
  const senderLabel = { client: 'do cliente', restaurant: 'do restaurante', deliverer: 'do entregador' }[senderRole];
  const pushPayload = {
    title: `Nova mensagem ${senderLabel} 💬`,
    body: message,
    data: { orderId, type: 'order:message' },
  };

  if (senderRole !== 'client') {
    sendPushToUser(order.clientId, pushPayload);
  }
  if (senderRole !== 'restaurant') {
    sendPushToTenant(order.tenantId, pushPayload);
  }
  if (senderRole !== 'deliverer' && order.delivererId) {
    sendPushToUser(order.delivererId, pushPayload);
  }

  return saved;
}

module.exports = { getOrderParties, listMessages, sendMessage };
