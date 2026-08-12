const { pool } = require('../../config/db');
const { hashPassword, comparePassword } = require('../../utils/password');
const { signToken } = require('../../utils/jwt');
const { sendLoginCodeEmail, sendPasswordResetEmail } = require('../../utils/email');
const AppError = require('../../utils/AppError');

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6 dígitos
}

async function registerClientOrDeliverer({ name, email, password, role, phone, cpf, inviteCode }) {
  console.log('DEBUG REGISTER >>>', JSON.stringify({ email, passwordLength: password?.length }));
  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rowCount > 0) {
    throw new AppError('E-mail já cadastrado', 409);
  }

  // Se o entregador informou o código do restaurante, valida ANTES de criar
  // a conta -- assim ele fica sabendo na hora se digitou errado, em vez de
  // criar a conta e só depois descobrir que não vinculou com ninguém.
  let ownerTenantId = null;
  if (role === 'deliverer' && inviteCode) {
    const tenantResult = await pool.query('SELECT id FROM tenants WHERE deliverer_invite_code = $1', [
      inviteCode.toUpperCase(),
    ]);
    if (tenantResult.rowCount === 0) {
      throw new AppError('Código do restaurante inválido — confira com o restaurante e tente de novo', 400);
    }
    ownerTenantId = tenantResult.rows[0].id;
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
    await pool.query('INSERT INTO deliverer_profiles (user_id, tenant_id) VALUES ($1, $2)', [
      user.id,
      ownerTenantId,
    ]);
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

async function requestPasswordReset({ email }) {
  const result = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  // Não revela se o e-mail existe ou não — sempre responde "pending" pro front,
  // só manda o código de verdade se o usuário existir.
  if (result.rowCount > 0) {
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos
    await pool.query(
      'INSERT INTO password_reset_codes (email, code, expires_at) VALUES ($1, $2, $3)',
      [email, code, expiresAt]
    );
    try {
      await sendPasswordResetEmail(email, code);
    } catch (emailErr) {
      console.error('[password-reset] falha ao enviar e-mail, seguindo mesmo assim:', emailErr.message);
      console.warn(`[password-reset] Código para ${email}: ${code}`);
    }
  } else {
    console.warn(`[password-reset] tentativa de reset para e-mail não cadastrado: ${email}`);
  }
  return { pending: true, email };
}

async function resetPassword({ email, code, newPassword }) {
  const result = await pool.query(
    `SELECT id FROM password_reset_codes
     WHERE email = $1 AND code = $2 AND used = false AND expires_at > now()
     ORDER BY created_at DESC LIMIT 1`,
    [email, code]
  );
  if (result.rowCount === 0) {
    throw new AppError('Código inválido ou expirado', 401);
  }

  const passwordHash = await hashPassword(newPassword);
  const updateResult = await pool.query(
    'UPDATE users SET password_hash = $1 WHERE email = $2 RETURNING id',
    [passwordHash, email]
  );
  if (updateResult.rowCount === 0) {
    throw new AppError('Usuário não encontrado', 404);
  }

  await pool.query('UPDATE password_reset_codes SET used = true WHERE id = $1', [result.rows[0].id]);

  return { success: true };
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
  requestPasswordReset,
  resetPassword,
};
