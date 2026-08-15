-- Rode este arquivo no pgAdmin (Query Tool) no seu banco do Railway.
-- Valor mínimo do pedido: o próprio restaurante define e controla.

ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS min_order_value NUMERIC(10,2) NOT NULL DEFAULT 0;
