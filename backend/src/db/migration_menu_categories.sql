-- Rode este arquivo no pgAdmin (Query Tool) no seu banco do Railway.
-- Adiciona categorias DENTRO do cardápio de cada restaurante
-- (ex: Pizzas, Carnes, Hambúrgueres), diferente da tabela "categories"
-- que já existia (essa é o TIPO do restaurante: Pizzaria, Hamburgueria).
-- Só adiciona o que falta, sem apagar nada.

CREATE TABLE IF NOT EXISTS menu_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_menu_categories_restaurant_id ON menu_categories(restaurant_id);

ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES menu_categories(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_menu_items_category_id ON menu_items(category_id);

ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_categories FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS menu_categories_public_read ON menu_categories;
CREATE POLICY menu_categories_public_read ON menu_categories
  FOR SELECT USING (true);

DROP POLICY IF EXISTS menu_categories_tenant_write ON menu_categories;
CREATE POLICY menu_categories_tenant_write ON menu_categories
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

DROP POLICY IF EXISTS menu_categories_tenant_update ON menu_categories;
CREATE POLICY menu_categories_tenant_update ON menu_categories
  FOR UPDATE USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

DROP POLICY IF EXISTS menu_categories_tenant_delete ON menu_categories;
CREATE POLICY menu_categories_tenant_delete ON menu_categories
  FOR DELETE USING (tenant_id = current_setting('app.current_tenant', true)::uuid);
