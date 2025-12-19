CREATE OR REPLACE FUNCTION inventory.validate_booking(
    p_booking_id INT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_status inventory.booking_status;
    v_start TIMESTAMP;
    v_end   TIMESTAMP;
    v_batch_id INT;
    v_conflict_count INT;
BEGIN
    -- Verrouiller la réservation et récupérer son statut et ses dates
    SELECT status, start_date, end_date, reservable_batch_id
    INTO v_status, v_start, v_end, v_batch_id
    FROM inventory.reservable_booking
    WHERE id = p_booking_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking % inexistant', p_booking_id;
    END IF;

    IF v_status <> 'à valider' THEN
        RAISE EXCEPTION
            'Seules les réservations "à valider" peuvent être validées (statut actuel : %)',
            v_status;
    END IF;

    -- Vérifier que tous les reservables du batch ne sont pas déjà pris sur une réservation validée
    SELECT COUNT(*)
    INTO v_conflict_count
    FROM inventory.reservable_booking rb
    JOIN inventory.reservable_batch_link rbl
      ON rb.reservable_batch_id = rbl.batch_id
    WHERE rbl.batch_id = v_batch_id
      AND rb.id <> p_booking_id
      AND rb.status = 'validé'
      AND rb.period && tsrange(v_start, v_end, '[]');

    IF v_conflict_count > 0 THEN
        RAISE EXCEPTION 'Impossible de valider : un ou plusieurs objets du lot sont déjà réservés sur ces dates';
    END IF;

    -- Validation : passer le statut à 'validé'
    UPDATE inventory.reservable_booking
    SET status = 'validé'
    WHERE id = p_booking_id;

END;
$$;
