-- Rode este arquivo no pgAdmin (Query Tool) no seu banco do Railway.
-- Ele reorganiza o fluxo de status do pedido e adiciona os códigos de
-- verificação de retirada (restaurante) e de entrega (cliente).
-- Só adiciona/ajusta o que falta, sem apagar nada.

-- 1) Novas colunas em orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_code CHAR(4);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_code CHAR(4);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ready_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- 2) Preenche códigos para pedidos antigos que ainda não têm (evita NOT NULL falhar)
UPDATE orders
SET pickup_code = LPAD(FLOOR(random() * 10000)::text, 4, '0')
WHERE pickup_code IS NULL;

UPDATE orders
SET delivery_code = LPAD(FLOOR(random() * 10000)::text, 4, '0')
WHERE delivery_code IS NULL;

ALTER TABLE orders ALTER COLUMN pickup_code SET NOT NULL;
ALTER TABLE orders ALTER COLUMN delivery_code SET NOT NULL;

-- 3) Migra os status antigos para o novo fluxo antes de trocar a constraint
UPDATE orders SET status = 'procurando_entregador' WHERE status = 'preparando' AND deliverer_id IS NULL;
UPDATE orders SET status = 'a_caminho' WHERE status = 'a caminho';
-- pedidos que já estavam "preparando" mas já tinham entregador viram a_caminho também
UPDATE orders SET status = 'a_caminho' WHERE status = 'preparando' AND deliverer_id IS NOT NULL;

-- 4) Troca a constraint de status para o novo fluxo
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN (
  'pendente', 'preparando', 'procurando_entregador', 'a_caminho', 'entregue', 'cancelado'
));

CREATE INDEX IF NOT EXISTS idx_orders_status_radar ON orders(status) WHERE deliverer_id IS NULL;
