const { Router } = require('express');
const crypto = require('crypto');
const { z } = require('zod');
const { pool } = require('../../config/db');
const asyncHandler = require('../../utils/asyncHandler');
const { authenticate } = require('../../middlewares/auth');
const { hashPassword, comparePassword } = require('../../utils/password');
const AppError = require('../../utils/AppError');

const router = Router();

const cpfField = z
  .string()
  .transform((v) => v.replace(/\D/g, ''))
  .refine((v) => v.length === 11, { message: 'CPF deve ter 11 dígitos' });

const updateMeSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  cpf: cpfField.optional(),
});

router.use(authenticate);

// Dados da própria conta (tela "Meus dados")
router.get(
  '/me',
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      `SELECT id, name, email, role, phone, cpf, tenant_id FROM users WHERE id = $1`,
      [req.user.sub]
    );
    if (result.rowCount === 0) {
      throw new AppError('Usuário não encontrado', 404);
    }
    const user = result.rows[0];
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      cpf: user.cpf,
      tenantId: user.tenant_id || null,
    });
  })
);

router.put(
  '/me',
  asyncHandler(async (req, res) => {
    const data = updateMeSchema.parse(req.body);

    const existing = await pool.query('SELECT id FROM users WHERE email = $1 AND id <> $2', [
      data.email,
      req.user.sub,
    ]);
    if (existing.rowCount > 0) {
      throw new AppError('E-mail já cadastrado em outra conta', 409);
    }

    const result = await pool.query(
      `UPDATE users SET name = $1, email = $2, phone = $3, cpf = COALESCE($4, cpf)
       WHERE id = $5
       RETURNING id, name, email, role, phone, cpf, tenant_id`,
      [data.name, data.email, data.phone || null, data.cpf || null, req.user.sub]
    );
    if (result.rowCount === 0) {
      throw new AppError('Usuário não encontrado', 404);
    }
    const user = result.rows[0];
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      cpf: user.cpf,
      tenantId: user.tenant_id || null,
    });
  })
);

// Liga/desliga notificações (o sininho). Fica salvo no banco porque é o
// backend que decide se manda push -- mesmo com o app fechado.
const notificationsSchema = z.object({
  enabled: z.boolean(),
});

router.put(
  '/me/notifications',
  asyncHandler(async (req, res) => {
    const { enabled } = notificationsSchema.parse(req.body);

    await pool.query('UPDATE users SET notifications_enabled = $1 WHERE id = $2', [
      enabled,
      req.user.sub,
    ]);

    // se a pessoa desligou, apagamos os tokens dela: assim nem sobra
    // nada guardado tentando mandar push pra quem não quer receber.
    if (!enabled) {
      await pool.query('DELETE FROM push_tokens WHERE user_id = $1', [req.user.sub]);
    }

    res.json({ enabled });
  })
);

// Salva o token de push (Expo) deste dispositivo. Chamado sempre que o
// app abre com notificações ligadas, pra manter o token atualizado.
const pushTokenSchema = z.object({
  token: z.string().min(10),
  platform: z.enum(['ios', 'android']).optional(),
});

router.put(
  '/me/push-token',
  asyncHandler(async (req, res) => {
    const { token, platform } = pushTokenSchema.parse(req.body);

    await pool.query(
      `INSERT INTO push_tokens (user_id, token, platform)
       VALUES ($1, $2, $3)
       ON CONFLICT (token) DO UPDATE SET user_id = $1, platform = $3`,
      [req.user.sub, token, platform || null]
    );

    res.status(204).send();
  })
);

// Remove o token deste dispositivo (chamado ao desligar o sininho ou
// fazer logout, pra não continuar mandando push pra esse aparelho).
router.delete(
  '/me/push-token',
  asyncHandler(async (req, res) => {
    const { token } = z.object({ token: z.string().min(10) }).parse(req.body);
    await pool.query('DELETE FROM push_tokens WHERE token = $1 AND user_id = $2', [
      token,
      req.user.sub,
    ]);
    res.status(204).send();
  })
);

// Exclusão de conta. Exige a senha atual (mesmo já autenticado com token)
// como segunda confirmação, pra reduzir o risco de alguém apagar a conta
// por engano ou de um token roubado apagar a conta sozinho.
const deleteMeSchema = z.object({
  password: z.string().min(1, 'Informe sua senha para confirmar'),
});

router.delete(
  '/me',
  asyncHandler(async (req, res) => {
    const { password } = deleteMeSchema.parse(req.body);

    const result = await pool.query(
      `SELECT id, email, role, tenant_id, password_hash, deleted_at FROM users WHERE id = $1`,
      [req.user.sub]
    );
    if (result.rowCount === 0) {
      throw new AppError('Usuário não encontrado', 404);
    }
    const user = result.rows[0];
    if (user.deleted_at) {
      throw new AppError('Esta conta já foi excluída', 410);
    }

    const valid = await comparePassword(password, user.password_hash);
    if (!valid) {
      throw new AppError('Senha incorreta', 401);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Anonimiza os dados pessoais (mantendo a linha por causa do
      // histórico de pedidos) e libera o e-mail original pra um novo
      // cadastro futuro. A senha vira um hash aleatório inutilizável --
      // ninguém consegue mais fazer login nessa conta.
      const placeholderEmail = `conta-excluida-${user.id}@removido.local`;
      const unusablePasswordHash = await hashPassword(crypto.randomBytes(32).toString('hex'));
      await client.query(
        `UPDATE users
         SET name = 'Usuário removido', email = $1, phone = NULL, cpf = NULL,
             password_hash = $2, notifications_enabled = false, deleted_at = now()
         WHERE id = $3`,
        [placeholderEmail, unusablePasswordHash, user.id]
      );

      // Remove dados que só fazem sentido pra uma conta ativa.
      await client.query('DELETE FROM addresses WHERE user_id = $1', [user.id]);
      await client.query('DELETE FROM favorites WHERE user_id = $1', [user.id]);
      await client.query('DELETE FROM push_tokens WHERE user_id = $1', [user.id]);

      // Invalida qualquer código de login/recuperação de senha pendente
      // pro e-mail antigo.
      await client.query('DELETE FROM login_verification_codes WHERE email = $1', [user.email]);
      await client.query('DELETE FROM password_reset_codes WHERE email = $1', [user.email]);

      if (user.role === 'deliverer') {
        // Tira do radar de corridas na hora -- não pode continuar
        // recebendo pedidos com a conta excluída.
        await client.query('UPDATE deliverer_profiles SET is_available = false WHERE user_id = $1', [
          user.id,
        ]);
      }

      if (user.role === 'restaurant' && user.tenant_id) {
        // Fecha a loja: some da home/busca do cliente e para de aceitar
        // pedidos novos. Cardápio e pedidos antigos ficam intactos.
        await client.query(`UPDATE tenants SET status = 'closed' WHERE id = $1`, [user.tenant_id]);
        await client.query(
          `UPDATE restaurants SET is_published = false, is_open = false WHERE tenant_id = $1`,
          [user.tenant_id]
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    res.status(204).send();
  })
);

module.exports = router;
