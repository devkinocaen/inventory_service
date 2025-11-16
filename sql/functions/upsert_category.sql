CREATE OR REPLACE FUNCTION inventory.upsert_category(
    p_category_id INT DEFAULT NULL,
    p_name TEXT,
    p_description TEXT DEFAULT ''
) RETURNS TABLE(id INT, name TEXT, description TEXT) AS $$
BEGIN
    IF p_category_id IS NULL THEN
        RETURN QUERY
        INSERT INTO inventory.reservable_category(name, description)
        VALUES (p_name, p_description)
        ON CONFLICT(name) DO UPDATE SET description = EXCLUDED.description
        RETURNING *;
    ELSE
        RETURN QUERY
        UPDATE inventory.reservable_category
        SET name = p_name,
            description = p_description
        WHERE id = p_category_id
        RETURNING *;
    END IF;
END;
$$ LANGUAGE plpgsql;
