const { z } = require('zod');

// image/banner aqui não são mais obrigatoriamente URL externa: o upload
// (logo, banner e foto do item) tem rota própria com multipart/form-data e
// grava a URL do arquivo salvo no servidor. Esses campos ficam como texto
// livre e opcional só para não quebrar quem ainda envia um link manual.
const restaurantSchema = z.object({
  name: z.string().min(2),
  categoryId: z.string().uuid(),
  deliveryTimeMin: z.number().int().positive(),
  deliveryTimeMax: z.number().int().positive(),
  deliveryFee: z.number().nonnegative(),
  image: z.string().optional(),
  banner: z.string().optional(),
  isOpen: z.boolean().optional(),
});

const menuItemSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  price: z.number().positive(),
  image: z.string().optional(),
  isAvailable: z.boolean().optional(),
});

const rejectOrderSchema = z.object({
  reason: z.string().max(300).optional(),
});

module.exports = { restaurantSchema, menuItemSchema, rejectOrderSchema };
