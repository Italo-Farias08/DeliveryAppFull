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

module.exports = router;
