const { z } = require('zod');

const restaurantSchema = z.object({
  name: z.string().min(2),
  categoryId: z.string().uuid(),
  deliveryTimeMin: z.number().int().positive(),
  deliveryTimeMax: z.number().int().positive(),
  deliveryFee: z.number().nonnegative(),
  image: z.string().url().optional(),
  isOpen: z.boolean().optional(),
});

const menuItemSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  price: z.number().positive(),
  image: z.string().url().optional(),
  isAvailable: z.boolean().optional(),
});

const orderStatusSchema = z.object({
  status: z.enum(['preparando', 'a caminho', 'entregue', 'cancelado']),
});

module.exports = { restaurantSchema, menuItemSchema, orderStatusSchema };
