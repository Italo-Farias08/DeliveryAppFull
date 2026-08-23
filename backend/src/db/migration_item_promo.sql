-- Rode este arquivo no pgAdmin (Query Tool) ou via psql no seu banco.
-- Adiciona promoção por ITEM de cardápio: um preço promocional opcional,
-- menor que o preço normal. O restaurante "está em promoção" (pro
-- cliente ver na home) sempre que ele tiver pelo menos um item com
-- promo_price preenchido -- não precisa de coluna própria em
-- "restaurants", é calculado na hora (ver restaurants.service.js).
-- Só adiciona o que falta, sem apagar nada -- pode rodar mais de uma vez.

ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS promo_price NUMERIC(10,2);

-- Preço promocional sempre precisa ser menor que o preço normal (senão
-- não é promoção). NULL (sem promoção) sempre passa.
ALTER TABLE menu_items DROP CONSTRAINT IF EXISTS menu_items_promo_price_check;
ALTER TABLE menu_items ADD CONSTRAINT menu_items_promo_price_check
  CHECK (promo_price IS NULL OR promo_price < price);
