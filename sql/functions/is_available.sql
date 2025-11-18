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
    v_in_stock BOOLEAN;
    v_status inventory.reservable_status;
BEGIN
    -- Vérification dates
    IF p_start_date >= p_end_date THEN
        RAISE EXCEPTION 'La date de fin doit être après la date de début';
    END IF;

    -- Vérifier que le réservable existe et récupérer is_in_stock + status
    SELECT is_in_stock, status
    INTO v_in_stock, v_status
    FROM inventory.reservable
    WHERE id = p_reservable_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Reservable % n’existe pas', p_reservable_id;
    END IF;

    -- Vérifier qu'il est en stock physiquement
    IF v_in_stock IS NOT TRUE THEN
        RETURN FALSE; -- explicitement indisponible
    END IF;

    -- Vérifier statut logique
    IF v_status <> 'disponible' THEN
        RETURN FALSE;
    END IF;

    -- Vérifier aucune réservation qui chevauche
    SELECT COUNT(*)
    INTO overlap_count
    FROM inventory.reservable_booking rb
    JOIN inventory.reservable_batch_link rbl
      ON rb.reservable_batch_id = rbl.batch_id
    WHERE rbl.reservable_id = p_reservable_id
      AND rb.period && tsrange(p_start_date, p_end_date, '[]');

    RETURN overlap_count = 0;
END;
$$;
