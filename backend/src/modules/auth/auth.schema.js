const { z } = require('zod');

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().optional(),
  cpf: z
    .string()
    .transform((v) => v.replace(/\D/g, ''))
    .refine((v) => v.length === 11, { message: 'CPF deve ter 11 dígitos' }),
  role: z.enum(['client', 'restaurant', 'deliverer']),
  businessName: z.string().optional(),
  document: z.string().optional(),
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
