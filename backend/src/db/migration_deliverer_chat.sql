-- Rode este arquivo no pgAdmin (Query Tool) no seu banco do Railway.
-- Permite que o entregador também participe do chat do pedido
-- (antes só cliente e restaurante podiam mandar mensagem).
-- Não apaga nada, só amplia a regra existente.

DO $$
DECLARE
  con_name text;
BEGIN
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'order_messages'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%sender_role%';

  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE order_messages DROP CONSTRAINT %I', con_name);
  END IF;
END $$;

ALTER TABLE order_messages
  ADD CONSTRAINT order_messages_sender_role_check
  CHECK (sender_role IN ('client', 'restaurant', 'deliverer'));
