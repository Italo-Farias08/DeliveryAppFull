-- Rode este arquivo no pgAdmin (Query Tool) ou via psql no seu banco do
-- Railway. Pagamento real via Mercado Pago + controle de comissão da
-- plataforma (12% por padrão, configurável via COMMISSION_RATE no .env) que
-- cada restaurante (tenant) acumula e quita manualmente toda semana.
-- Só adiciona/ajusta o que falta, sem apagar nada — pode rodar mais de uma vez.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pendente';
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_status_check
  CHECK (payment_status IN ('pendente', 'pago', 'recusado', 'estornado'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT; -- pix | credit_card | debit_card
ALTER TABLE orders ADD COLUMN IF NOT EXISTS mp_preference_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS mp_payment_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
-- comissão da plataforma sobre esse pedido, travada no momento do
-- pagamento (assim, se a taxa mudar no futuro, pedidos antigos não mudam)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS commission_amount NUMERIC(10,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS settlement_id UUID;

CREATE INDEX IF NOT EXISTS idx_orders_mp_payment_id ON orders(mp_payment_id);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
-- pedidos pagos e ainda não incluídos em nenhum acerto semanal (consulta
-- mais comum: "quanto esse restaurante me deve agora")
CREATE INDEX IF NOT EXISTS idx_orders_pending_settlement
  ON orders(tenant_id) WHERE payment_status = 'pago' AND settlement_id IS NULL;

-- Um "fechamento" semanal por tenant: soma tudo que foi pago naquela janela
-- e trava o valor de comissão devido. O restaurante paga esse valor por
-- fora (Pix, transferência etc.) e você marca como quitado manualmente.
CREATE TABLE IF NOT EXISTS settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  orders_count INTEGER NOT NULL DEFAULT 0,
  gross_amount NUMERIC(10,2) NOT NULL DEFAULT 0, -- soma dos subtotais pagos no período
  commission_rate NUMERIC(5,2) NOT NULL,
  commission_amount NUMERIC(10,2) NOT NULL DEFAULT 0, -- quanto o restaurante deve repassar
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_settlements_tenant_id ON settlements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_settlements_status ON settlements(status);

ALTER TABLE orders DROP CONSTRAINT IF EXISTS fk_orders_settlement;
ALTER TABLE orders
  ADD CONSTRAINT fk_orders_settlement FOREIGN KEY (settlement_id) REFERENCES settlements(id);
