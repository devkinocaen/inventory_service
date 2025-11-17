-- ===========================
-- Supprime un reservable
-- ===========================
-- Supprime un reservable. Si des batches (reservable_batch) sont liés et
-- qu'ils ne sont plus utilisés par d'autres réservations, supprime aussi les liens et le batch.
CREATE OR REPLACE FUNCTION inventory.delete_reservable(p_reservable_id INT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_batch_ids INT[];
  v_batch_id INT;
BEGIN
  IF p_reservable_id IS NULL THEN
    RAISE EXCEPTION 'p_reservable_id is required';
  END IF;

  -- Vérifie que le reservable existe
  IF NOT EXISTS (
    SELECT 1 FROM inventory.reservable WHERE id = p_reservable_id
  ) THEN
    RAISE EXCEPTION 'Reservable (id=%) not found', p_reservable_id;
  END IF;

  -- Récupère les batchs associés
  SELECT array_agg(id)
    INTO v_batch_ids
    FROM inventory.reservable_batch
   WHERE reservable_id = p_reservable_id;

  -- Supprime les réservations liées à ce reservable
  DELETE FROM inventory.reservable_booking
   WHERE reservable_batch_id IN (
     SELECT id FROM inventory.reservable_batch WHERE reservable_id = p_reservable_id
   );

  -- Supprime les liens styles
  DELETE FROM inventory.reservable_style_link
   WHERE reservable_id = p_reservable_id;

  -- Supprime le reservable lui-même
  DELETE FROM inventory.reservable
   WHERE id = p_reservable_id;

  -- Pour chaque batch lié, supprime les liens et le batch si plus utilisé
  IF v_batch_ids IS NOT NULL THEN
    FOREACH v_batch_id IN ARRAY v_batch_ids LOOP
      IF NOT EXISTS (
        SELECT 1 FROM inventory.reservable_booking rb
         WHERE rb.reservable_batch_id = v_batch_id
      ) THEN
        DELETE FROM inventory.reservable_batch_link WHERE batch_id = v_batch_id;
        DELETE FROM inventory.reservable_batch WHERE id = v_batch_id;
      END IF;
    END LOOP;
  END IF;
END;
$$;
