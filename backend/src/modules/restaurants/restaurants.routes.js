const { Router } = require('express');
const asyncHandler = require('../../utils/asyncHandler');
const service = require('./restaurants.service');
const AppError = require('../../utils/AppError');

const router = Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { categoryId } = req.query;
    const restaurants = await service.listRestaurants(categoryId);
    res.json(restaurants);
  })
);

router.get(
  '/search',
  asyncHandler(async (req, res) => {
    const q = req.query.q || '';
    if (!q.trim()) return res.json([]);
    const restaurants = await service.search(q);
    res.json(restaurants);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const restaurant = await service.getRestaurantById(req.params.id);
    if (!restaurant) throw new AppError('Restaurante não encontrado', 404);
    res.json(restaurant);
  })
);

module.exports = router;
