-- inventory.delete_booking(p_booking_id INT)
-- Supprime une réservation. Si le lot (reservable_batch) lié n'est référencé par
-- aucune autre réservation, supprime aussi les liens et le lot lui-même.
CREATE OR REPLACE FUNCTION inventory.delete_booking(p_booking_id INT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_batch_id INT;
BEGIN
  IF p_booking_id IS NULL THEN
    RAISE EXCEPTION 'p_booking_id is required';
  END IF;

  -- Récupère le batch associé (s'il existe)
  SELECT reservable_batch_id
    INTO v_batch_id
    FROM inventory.reservable_booking
   WHERE id = p_booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking (id=%) not found', p_booking_id;
  END IF;

  -- Supprime la réservation
  DELETE FROM inventory.reservable_booking
   WHERE id = p_booking_id;

  -- Si un lot était lié, et qu'il n'est plus utilisé par d'autres réservations,
  -- supprimer ses liens et le lot lui-même pour éviter les orphelins.
  IF v_batch_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM inventory.reservable_booking rb
       WHERE rb.reservable_batch_id = v_batch_id
    ) THEN
      DELETE FROM inventory.reservable_batch_link WHERE batch_id = v_batch_id;
      DELETE FROM inventory.reservable_batch WHERE id = v_batch_id;
    END IF;
  END IF;
END;
$$;
