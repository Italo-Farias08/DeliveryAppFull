INSERT INTO categories (name, icon) VALUES
  ('Hambúrguer', 'fast-food'),
  ('Pizza', 'pizza'),
  ('Japonesa', 'fish'),
  ('Brasileira', 'restaurant'),
  ('Doces', 'ice-cream'),
  ('Saudável', 'leaf'),
  ('Bebidas', 'wine'),
  ('Mercado', 'cart')
ON CONFLICT (name) DO NOTHING;
