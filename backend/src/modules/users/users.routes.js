const { Router } = require('express');
const { z } = require('zod');
const { pool } = require('../../config/db');
const asyncHandler = require('../../utils/asyncHandler');
const { authenticate } = require('../../middlewares/auth');
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

module.exports = router;
