CREATE OR REPLACE FUNCTION inventory.update_booking(
    p_booking_id INT,
    p_start TIMESTAMP DEFAULT NULL,
    p_end TIMESTAMP DEFAULT NULL,
    p_organization_id INT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
    -- Vérifier que la réservation existe
    IF NOT EXISTS (
        SELECT 1 FROM inventory.reservable_booking rb
        WHERE rb.id = p_booking_id
    ) THEN
        RAISE EXCEPTION 'Booking id % does not exist', p_booking_id
            USING ERRCODE = 'P0002';
    END IF;

    -- Mettre à jour uniquement les paramètres non nuls
    UPDATE inventory.reservable_booking
    SET
        start_date = COALESCE(p_start, start_date),
        end_date = COALESCE(p_end, end_date),
        renter_organization_id = COALESCE(p_organization_id, renter_organization_id)
    WHERE id = p_booking_id;

    RETURN TRUE;
END;
$$;
