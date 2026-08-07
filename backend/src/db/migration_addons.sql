-- Rode este arquivo no pgAdmin (Query Tool) no seu banco do Railway.
-- Adiciona os ADICIONAIS de um item do cardápio (ex: bacon extra, borda
-- recheada, ponto da carne). O restaurante controla tudo (cria, edita,
-- apaga) e o preço de cada adicional escolhido é somado ao preço do item.
-- Só adiciona o que falta, sem apagar nada.

CREATE TABLE IF NOT EXISTS menu_item_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_menu_item_addons_menu_item_id ON menu_item_addons(menu_item_id);

ALTER TABLE menu_item_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_item_addons FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS menu_item_addons_public_read ON menu_item_addons;
CREATE POLICY menu_item_addons_public_read ON menu_item_addons
  FOR SELECT USING (true);

DROP POLICY IF EXISTS menu_item_addons_tenant_write ON menu_item_addons;
CREATE POLICY menu_item_addons_tenant_write ON menu_item_addons
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

DROP POLICY IF EXISTS menu_item_addons_tenant_update ON menu_item_addons;
CREATE POLICY menu_item_addons_tenant_update ON menu_item_addons
  FOR UPDATE USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

DROP POLICY IF EXISTS menu_item_addons_tenant_delete ON menu_item_addons;
CREATE POLICY menu_item_addons_tenant_delete ON menu_item_addons
  FOR DELETE USING (tenant_id = current_setting('app.current_tenant', true)::uuid);
