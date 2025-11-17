CREATE OR REPLACE FUNCTION inventory.update_booking(
    p_booking_reference_id INT,
    p_start TIMESTAMP,
    p_end TIMESTAMP,
    p_organization_id INT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
    -- Vérifier que la référence existe
    IF NOT EXISTS (
        SELECT 1
        FROM inventory.booking_reference br
        WHERE br.id = p_booking_reference_id
    ) THEN
        RAISE EXCEPTION 'Booking reference % does not exist', p_booking_reference_id
            USING ERRCODE = 'P0002';
    END IF;

    -- Mettre à jour la référence
    UPDATE inventory.booking_reference
    SET
        start_date = p_start,
        end_date = p_end,
        organization_id = p_organization_id
    WHERE id = p_booking_reference_id;

    RETURN TRUE;
END;
$$;
