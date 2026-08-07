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
  // categoria do cardápio (Pizzas, Carnes...); null tira o item de qualquer categoria
  categoryId: z.string().uuid().nullable().optional(),
});

const menuCategorySchema = z.object({
  name: z.string().min(2),
  sortOrder: z.number().int().optional(),
});

const rejectOrderSchema = z.object({
  reason: z.string().max(300).optional(),
});

// Adicional de um item do cardápio (ex: "Bacon extra", "Borda recheada").
// price pode ser 0 (adicional sem custo), mas nunca negativo.
const addonSchema = z.object({
  name: z.string().min(1),
  price: z.number().nonnegative(),
  isAvailable: z.boolean().optional(),
});

module.exports = { restaurantSchema, menuItemSchema, menuCategorySchema, rejectOrderSchema, addonSchema };
