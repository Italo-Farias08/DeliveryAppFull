const { Router } = require('express');
const { z } = require('zod');
const { pool } = require('../../config/db');
const asyncHandler = require('../../utils/asyncHandler');
const { authenticate } = require('../../middlewares/auth');

const router = Router();

const addressSchema = z.object({
  label: z.string().optional(),
  street: z.string().min(2),
  number: z.string().optional(),
  complement: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().min(2),
  state: z.string().min(2),
  zip: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

router.use(authenticate);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      `SELECT id, label, street, number, complement, neighborhood, city, state, zip, lat, lng
       FROM addresses WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.sub]
    );
    res.json(result.rows);
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = addressSchema.parse(req.body);
    const result = await pool.query(
      `INSERT INTO addresses (user_id, label, street, number, complement, neighborhood, city, state, zip, lat, lng)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, label, street, number, complement, neighborhood, city, state, zip, lat, lng`,
      [req.user.sub, data.label || null, data.street, data.number || null, data.complement || null,
       data.neighborhood || null, data.city, data.state, data.zip || null, data.lat || null, data.lng || null]
    );
    res.status(201).json(result.rows[0]);
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      `DELETE FROM addresses WHERE id = $1 AND user_id = $2 RETURNING id`,
      [req.params.id, req.user.sub]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Endereço não encontrado.' });
    }
    res.status(204).send();
  })
);

module.exports = router;
