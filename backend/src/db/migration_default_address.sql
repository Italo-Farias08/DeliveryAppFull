-- Rode este arquivo no pgAdmin (Query Tool) no seu banco do Railway.
-- Adiciona a possibilidade de o cliente fixar um endereço principal.

ALTER TABLE addresses ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;

-- garante no máximo 1 endereço principal por cliente
CREATE UNIQUE INDEX IF NOT EXISTS idx_addresses_one_default_per_user ON addresses(user_id) WHERE is_default;
