const { pool } = require('../config/db');
const AppError = require('../utils/AppError');

async function tenantContext(req, res, next) {
  if (!req.user || !req.user.tenantId) {
    return next(new AppError('Usuário não vinculado a nenhuma conta', 403));
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.current_tenant', $1, true)", [req.user.tenantId]);
    req.tenantId = req.user.tenantId;
    req.db = client;
    res.on('finish', async () => {
      try {
        if (res.statusCode >= 400) {
          await client.query('ROLLBACK');
        } else {
          await client.query('COMMIT');
        }
      } finally {
        client.release();
      }
    });
    next();
  } catch (err) {
    await client.query('ROLLBACK');
    client.release();
    next(err);
  }
}

module.exports = tenantContext;
