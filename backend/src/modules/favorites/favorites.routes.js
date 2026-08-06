const { Router } = require('express');
const { z } = require('zod');
const { pool } = require('../../config/db');
const asyncHandler = require('../../utils/asyncHandler');
const { authenticate } = require('../../middlewares/auth');
const AppError = require('../../utils/AppError');

const router = Router();

const addFavoriteSchema = z.object({
  restaurantId: z.string().uuid(),
});

router.use(authenticate);

// Lista os restaurantes favoritados pelo usuário logado, com os mesmos
// campos que a Home/Search já usam pra desenhar o card do restaurante.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      `SELECT r.id, r.tenant_id AS "tenantId", r.category_id AS "categoryId", r.name, r.rating,
              r.delivery_time_min AS "deliveryTimeMin", r.delivery_time_max AS "deliveryTimeMax",
              r.delivery_fee AS "deliveryFee", r.image, r.banner, r.is_open AS "isOpen"
       FROM favorites f
       JOIN restaurants r ON r.id = f.restaurant_id
       WHERE f.user_id = $1
       ORDER BY f.created_at DESC`,
      [req.user.sub]
    );
    res.json(result.rows);
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { restaurantId } = addFavoriteSchema.parse(req.body);

    const restaurant = await pool.query('SELECT id FROM restaurants WHERE id = $1', [restaurantId]);
    if (restaurant.rowCount === 0) {
      throw new AppError('Restaurante não encontrado', 404);
    }

    await pool.query(
      `INSERT INTO favorites (user_id, restaurant_id) VALUES ($1, $2)
       ON CONFLICT (user_id, restaurant_id) DO NOTHING`,
      [req.user.sub, restaurantId]
    );
    res.status(201).json({ restaurantId });
  })
);

router.delete(
  '/:restaurantId',
  asyncHandler(async (req, res) => {
    await pool.query('DELETE FROM favorites WHERE user_id = $1 AND restaurant_id = $2', [
      req.user.sub,
      req.params.restaurantId,
    ]);
    res.status(204).send();
  })
);

module.exports = router;
