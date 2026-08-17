const { Router } = require('express');
const asyncHandler = require('../../utils/asyncHandler');
const service = require('./restaurants.service');
const AppError = require('../../utils/AppError');

const router = Router();

// Lat/lng são opcionais -- se o cliente não mandou (sem permissão de
// localização, por exemplo), os services simplesmente não filtram por
// distância e voltam a se comportar como antes.
function parseCoord(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { categoryId } = req.query;
    const lat = parseCoord(req.query.lat);
    const lng = parseCoord(req.query.lng);
    const restaurants = await service.listRestaurants(categoryId, lat, lng);
    res.json(restaurants);
  })
);

router.get(
  '/search',
  asyncHandler(async (req, res) => {
    const q = req.query.q || '';
    if (!q.trim()) return res.json([]);
    const lat = parseCoord(req.query.lat);
    const lng = parseCoord(req.query.lng);
    const restaurants = await service.search(q, lat, lng);
    res.json(restaurants);
  })
);

router.get(
  '/search-items',
  asyncHandler(async (req, res) => {
    const q = req.query.q || '';
    if (!q.trim()) return res.json([]);
    const lat = parseCoord(req.query.lat);
    const lng = parseCoord(req.query.lng);
    const items = await service.searchItems(q, lat, lng);
    res.json(items);
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
