CREATE OR REPLACE FUNCTION inventory.is_available(
    p_reservable_id INT,
    p_start_date TIMESTAMP,
    p_end_date TIMESTAMP
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    overlap_count INT;
BEGIN
    IF p_start_date >= p_end_date THEN
        RAISE EXCEPTION 'La date de fin doit être après la date de début';
    END IF;

    SELECT COUNT(*) INTO overlap_count
    FROM inventory.reservable_booking rb
    JOIN inventory.reservable_batch_link rbl
      ON rb.reservable_batch_id = rbl.batch_id
    WHERE rbl.reservable_id = p_reservable_id
      AND rb.period && tsrange(p_start_date, p_end_date, '[]'); -- overlap

    RETURN overlap_count = 0; -- true si aucune réservation chevauchante
END;
$$;
