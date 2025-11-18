CREATE OR REPLACE FUNCTION inventory.set_batch_in_stock(
    p_batch_id INT,
    p_in_stock BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_invalid_count INT;
BEGIN
    -- Vérifier qu'il n'y a pas de réservables indisponibles dans le batch
    SELECT COUNT(*) INTO v_invalid_count
    FROM inventory.reservable r
    JOIN inventory.reservable_batch_link rbl ON r.id = rbl.reservable_id
    WHERE rbl.batch_id = p_batch_id
      AND r.status <> 'disponible'
      AND (p_in_stock = true OR p_in_stock = false);

    IF v_invalid_count > 0 THEN
        RAISE EXCEPTION 'Certains objets du batch ne sont pas disponibles pour cette opération';
    END IF;

    -- Mettre à jour uniquement les objets valides qui changent réellement de statut
    UPDATE inventory.reservable r
    SET is_in_stock = p_in_stock
    FROM inventory.reservable_batch_link rbl
    WHERE r.id = rbl.reservable_id
      AND rbl.batch_id = p_batch_id
      AND r.status = 'disponible'
      AND r.is_in_stock IS DISTINCT FROM p_in_stock;  -- change seulement si nécessaire
END;
$$;
