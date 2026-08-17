const { Server } = require('socket.io');
const { verifyToken } = require('../utils/jwt');
const { pool } = require('../config/db');

let io = null;

// Presença de verdade dos entregadores: quantas conexões de socket cada um
// tem abertas agora (o app pode ter mais de uma aba/reconexão temporária,
// por isso é um contador, não um booleano). "isAvailable" no banco é só o
// toggle que o motoboy mexeu -- não muda sozinho quando ele fecha o app,
// perde sinal ou desliga o celular. É essa presença aqui que representa
// "está com o app aberto e conectado agora", pro painel do restaurante não
// mostrar "online" pra sempre.
const delivererConnectionCounts = new Map(); // delivererId -> nº de sockets abertos

function isDelivererOnline(delivererId) {
  return (delivererConnectionCounts.get(delivererId) || 0) > 0;
}

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: process.env.CORS_ORIGIN || '*' },
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) return next(new Error('Token não informado'));
      const decoded = verifyToken(token);
      socket.user = decoded;
      next();
    } catch (err) {
      next(new Error('Token inválido ou expirado'));
    }
  });

  io.on('connection', (socket) => {
    const { sub, role, tenantId } = socket.user;

    if (role === 'client') {
      socket.join(`client:${sub}`);
    }
    if (role === 'restaurant' && tenantId) {
      socket.join(`tenant:${tenantId}`);
    }
    if (role === 'deliverer') {
      // sala geral do radar: todo entregador conectado recebe as novas corridas
      socket.join('deliverers');
      socket.join(`deliverer:${sub}`);

      const count = (delivererConnectionCounts.get(sub) || 0) + 1;
      delivererConnectionCounts.set(sub, count);
      // Só a primeira conexão simultânea é uma mudança de estado real
      // (0 -> 1); conexões extras do mesmo motoboy não geram novo evento.
      if (count === 1) {
        notifyDelivererPresence(sub, true);
      }
    }

    socket.on('disconnect', () => {
      if (role === 'deliverer') {
        const count = Math.max(0, (delivererConnectionCounts.get(sub) || 1) - 1);
        if (count === 0) {
          delivererConnectionCounts.delete(sub);
          notifyDelivererPresence(sub, false);
        } else {
          delivererConnectionCounts.set(sub, count);
        }
      }
    });
  });

  return io;
}

// Avisa o painel do restaurante (só se esse entregador for "da casa",
// vinculado a um tenant) que a presença dele mudou -- é isso que faz o
// pontinho de "Disponível agora" / "Offline" no painel reagir na hora,
// sem precisar puxar pra atualizar.
async function notifyDelivererPresence(delivererId, isOnline) {
  try {
    const result = await pool.query(
      `SELECT tenant_id AS "tenantId" FROM deliverer_profiles WHERE user_id = $1`,
      [delivererId]
    );
    const tenantId = result.rows[0]?.tenantId;
    if (tenantId) {
      toTenant(tenantId, 'deliverer:presence', { delivererId, isOnline });
    }
  } catch (err) {
    // presença é só um detalhe visual do painel -- não derruba o socket
    // nem o resto do fluxo se essa consulta falhar
  }
}

function getIO() {
  return io;
}

// --- helpers de emissão, usados pelos services ---

function toClient(userId, event, payload) {
  if (!io) return;
  io.to(`client:${userId}`).emit(event, payload);
}

function toTenant(tenantId, event, payload) {
  if (!io) return;
  io.to(`tenant:${tenantId}`).emit(event, payload);
}

function toDeliverers(event, payload) {
  if (!io) return;
  io.to('deliverers').emit(event, payload);
}

function toDeliverer(delivererId, event, payload) {
  if (!io) return;
  io.to(`deliverer:${delivererId}`).emit(event, payload);
}

module.exports = { initSocket, getIO, toClient, toTenant, toDeliverers, toDeliverer, isDelivererOnline };