CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  document TEXT UNIQUE,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  -- Código curto que o restaurante compartilha com o próprio entregador
  -- pra ele se vincular no cadastro (em vez de virar autônomo/marketplace).
  deliverer_invite_code TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('client', 'restaurant', 'deliverer')),
  phone TEXT,
  cpf TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tenant_required_for_restaurant CHECK (
    (role = 'restaurant' AND tenant_id IS NOT NULL) OR (role <> 'restaurant')
  )
);

CREATE INDEX idx_users_tenant_id ON users(tenant_id);

CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  icon TEXT NOT NULL
);

CREATE TABLE restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id),
  name TEXT NOT NULL,
  rating NUMERIC(2,1) NOT NULL DEFAULT 0,
  delivery_time_min INT NOT NULL DEFAULT 20,
  delivery_time_max INT NOT NULL DEFAULT 40,
  delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  image TEXT,
  banner TEXT,
  is_open BOOLEAN NOT NULL DEFAULT true,
  -- Endereço/GPS da loja em si (não confundir com endereço de entrega do
  -- cliente): usado na aba "Localização" do painel e pra o entregador
  -- achar a loja na hora de retirar o pedido.
  street TEXT,
  number TEXT,
  complement TEXT,
  neighborhood TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_restaurants_tenant_id ON restaurants(tenant_id);
CREATE INDEX idx_restaurants_category_id ON restaurants(category_id);

CREATE TABLE menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL,
  image TEXT,
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_menu_items_tenant_id ON menu_items(tenant_id);
CREATE INDEX idx_menu_items_restaurant_id ON menu_items(restaurant_id);

-- Categorias DENTRO do cardápio de um restaurante (ex: Pizzas, Carnes,
-- Hambúrgueres). Diferente da tabela "categories" acima, que é o TIPO do
-- restaurante (Pizzaria, Hamburgueria) usado nos filtros da home do cliente.
CREATE TABLE menu_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_menu_categories_restaurant_id ON menu_categories(restaurant_id);

ALTER TABLE menu_items ADD COLUMN category_id UUID REFERENCES menu_categories(id) ON DELETE SET NULL;
CREATE INDEX idx_menu_items_category_id ON menu_items(category_id);

-- Adicionais de um item do cardápio (ex: bacon extra, borda recheada).
-- O restaurante tem controle total (criar, editar, apagar) e o preço de
-- cada adicional escolhido é somado ao preço do item no carrinho/pedido.
CREATE TABLE menu_item_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_menu_item_addons_menu_item_id ON menu_item_addons(menu_item_id);

CREATE TABLE addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT,
  street TEXT NOT NULL,
  number TEXT,
  complement TEXT,
  neighborhood TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip TEXT,
  lat NUMERIC(9,6),
  lng NUMERIC(9,6),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_addresses_user_id ON addresses(user_id);

CREATE TABLE deliverer_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  vehicle_type TEXT,
  document TEXT,
  is_available BOOLEAN NOT NULL DEFAULT true,
  -- Entregador "da casa": vinculado a um restaurante específico, só
  -- recebe corridas desse restaurante (nunca aparece no radar público de
  -- entregadores autônomos). NULL = entregador autônomo normal.
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_deliverer_profiles_tenant_id ON deliverer_profiles(tenant_id);

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id),
  client_id UUID NOT NULL REFERENCES users(id),
  deliverer_id UUID REFERENCES users(id),
  address_id UUID REFERENCES addresses(id),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN (
    'pendente', 'preparando', 'procurando_entregador', 'a_caminho', 'entregue', 'cancelado'
  )),
  pickup_code CHAR(4) NOT NULL,
  delivery_code CHAR(4) NOT NULL,
  cancel_reason TEXT,
  subtotal NUMERIC(10,2) NOT NULL,
  delivery_fee NUMERIC(10,2) NOT NULL,
  total NUMERIC(10,2) NOT NULL,
  accepted_at TIMESTAMPTZ,
  ready_at TIMESTAMPTZ,
  picked_up_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_tenant_id ON orders(tenant_id);
CREATE INDEX idx_orders_client_id ON orders(client_id);
CREATE INDEX idx_orders_deliverer_id ON orders(deliverer_id);
CREATE INDEX idx_orders_restaurant_id ON orders(restaurant_id);
CREATE INDEX idx_orders_status_radar ON orders(status) WHERE deliverer_id IS NULL;

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES menu_items(id),
  name_snapshot TEXT NOT NULL,
  price_snapshot NUMERIC(10,2) NOT NULL,
  qty INT NOT NULL CHECK (qty > 0)
);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);

ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurants FORCE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items FORCE ROW LEVEL SECURITY;

CREATE POLICY restaurants_public_read ON restaurants
  FOR SELECT USING (true);

CREATE POLICY restaurants_tenant_write ON restaurants
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY restaurants_tenant_update ON restaurants
  FOR UPDATE USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY restaurants_tenant_delete ON restaurants
  FOR DELETE USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY menu_items_public_read ON menu_items
  FOR SELECT USING (true);

CREATE POLICY menu_items_tenant_write ON menu_items
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY menu_items_tenant_update ON menu_items
  FOR UPDATE USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY menu_items_tenant_delete ON menu_items
  FOR DELETE USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_categories FORCE ROW LEVEL SECURITY;

CREATE POLICY menu_categories_public_read ON menu_categories
  FOR SELECT USING (true);

CREATE POLICY menu_categories_tenant_write ON menu_categories
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY menu_categories_tenant_update ON menu_categories
  FOR UPDATE USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY menu_categories_tenant_delete ON menu_categories
  FOR DELETE USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

ALTER TABLE menu_item_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_item_addons FORCE ROW LEVEL SECURITY;

CREATE POLICY menu_item_addons_public_read ON menu_item_addons
  FOR SELECT USING (true);

CREATE POLICY menu_item_addons_tenant_write ON menu_item_addons
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY menu_item_addons_tenant_update ON menu_item_addons
  FOR UPDATE USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY menu_item_addons_tenant_delete ON menu_item_addons
  FOR DELETE USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_orders_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Códigos de verificação de login por e-mail
CREATE TABLE IF NOT EXISTS login_verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_codes_email ON login_verification_codes (email);

-- Códigos de recuperação de senha por e-mail
CREATE TABLE IF NOT EXISTS password_reset_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_password_reset_codes_email ON password_reset_codes(email);

-- Mensagens entre restaurante e cliente, por pedido
CREATE TABLE IF NOT EXISTS order_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('client', 'restaurant')),
  sender_id UUID NOT NULL REFERENCES users(id),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_order_messages_order_id ON order_messages(order_id);

-- Restaurantes favoritados por cada cliente
CREATE TABLE IF NOT EXISTS favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, restaurant_id)
);
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);

-- Preferência de notificações (o sininho do app). Fica no banco, e não só
-- no celular, porque quem decide se manda push com o app fechado é o
-- backend -- ele precisa saber se a pessoa quer receber ou não.
ALTER TABLE users ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN NOT NULL DEFAULT true;

-- Tokens de push (Expo). Um usuário pode ter mais de um (trocou de
-- celular, reinstalou o app etc.) -- por isso token é único e não o user_id.
CREATE TABLE IF NOT EXISTS push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  platform TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON push_tokens(user_id);
