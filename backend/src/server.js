const http = require('http');
const app = require('./app');
const { initSocket } = require('./realtime/socket');

const PORT = process.env.PORT || 3333;

const httpServer = http.createServer(app);
initSocket(httpServer);

httpServer.listen(PORT, () => {
  console.log(`servidor rodando na porta ${PORT}`);
});
