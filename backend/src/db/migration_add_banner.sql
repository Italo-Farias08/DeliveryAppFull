-- Rode este arquivo no pgAdmin (Query Tool) no seu banco do Railway.
-- Adiciona a coluna de banner (foto de capa) do restaurante.
-- A coluna "image" continua existindo e passa a ser usada como logo.
-- Só adiciona o que falta, sem apagar nada.

ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS banner TEXT;
