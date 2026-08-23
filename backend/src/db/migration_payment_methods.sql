-- Rode este arquivo no pgAdmin (Query Tool) ou via psql no seu banco do
-- Railway. Adiciona as formas de pagamento na entrega (dinheiro, pix na
-- entrega, cartão de crédito/débito na entrega) além do que já existia
-- (Pix direto no app via Mercado Pago). Só adiciona/ajusta o que falta,
-- sem apagar nada -- pode rodar mais de uma vez.

-- Distingue se o pedido é pago ONLINE (Mercado Pago, dentro do app --
-- fluxo que já existia) ou na ENTREGA (o entregador/restaurante recebe
-- na hora, em dinheiro, cartão ou Pix). É esse campo que decide se o
-- pedido pode aparecer na fila do restaurante mesmo sem "payment_status
-- = pago" (ver orders.service.js e tenant.service.js).
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_timing TEXT NOT NULL DEFAULT 'online';
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_timing_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_timing_check
  CHECK (payment_timing IN ('online', 'entrega'));

-- Troco: quanto o cliente vai pagar em dinheiro (pra o entregador saber
-- quanto de troco levar). Só preenchido quando payment_method = 'dinheiro'
-- e o cliente não vai pagar com o valor exato.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS change_for NUMERIC(10,2);

CREATE INDEX IF NOT EXISTS idx_orders_payment_timing ON orders(payment_timing);

-- payment_method já era TEXT livre (sem CHECK) -- os novos valores usados
-- pelo app a partir de agora são:
--   'pix_entrega'      -> Pix, mas cobrado na hora da entrega
--   'dinheiro'         -> dinheiro na entrega (ver change_for)
--   'cartao_credito'   -> cartão de crédito na entrega (maquininha)
--   'cartao_debito'    -> cartão de débito na entrega (maquininha)
-- O Pix pago dentro do próprio app continua sendo gravado como 'pix'
-- (setado pelo webhook do Mercado Pago, sem mudança nesse fluxo).
