-- Rode este arquivo no pgAdmin (Query Tool) no seu banco do Railway.
-- Adiciona a coluna de CPF na tabela de usuários.

ALTER TABLE users ADD COLUMN IF NOT EXISTS cpf TEXT;
