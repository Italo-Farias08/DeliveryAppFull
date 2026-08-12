-- Rode este arquivo no pgAdmin (Query Tool) no seu banco do Railway,
-- ou via: psql "$DATABASE_URL" -f src/db/migration_own_deliverer.sql
--
-- Suporte a "entregador da casa": o restaurante pode ter entregadores
-- próprios, exclusivos, em vez de sempre depender do radar de
-- entregadores autônomos.

ALTER TABLE deliverer_profiles ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_deliverer_profiles_tenant_id ON deliverer_profiles(tenant_id);

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS deliverer_invite_code TEXT UNIQUE;
