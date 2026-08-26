require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const authRoutes = require('./modules/auth/auth.routes');
const usersRoutes = require('./modules/users/users.routes');
const favoritesRoutes = require('./modules/favorites/favorites.routes');
const categoriesRoutes = require('./modules/categories/categories.routes');
const restaurantsRoutes = require('./modules/restaurants/restaurants.routes');
const ordersRoutes = require('./modules/orders/orders.routes');
const addressesRoutes = require('./modules/addresses/addresses.routes');
const tenantRoutes = require('./modules/tenant/tenant.routes');
const delivererRoutes = require('./modules/deliverer/deliverer.routes');
const paymentsRoutes = require('./modules/payments/payments.routes');
const adminRoutes = require('./modules/admin/admin.routes');
const errorHandler = require('./middlewares/errorHandler');
const { generalLimiter } = require('./middlewares/rateLimit');

const app = express();

// Necessário para que req.protocol reflita corretamente https quando o
// backend está atrás de um proxy (Railway, Render, etc.) — assim as URLs
// de imagem que geramos no upload já saem certas (https://...) E o
// rate limit abaixo identifica o IP real do cliente, não o do proxy.
app.set('trust proxy', 1);

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());
app.use(morgan('dev'));

// Rede de segurança geral contra bots/scraping/força bruta -- as rotas de
// login/registro têm limites BEM mais apertados por cima deste (ver
// auth.routes.js), este aqui é só o limite "de fundo" pra API inteira.
app.use('/api', generalLimiter);

// Arquivos enviados pelos restaurantes (logo, banner, fotos dos itens do
// cardápio) ficam salvos em disco em backend/uploads e são servidos aqui.
// Nada de imagem em base64/blob no banco — só o caminho/URL fica salvo lá.
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Painel simples (HTML puro) pra você fechar a semana e marcar acertos de
// comissão como pagos, sem precisar de Postman. Protegido pela mesma
// ADMIN_API_KEY das rotas /api/admin/* — quem não souber a chave só vê
// erro de "Acesso negado" ao tentar carregar os dados.
app.use('/admin', express.static(path.join(__dirname, '..', 'public')));

// Pasta de imagens públicas (ex: logo do restaurante usado no
// /restaurante/login.html, que referencia "../img/logo.png").
app.use('/img', express.static(path.join(__dirname, '..', 'public', 'img')));

// Termos de Uso — página pública, sem autenticação, linkada tanto do login
// web (/restaurante/login.html) quanto aberta pelo app mobile (Linking, ver
// TERMS_URL em frontend/src/services/api.ts). Fonte única do texto, os dois
// lugares só apontam pra cá em vez de duplicar o conteúdo.
app.use('/legal', (req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; style-src 'self' https: 'unsafe-inline'; font-src 'self' https: data:; img-src 'self' data:"
  );
  next();
});
app.use('/legal', express.static(path.join(__dirname, '..', 'public', 'legal')));

// Portal web do restaurante (login + painel de gestão completo, com as
// mesmas funções do painel do app: pedidos, cardápio, esgotados,
// entregadores, localização, horário, vendas e configuração).
// Fica em pasta própria, separada do /admin acima, porque o login aqui
// usa autenticação normal (JWT de usuário) e não a chave de admin.
//
// Esses arquivos são HTML único (CSS + JS tudo dentro, sem arquivo
// separado), por isso essa rota libera script inline na política de
// segurança (CSP) só pra ela -- o resto do site continua com a política
// padrão do Helmet, bem mais restrita.
// connect-src também libera o Nominatim (OpenStreetMap): é a busca de
// endereço usada na aba "Localização" do painel, chamada direto do
// navegador, igual ao app (ver frontend/src/services/geocodingService.ts).
app.use('/restaurante', (req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' https: 'unsafe-inline'; font-src 'self' https: data:; img-src 'self' data:; connect-src 'self' https://nominatim.openstreetmap.org"
  );
  next();
});
app.use('/restaurante', express.static(path.join(__dirname, '..', 'public', 'restaurante')));

// Navegadores sempre pedem /favicon.ico direto na raiz do domínio, então
// precisa de rota própria -- o resto de backend/public não é servido
// como estático (só /uploads, /admin, /img, /legal e /restaurante são).
app.get('/favicon.ico', (req, res) =>
  res.sendFile(path.join(__dirname, '..', 'public', 'favicon.ico'))
);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Acessar o domínio "pelado" (ex: vitoriadelivery.site) leva direto pro
// login do painel do restaurante, em vez de cair no 404 padrão de rota
// não encontrada -- só um atalho, não expõe nada que /restaurante já
// não expusesse.
app.get('/', (req, res) => res.redirect('/restaurante/login.html'));

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/restaurants', restaurantsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/addresses', addressesRoutes);
app.use('/api/tenant', tenantRoutes);
app.use('/api/deliverer', delivererRoutes);

app.use('/api/payments', paymentsRoutes);

app.use('/api/admin', adminRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

app.use(errorHandler);

module.exports = app;