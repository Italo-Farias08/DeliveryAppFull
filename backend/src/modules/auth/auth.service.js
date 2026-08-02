const { pool } = require('../../config/db');
const { hashPassword, comparePassword } = require('../../utils/password');
const { signToken } = require('../../utils/jwt');
const AppError = require('../../utils/AppError');

async function registerClientOrDeliverer({ name, email, password, role, phone }) {
  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rowCount > 0) {
    throw new AppError('E-mail já cadastrado', 409);
  }
  const passwordHash = await hashPassword(password);
  const result = await pool.query(
    `INSERT INTO users (name, email, password_hash, role, phone)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, email, role, tenant_id`,
    [name, email, passwordHash, role, phone || null]
  );
  const user = result.rows[0];
  if (role === 'deliverer') {
    await pool.query('INSERT INTO deliverer_profiles (user_id) VALUES ($1)', [user.id]);
  }
  return buildAuthResponse(user);
}

async function registerRestaurantAccount({ name, email, password, phone, businessName, document }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rowCount > 0) {
      throw new AppError('E-mail já cadastrado', 409);
    }
    const tenantResult = await client.query(
      `INSERT INTO tenants (name, document, email, phone)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name`,
      [businessName || name, document || null, email, phone || null]
    );
    const tenant = tenantResult.rows[0];
    const passwordHash = await hashPassword(password);
    const userResult = await client.query(
      `INSERT INTO users (tenant_id, name, email, password_hash, role, phone)
       VALUES ($1, $2, $3, 'restaurant', $4)
       RETURNING id, name, email, role, tenant_id`,
      [tenant.id, name, email, phone || null]
    );
    await client.query('COMMIT');
    return buildAuthResponse(userResult.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function login({ email, password }) {
  const result = await pool.query(
    'SELECT id, name, email, password_hash, role, tenant_id FROM users WHERE email = $1',
    [email]
  );
  if (result.rowCount === 0) {
    throw new AppError('Credenciais inválidas', 401);
  }
  const user = result.rows[0];
  const valid = await comparePassword(password, user.password_hash);
  if (!valid) {
    throw new AppError('Credenciais inválidas', 401);
  }
  return buildAuthResponse(user);
}

function buildAuthResponse(user) {
  const token = signToken({
    sub: user.id,
    role: user.role,
    tenantId: user.tenant_id || null,
  });
  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      tenantId: user.tenant_id || null,
    },
  };
}

module.exports = { registerClientOrDeliverer, registerRestaurantAccount, login };
