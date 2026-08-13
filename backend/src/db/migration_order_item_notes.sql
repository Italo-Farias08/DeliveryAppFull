-- Rode este arquivo no pgAdmin (Query Tool) no seu banco do Railway.
-- Adiciona OBSERVAÇÃO por item do pedido (ex: "sem cebola", "ponto da carne
-- bem passado") e separa os ADICIONAIS escolhidos num campo próprio, em vez
-- de ficarem colados dentro de name_snapshot (ex: "X-Burger (+ bacon)").
-- Isso permite mostrar cada informação separada na tela do restaurante.
-- Só adiciona o que falta, sem apagar nada.

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS addons_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb;
