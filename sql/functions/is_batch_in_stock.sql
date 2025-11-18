CREATE OR REPLACE FUNCTION inventory.is_batch_in_stock(
    p_batch_id INT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    rec RECORD;

    all_available BOOLEAN := TRUE;
    all_out BOOLEAN := TRUE;

    -- résultat final
    result BOOLEAN;
BEGIN
    -- Vérifier que le batch existe
    PERFORM 1 FROM inventory.reservable_batch WHERE id = p_batch_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Reservable batch % does not exist', p_batch_id;
    END IF;

    -- Boucler sur tous les réservables du batch
    FOR rec IN
        SELECT r.id, r.is_in_stock
        FROM inventory.reservable_batch_link bl
        JOIN inventory.reservable r ON r.id = bl.reservable_id
        WHERE bl.batch_id = p_batch_id
    LOOP
        -- 1) Vérifier la disponibilité logicielle via ta fonction
        IF NOT inventory.is_available(rec.id, NOW(), NOW() + interval '1 second') THEN
            all_available := FALSE;
        END IF;

        -- 2) Vérifier l'état physique (is_in_stock)
        IF rec.is_in_stock THEN
            all_out := FALSE;
        ELSE
            all_available := FALSE;
        END IF;
    END LOOP;

    -- Cas A : tout est dispo
    IF all_available THEN
        RETURN TRUE;
    END IF;

    -- Cas B : tout est sorti du stock
    IF all_out THEN
        RETURN FALSE;
    END IF;

    -- Cas C : mélange → retour indéterminé
    RETURN NULL;
END;
$$;
