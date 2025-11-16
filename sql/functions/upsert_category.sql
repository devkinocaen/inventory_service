-- =====================================
-- Categories : upsert basé sur le name
-- =====================================
CREATE OR REPLACE FUNCTION inventory.upsert_category(
    p_name TEXT,
    p_description TEXT DEFAULT ''
)
RETURNS TABLE(id INT, name TEXT, description TEXT) AS $$
BEGIN
    RETURN QUERY
    INSERT INTO inventory.reservable_category(name, description)
    VALUES (trim(p_name), p_description)
    ON CONFLICT(name) DO UPDATE
    SET description = EXCLUDED.description
    RETURNING id, name, description;
END;
$$ LANGUAGE plpgsql;
