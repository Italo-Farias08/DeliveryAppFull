-- Rode este arquivo no pgAdmin (Query Tool) no seu banco do Railway,
-- ou via: psql "$DATABASE_URL" -f src/db/migration_push_notifications.sql
--
-- Adiciona suporte a notificações push reais (Expo Push).

-- Preferência de notificações do usuário (o toggle do sininho no app).
-- Fica no banco porque é o backend que decide se manda push com o app
-- fechado -- ele precisa saber se a pessoa quer receber ou não.
ALTER TABLE users ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN NOT NULL DEFAULT true;

-- Tokens de push (Expo). Um usuário pode ter mais de um token (trocou de
-- celular, reinstalou o app etc.), por isso o token é único, não o user_id.
CREATE TABLE IF NOT EXISTS push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  platform TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON push_tokens(user_id);
