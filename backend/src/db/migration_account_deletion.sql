-- Exclusão de conta (cliente, restaurante e entregador)
--
-- Não fazemos DELETE de verdade na linha do usuário: a tabela orders
-- referencia client_id/deliverer_id SEM ON DELETE CASCADE, então apagar
-- o usuário quebraria o histórico de pedidos de quem comprou/entregou/vendeu
-- junto com essa conta (e travaria a exclusão com erro de FK). Em vez disso,
-- a conta é ANONIMIZADA (nome, e-mail, telefone e CPF removidos, senha
-- trocada por uma inutilizável) e marcada com deleted_at. O e-mail original
-- fica livre para um novo cadastro no futuro.
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Usado pelo restaurants.service/tenant.service para esconder a loja da
-- home do cliente quando a conta do restaurante é excluída. Garantida aqui
-- com IF NOT EXISTS caso este ambiente ainda não tenha essa coluna.
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT true;

-- Estado "fechado" para o tenant do restaurante que teve a conta excluída
-- (loja some da home, mas os pedidos antigos continuam intactos pro
-- histórico do cliente e para fins fiscais/contábeis).
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_status_check;
ALTER TABLE tenants ADD CONSTRAINT tenants_status_check CHECK (status IN ('active', 'suspended', 'closed'));
