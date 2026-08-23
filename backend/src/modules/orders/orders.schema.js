const { z } = require('zod');

// 'pix_app' é o Pix pago dentro do próprio app (QR code, fluxo que já
// existia, cobrado na hora via Mercado Pago). As demais são cobradas na
// ENTREGA, pelo entregador/restaurante, sem passar pelo Mercado Pago.
const OFFLINE_PAYMENT_METHODS = ['pix_entrega', 'dinheiro', 'cartao_credito', 'cartao_debito'];
const PAYMENT_METHODS = ['pix_app', ...OFFLINE_PAYMENT_METHODS];

const createOrderSchema = z
  .object({
    restaurantId: z.string().uuid(),
    addressId: z.string().uuid({ message: 'Escolha um endereço de entrega' }),
    paymentMethod: z.enum(PAYMENT_METHODS, { errorMap: () => ({ message: 'Forma de pagamento inválida' }) }).default('pix_app'),
    // "Precisa de troco para quanto?" -- só faz sentido pra dinheiro
    changeFor: z.number().positive().max(100000).optional(),
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
  })
  .refine((data) => data.paymentMethod === 'dinheiro' || data.changeFor == null, {
    message: 'Troco só se aplica a pagamento em dinheiro',
    path: ['changeFor'],
  });

module.exports = { createOrderSchema, OFFLINE_PAYMENT_METHODS };
