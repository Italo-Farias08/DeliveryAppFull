-- Rode este arquivo no pgAdmin (Query Tool) ou via psql no seu banco do
-- Railway. Adiciona a SEPARAÇÃO online (Pix dentro do app) x entrega
-- (dinheiro/cartão/Pix por fora) dentro de cada fechamento semanal, além do
-- total combinado que já existia (gross_amount / commission_amount).
-- Só adiciona o que falta, sem apagar nada -- pode rodar mais de uma vez.

-- gross_amount (já existente) continua sendo só a parte online, igual
-- sempre foi -- online_gross_amount é o mesmo valor, só que com nome
-- explícito, pra não depender de comentário pra entender o que é o quê.
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS online_orders_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS online_gross_amount NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS online_commission_amount NUMERIC(10,2) NOT NULL DEFAULT 0;

-- Parte que caiu direto com o restaurante (dinheiro, cartão na maquininha,
-- Pix cobrado na entrega) -- não soma no gross_amount/repasse porque esse
-- dinheiro nunca passou pela conta da plataforma; só a comissão dela é que
-- vira dívida do restaurante com a plataforma.
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS offline_orders_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS offline_gross_amount NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS offline_commission_amount NUMERIC(10,2) NOT NULL DEFAULT 0;
