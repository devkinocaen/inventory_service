-- ===========================
-- Supprime un batch de reservable
-- ===========================
-- Supprime un batch. Si le batch est utilisé dans une réservation, lève une exception.
-- Supprime aussi les liens avec les reservables.
CREATE OR REPLACE FUNCTION inventory.delete_reservable_batch(p_batch_id INT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_batch_id IS NULL THEN
    RAISE EXCEPTION 'p_batch_id is required';
  END IF;

  -- Vérifie que le batch existe
  IF NOT EXISTS (
    SELECT 1 FROM inventory.reservable_batch WHERE id = p_batch_id
  ) THEN
    RAISE EXCEPTION 'Reservable batch (id=%) not found', p_batch_id;
  END IF;

  -- Vérifie qu'aucune réservation n'utilise ce batch
  IF EXISTS (
    SELECT 1 FROM inventory.reservable_booking
     WHERE reservable_batch_id = p_batch_id
  ) THEN
    RAISE EXCEPTION 'Cannot delete batch (id=%) because it is used in a reservation', p_batch_id;
  END IF;

  -- Supprime les liens avec les reservables
  DELETE FROM inventory.reservable_batch_link
   WHERE batch_id = p_batch_id;

  -- Supprime le batch lui-même
  DELETE FROM inventory.reservable_batch
   WHERE id = p_batch_id;
END;
$$;
