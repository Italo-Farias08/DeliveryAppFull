const { Router } = require('express');
const { z } = require('zod');
const { pool } = require('../../config/db');
const asyncHandler = require('../../utils/asyncHandler');
const { authenticate, authorize } = require('../../middlewares/auth');
const AppError = require('../../utils/AppError');

const router = Router();

router.use(authenticate, authorize('deliverer'));

router.get(
  '/orders/available',
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      `SELECT o.id, o.status, o.total, o.created_at AS "createdAt", r.name AS "restaurantName"
       FROM orders o
       JOIN restaurants r ON r.id = o.restaurant_id
       WHERE o.status = 'preparando' AND o.deliverer_id IS NULL
       ORDER BY o.created_at ASC`
    );
    res.json(result.rows);
  })
);

router.get(
  '/orders/mine',
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      `SELECT o.id, o.status, o.total, o.created_at AS "createdAt", r.name AS "restaurantName"
       FROM orders o
       JOIN restaurants r ON r.id = o.restaurant_id
       WHERE o.deliverer_id = $1
       ORDER BY o.created_at DESC`,
      [req.user.sub]
    );
    res.json(result.rows);
  })
);

router.patch(
  '/orders/:id/accept',
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      `UPDATE orders SET deliverer_id = $1, status = 'a caminho'
       WHERE id = $2 AND deliverer_id IS NULL
       RETURNING id, status`,
      [req.user.sub, req.params.id]
    );
    if (result.rowCount === 0) throw new AppError('Pedido indisponível para aceite', 409);
    res.json(result.rows[0]);
  })
);

const statusSchema = z.object({
  status: z.enum(['a caminho', 'entregue']),
});

router.patch(
  '/orders/:id/status',
  asyncHandler(async (req, res) => {
    const { status } = statusSchema.parse(req.body);
    const result = await pool.query(
      `UPDATE orders SET status = $1
       WHERE id = $2 AND deliverer_id = $3
       RETURNING id, status`,
      [status, req.params.id, req.user.sub]
    );
    if (result.rowCount === 0) throw new AppError('Pedido não encontrado para este entregador', 404);
    res.json(result.rows[0]);
  })
);

module.exports = router;
