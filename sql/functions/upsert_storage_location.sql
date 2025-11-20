CREATE OR REPLACE FUNCTION inventory.upsert_storage_location(
    p_id INT,
    p_name TEXT,
    p_address TEXT DEFAULT NULL
)
RETURNS TABLE(
    id INT,
    name TEXT,
    address TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_id INT;
BEGIN
    ----------------------------------------------------
    -- 1) Si un ID est fourni, vérifier s'il existe
    ----------------------------------------------------
    IF p_id IS NOT NULL THEN
        SELECT id INTO v_id
        FROM inventory.storage_location
        WHERE id = p_id;
    END IF;

    ----------------------------------------------------
    -- 2) Upsert
    ----------------------------------------------------
    IF v_id IS NULL THEN
        -- Insert
        INSERT INTO inventory.storage_location(name, address)
        VALUES (p_name, p_address)
        RETURNING id INTO v_id;
    ELSE
        -- Update
        UPDATE inventory.storage_location
        SET name = COALESCE(p_name, name),
            address = COALESCE(p_address, address)
        WHERE id = v_id;
    END IF;

    ----------------------------------------------------
    -- 3) Retourner la ligne
    ----------------------------------------------------
    RETURN QUERY
    SELECT id, name, address
    FROM inventory.storage_location
    WHERE id = v_id;

END;
$$;
