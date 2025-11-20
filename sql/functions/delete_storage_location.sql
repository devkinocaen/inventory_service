CREATE OR REPLACE FUNCTION inventory.delete_storage_location(
    p_id INT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_exists INT;
    v_count INT;
BEGIN
    -- Vérifier que le lieu existe
    SELECT id INTO v_exists
    FROM inventory.storage_location
    WHERE id = p_id;

    IF v_exists IS NULL THEN
        RAISE EXCEPTION 'Le lieu de stockage ID % n''existe pas', p_id;
    END IF;

    -- Vérifier si des réservables y sont encore rattachés
    SELECT COUNT(*) INTO v_count
    FROM inventory.reservable
    WHERE storage_location_id = p_id;

    IF v_count > 0 THEN
        RAISE EXCEPTION 'Impossible de supprimer le lieu "%". Il est encore utilisé par % réservable(s).',
            (SELECT name FROM inventory.storage_location WHERE id = p_id),
            v_count;
    END IF;

    -- Suppression
    DELETE FROM inventory.storage_location
    WHERE id = p_id;
END;
$$;
