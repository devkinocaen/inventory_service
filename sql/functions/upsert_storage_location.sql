CREATE OR REPLACE FUNCTION inventory.upsert_storage_location(
    p_id INT,
    p_name TEXT,
    p_address TEXT DEFAULT NULL
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_id INT;
BEGIN
    -- Vérifie si un ID existe
    IF p_id IS NOT NULL THEN
        SELECT id INTO v_id
        FROM inventory.storage_location
        WHERE id = p_id;
    END IF;

    -- Insert ou update
    IF v_id IS NULL THEN
        INSERT INTO inventory.storage_location(name, address)
        VALUES (p_name, p_address)
        RETURNING id INTO v_id;
    ELSE
        UPDATE inventory.storage_location
        SET name = COALESCE(p_name, name),
            address = COALESCE(p_address, address)
        WHERE id = v_id;
    END IF;

    -- Retourne uniquement l'ID
    RETURN v_id;
END;
$$;
