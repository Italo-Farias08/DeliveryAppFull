-- Rode este arquivo no pgAdmin (Query Tool) no seu banco do Railway.
-- Adiciona o endereço/GPS do restaurante (a loja em si), usado na aba
-- "Localização" do painel do restaurante e pra o entregador conseguir
-- navegar até a loja na hora de retirar o pedido.
-- Só adiciona o que falta, sem apagar nada.

ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS street TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS number TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS complement TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS neighborhood TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS zip TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
