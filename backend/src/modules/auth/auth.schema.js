const { z } = require('zod');

const cpfField = z
  .string()
  .transform((v) => v.replace(/\D/g, ''))
  .refine((v) => v.length === 11, { message: 'CPF deve ter 11 dígitos' });

const cnpjField = z
  .string()
  .transform((v) => v.replace(/\D/g, ''))
  .refine((v) => v.length === 14, { message: 'CNPJ deve ter 14 dígitos' });

const plateField = z
  .string()
  .transform((v) => v.replace(/[^A-Za-z0-9]/g, '').toUpperCase())
  .refine((v) => v.length === 7, { message: 'Placa inválida' });

const baseFields = {
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().optional(),
};

const registerSchema = z
  .discriminatedUnion('role', [
    z.object({
      role: z.literal('client'),
      ...baseFields,
      cpf: cpfField,
    }),
    z.object({
      role: z.literal('deliverer'),
      ...baseFields,
      cpf: cpfField,
      vehicleType: z.enum(['moto', 'bike', 'carro']).default('moto'),
      vehiclePlate: plateField.optional(),
    }),
    z.object({
      role: z.literal('restaurant'),
      ...baseFields,
      businessName: z.string().min(2),
      cnpj: cnpjField,
    }),
  ])
  .superRefine((data, ctx) => {
    if (data.role === 'deliverer' && data.vehicleType !== 'bike' && !data.vehiclePlate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Placa é obrigatória para moto ou carro',
        path: ['vehiclePlate'],
      });
    }
  });

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const verifyCodeSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

module.exports = { registerSchema, loginSchema, verifyCodeSchema };