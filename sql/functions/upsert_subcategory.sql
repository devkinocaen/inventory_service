CREATE OR REPLACE FUNCTION inventory.upsert_subcategory(
    p_subcategory_id INT DEFAULT NULL,
    p_category_id INT,
    p_name TEXT
) RETURNS TABLE(id INT, category_id INT, name TEXT) AS $$
BEGIN
    IF p_subcategory_id IS NULL THEN
        RETURN QUERY
        INSERT INTO inventory.reservable_subcategory(category_id, name)
        VALUES (p_category_id, p_name)
        ON CONFLICT (category_id, name) DO UPDATE
        SET name = EXCLUDED.name
        RETURNING *;
    ELSE
        RETURN QUERY
        UPDATE inventory.reservable_subcategory
        SET category_id = p_category_id,
            name = p_name
        WHERE id = p_subcategory_id
        RETURNING *;
    END IF;
END;
$$ LANGUAGE plpgsql;
