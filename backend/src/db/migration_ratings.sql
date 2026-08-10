-- Rode este arquivo no pgAdmin (Query Tool) no seu banco do Railway.
-- Avaliação real de pedidos: cliente avalia (1 a 5) depois que o pedido é
-- entregue, uma vez por pedido. O rating do restaurante deixa de ser
-- estático -- um trigger recalcula a média automaticamente a cada
-- avaliação nova, então as consultas que já leem restaurants.rating
-- continuam funcionando sem precisar mudar nada nelas.

CREATE TABLE IF NOT EXISTS order_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES users(id),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_order_ratings_restaurant_id ON order_ratings(restaurant_id);

-- Quantidade de avaliações, pra mostrar "4.8 (132 avaliações)" na tela
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS rating_count INT NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION recalc_restaurant_rating() RETURNS TRIGGER AS $$
BEGIN
  UPDATE restaurants r
  SET rating = COALESCE(
        (SELECT ROUND(AVG(rating)::numeric, 1) FROM order_ratings WHERE restaurant_id = r.id),
        0
      ),
      rating_count = (SELECT COUNT(*) FROM order_ratings WHERE restaurant_id = r.id)
  WHERE r.id = COALESCE(NEW.restaurant_id, OLD.restaurant_id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_order_ratings_recalc ON order_ratings;
CREATE TRIGGER trg_order_ratings_recalc
AFTER INSERT OR UPDATE OR DELETE ON order_ratings
FOR EACH ROW EXECUTE FUNCTION recalc_restaurant_rating();
