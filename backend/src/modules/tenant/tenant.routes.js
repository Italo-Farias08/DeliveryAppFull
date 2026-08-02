const { Router } = require('express');
const { authenticate, authorize } = require('../../middlewares/auth');
const tenantContext = require('../../middlewares/tenantContext');
const controller = require('./tenant.controller');

const router = Router();

router.use(authenticate, authorize('restaurant'), tenantContext);

router.get('/restaurants', controller.listRestaurants);
router.post('/restaurants', controller.createRestaurant);
router.put('/restaurants/:id', controller.updateRestaurant);

router.get('/restaurants/:restaurantId/menu-items', controller.listMenuItems);
router.post('/restaurants/:restaurantId/menu-items', controller.createMenuItem);
router.put('/menu-items/:menuItemId', controller.updateMenuItem);
router.delete('/menu-items/:menuItemId', controller.deleteMenuItem);

router.get('/orders', controller.listOrders);
router.patch('/orders/:orderId/status', controller.updateOrderStatus);

module.exports = router;
