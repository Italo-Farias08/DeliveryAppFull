const { z } = require('zod');

const createOrderSchema = z.object({
  restaurantId: z.string().uuid(),
  addressId: z.string().uuid({ message: 'Escolha um endereço de entrega' }),
  items: z
    .array(
      z.object({
        menuItemId: z.string().uuid(),
        qty: z.number().int().positive(),
      })
    )
    .min(1),
});

module.exports = { createOrderSchema };
