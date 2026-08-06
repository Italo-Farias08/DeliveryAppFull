const { Router } = require('express');
const { z } = require('zod');
const asyncHandler = require('../../utils/asyncHandler');
const AppError = require('../../utils/AppError');
const { authenticate, authorize } = require('../../middlewares/auth');
const tenantContext = require('../../middlewares/tenantContext');
const messagesService = require('../messages/messages.service');
const controller = require('./tenant.controller');
const { buildUploader } = require('../../middlewares/upload');

const router = Router();

router.use(authenticate, authorize('restaurant'), tenantContext);

// Um uploader por tipo de imagem, cada um salvando na sua própria subpasta.
const logoUpload = buildUploader('restaurants/logos');
const bannerUpload = buildUploader('restaurants/banners');
const menuItemUpload = buildUploader('menu-items');

router.get('/restaurants', controller.listRestaurants);
router.post('/restaurants', controller.createRestaurant);
router.put('/restaurants/:id', controller.updateRestaurant);

// Envio de imagens do restaurante: logo e banner são independentes, cada
// rota recebe um único arquivo (multipart/form-data) e devolve o
// restaurante já atualizado com a nova URL da imagem.
router.post('/restaurants/:id/logo', logoUpload.single('logo'), controller.uploadRestaurantLogo);
router.post('/restaurants/:id/banner', bannerUpload.single('banner'), controller.uploadRestaurantBanner);

router.get('/restaurants/:restaurantId/menu-items', controller.listMenuItems);
router.post('/restaurants/:restaurantId/menu-items', controller.createMenuItem);
router.put('/menu-items/:menuItemId', controller.updateMenuItem);
router.post('/menu-items/:menuItemId/image', menuItemUpload.single('image'), controller.uploadMenuItemImage);
router.delete('/menu-items/:menuItemId', controller.deleteMenuItem);

router.get('/restaurants/:restaurantId/menu-categories', controller.listMenuCategories);
router.post('/restaurants/:restaurantId/menu-categories', controller.createMenuCategory);
router.put('/menu-categories/:categoryId', controller.updateMenuCategory);
router.delete('/menu-categories/:categoryId', controller.deleteMenuCategory);

router.get('/orders', controller.listOrders);
router.patch('/orders/:orderId/accept', controller.acceptOrder);
router.patch('/orders/:orderId/reject', controller.rejectOrder);
router.patch('/orders/:orderId/ready', controller.markOrderReady);

const messageSchema = z.object({ message: z.string().min(1).max(1000) });

router.get(
  '/orders/:orderId/messages',
  asyncHandler(async (req, res) => {
    const order = await messagesService.getOrderParties(req.params.orderId);
    if (order.tenantId !== req.tenantId) throw new AppError('Acesso negado', 403);
    res.json(await messagesService.listMessages(req.params.orderId));
  })
);

router.post(
  '/orders/:orderId/messages',
  asyncHandler(async (req, res) => {
    const { message } = messageSchema.parse(req.body);
    const order = await messagesService.getOrderParties(req.params.orderId);
    if (order.tenantId !== req.tenantId) throw new AppError('Acesso negado', 403);
    const saved = await messagesService.sendMessage(req.params.orderId, 'restaurant', req.user.sub, message);
    res.status(201).json(saved);
  })
);

module.exports = router;
