-- create_booking.sql
-- Crée une réservation (insert). La contrainte EXCLUDE définie dans la table empêchera les chevauchements.
-- Si insertion échoue (chevauchement), l'exception DB remontera et le client peut la traiter.
CREATE OR REPLACE FUNCTION inventory.create_booking(
  p_reservable_batch_id INT,
  p_renter_organization_id INT,
  p_booking_reference_id INT,
  p_start_date TIMESTAMP,
  p_end_date TIMESTAMP
)
RETURNS inventory.reservable_booking
LANGUAGE plpgsql VOLATILE
AS $$
DECLARE
  new_row inventory.reservable_booking%ROWTYPE;
BEGIN
  INSERT INTO inventory.reservable_booking (
    reservable_batch_id,
    renter_organization_id,
    booking_reference_id,
    start_date,
    end_date
  ) VALUES (
    p_reservable_batch_id,
    p_renter_organization_id,
    p_booking_reference_id,
    p_start_date,
    p_end_date
  )
  RETURNING * INTO new_row;

  RETURN new_row;
EXCEPTION WHEN OTHERS THEN
  -- Laisser l'erreur remonter — le caller JS pourra afficher le message.
  RAISE;
END;
$$;
