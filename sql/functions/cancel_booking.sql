CREATE OR REPLACE FUNCTION inventory.cancel_booking(
    p_booking_id INT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_status inventory.booking_status;
BEGIN
    SELECT status
    INTO v_status
    FROM inventory.reservable_booking
    WHERE id = p_booking_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking % inexistant', p_booking_id;
    END IF;

    IF v_status = 'annulé' THEN
        RAISE EXCEPTION 'La réservation % est déjà annulée', p_booking_id;
    END IF;

    UPDATE inventory.reservable_booking
    SET status = 'annulé'
    WHERE id = p_booking_id;
END;
$$;
