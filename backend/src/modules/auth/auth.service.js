const { pool } = require('../../config/db');
const { hashPassword, comparePassword } = require('../../utils/password');
const { signToken } = require('../../utils/jwt');
const { sendLoginCodeEmail } = require('../../utils/email');
const AppError = require('../../utils/AppError');

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6 dígitos
}

async function registerClientOrDeliverer({ name, email, password, role, phone, cpf }) {
  console.log('DEBUG REGISTER >>>', JSON.stringify({ email, passwordLength: password?.length }));
  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rowCount > 0) {
    throw new AppError('E-mail já cadastrado', 409);
  }
  const passwordHash = await hashPassword(password);
  const result = await pool.query(
    `INSERT INTO users (name, email, password_hash, role, phone, cpf)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, name, email, role, tenant_id`,
    [name, email, passwordHash, role, phone || null, cpf]
  );
  const user = result.rows[0];
  if (role === 'deliverer') {
    await pool.query('INSERT INTO deliverer_profiles (user_id) VALUES ($1)', [user.id]);
  }
  return buildAuthResponse(user);
}

async function registerRestaurantAccount({ name, email, password, phone, cpf, businessName, cnpj }) {
  const document = cnpj;
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
      `INSERT INTO users (tenant_id, name, email, password_hash, role, phone, cpf)
       VALUES ($1, $2, $3, $4, 'restaurant', $5, $6)
       RETURNING id, name, email, role, tenant_id`,
      [tenant.id, name, email, passwordHash, phone || null, cpf]
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

async function requestLoginCode({ email, password }) {
  console.log('DEBUG LOGIN >>>', JSON.stringify({ email, passwordLength: password?.length }));
  const result = await pool.query(
    'SELECT id, name, email, password_hash, role, tenant_id FROM users WHERE email = $1',
    [email]
  );
  if (result.rowCount === 0) {
    console.log('DEBUG LOGIN >>> e-mail não encontrado no banco');
    throw new AppError('Credenciais inválidas', 401);
  }
  const user = result.rows[0];
  const valid = await comparePassword(password, user.password_hash);
  if (!valid) {
    console.log('DEBUG LOGIN >>> e-mail encontrado, mas senha não bateu com o hash salvo');
    throw new AppError('Credenciais inválidas', 401);
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

  await pool.query(
    'INSERT INTO login_verification_codes (email, code, expires_at) VALUES ($1, $2, $3)',
    [email, code, expiresAt]
  );

  try {
    try {
    await sendLoginCodeEmail(email, code);
  } catch (emailErr) {
    console.error('DEBUG LOGIN >>> falha ao enviar e-mail do código, seguindo mesmo assim:', emailErr.message);
    console.warn(`[email] Código de verificação para ${email}: ${code}`);
  }
  } catch (emailErr) {
    console.error('DEBUG LOGIN >>> falha ao enviar e-mail do código, seguindo mesmo assim:', emailErr.message);
    console.warn(`[email] Código de verificação para ${email}: ${code}`);
  }

  return { pending: true, email };
}

async function verifyLoginCode({ email, code }) {
  const result = await pool.query(
    `SELECT id FROM login_verification_codes
     WHERE email = $1 AND code = $2 AND used = false AND expires_at > now()
     ORDER BY created_at DESC LIMIT 1`,
    [email, code]
  );
  if (result.rowCount === 0) {
    throw new AppError('Código inválido ou expirado', 401);
  }

  await pool.query('UPDATE login_verification_codes SET used = true WHERE id = $1', [
    result.rows[0].id,
  ]);

  const userResult = await pool.query(
    'SELECT id, name, email, role, tenant_id FROM users WHERE email = $1',
    [email]
  );
  if (userResult.rowCount === 0) {
    throw new AppError('Usuário não encontrado', 404);
  }

  return buildAuthResponse(userResult.rows[0]);
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

module.exports = {
  registerClientOrDeliverer,
  registerRestaurantAccount,
  requestLoginCode,
  verifyLoginCode,
};
