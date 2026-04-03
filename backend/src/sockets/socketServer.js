const { Server } = require('socket.io');
const broadcastService = require('./broadcastService');

let io = null;

const initSocketServer = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    console.log(`[SOCKET] Client connected: ${socket.id}`);
    socket.on('disconnect', () => {
      console.log(`[SOCKET] Client disconnected: ${socket.id}`);
    });
  });

  broadcastService.init(io);

  console.log('[SOCKET] Socket.io server initialized');
  return io;
};

const getIO = () => {
  if (!io) throw new Error('Socket.io not initialized. Call initSocketServer first.');
  return io;
};

module.exports = { initSocketServer, getIO };
