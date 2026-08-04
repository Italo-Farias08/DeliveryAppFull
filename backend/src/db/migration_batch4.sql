-- Rode este arquivo no pgAdmin (Query Tool) no seu banco do Railway.
-- Adiciona: recuperação de senha, chat pedido<->restaurante e dados de
-- endereço/telefone do cliente para o painel do restaurante.
-- Só adiciona o que falta, sem apagar nada.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Recuperação de senha (código por e-mail, mesmo padrão do login)
CREATE TABLE IF NOT EXISTS password_reset_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_password_reset_codes_email ON password_reset_codes(email);

-- 2) Mensagens entre restaurante e cliente, por pedido
CREATE TABLE IF NOT EXISTS order_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('client', 'restaurant')),
  sender_id UUID NOT NULL REFERENCES users(id),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_order_messages_order_id ON order_messages(order_id);
