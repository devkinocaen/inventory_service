CREATE OR REPLACE FUNCTION inventory.validate_booking(
    p_booking_id INT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_status inventory.booking_status;
BEGIN
    -- Vérifier existence + statut
    SELECT status
    INTO v_status
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

    -- Tentative de validation
    -- 👉 la contrainte GIST fait le contrôle réel
    UPDATE inventory.reservable_booking
    SET status = 'validé'
    WHERE id = p_booking_id;

END;
$$;
