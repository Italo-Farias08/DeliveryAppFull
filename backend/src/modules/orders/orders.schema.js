const { z } = require('zod');

const createOrderSchema = z.object({
  restaurantId: z.string().uuid(),
  addressId: z.string().uuid({ message: 'Escolha um endereço de entrega' }),
  items: z
    .array(
      z.object({
        menuItemId: z.string().uuid(),
        qty: z.number().int().positive(),
        // ids dos adicionais escolhidos para esse item (ex: bacon extra)
        addonIds: z.array(z.string().uuid()).optional().default([]),
        // observação do cliente pra esse item específico (ex: "sem cebola")
        notes: z.string().trim().max(300).optional(),
      })
    )
    .min(1),
});

module.exports = { createOrderSchema };
