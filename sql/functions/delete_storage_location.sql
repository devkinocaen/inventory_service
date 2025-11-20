CREATE OR REPLACE FUNCTION inventory.delete_storage_location(
    p_id INT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_exists INT;
BEGIN
    -- Vérifier que le lieu existe
    SELECT id INTO v_exists
    FROM inventory.storage_location
    WHERE id = p_id;

    IF v_exists IS NULL THEN
        RAISE EXCEPTION 'Storage location ID % n''existe pas', p_id;
    END IF;

    -- Suppression
    DELETE FROM inventory.storage_location
    WHERE id = p_id;
END;
$$;
