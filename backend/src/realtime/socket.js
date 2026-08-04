const { Server } = require('socket.io');
const { verifyToken } = require('../utils/jwt');

let io = null;

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
    }

    socket.on('disconnect', () => {});
  });

  return io;
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

module.exports = { initSocket, getIO, toClient, toTenant, toDeliverers, toDeliverer };
