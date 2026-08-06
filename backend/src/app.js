require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const authRoutes = require('./modules/auth/auth.routes');
const usersRoutes = require('./modules/users/users.routes');
const categoriesRoutes = require('./modules/categories/categories.routes');
const restaurantsRoutes = require('./modules/restaurants/restaurants.routes');
const ordersRoutes = require('./modules/orders/orders.routes');
const addressesRoutes = require('./modules/addresses/addresses.routes');
const tenantRoutes = require('./modules/tenant/tenant.routes');
const delivererRoutes = require('./modules/deliverer/deliverer.routes');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

// Necessário para que req.protocol reflita corretamente https quando o
// backend está atrás de um proxy (Railway, Render, etc.) — assim as URLs
// de imagem que geramos no upload já saem certas (https://...).
app.set('trust proxy', 1);

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());
app.use(morgan('dev'));

// Arquivos enviados pelos restaurantes (logo, banner, fotos dos itens do
// cardápio) ficam salvos em disco em backend/uploads e são servidos aqui.
// Nada de imagem em base64/blob no banco — só o caminho/URL fica salvo lá.
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/restaurants', restaurantsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/addresses', addressesRoutes);
app.use('/api/tenant', tenantRoutes);
app.use('/api/deliverer', delivererRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

app.use(errorHandler);

module.exports = app;
