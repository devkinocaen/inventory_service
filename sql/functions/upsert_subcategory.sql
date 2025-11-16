-- =====================================
-- Subcategories : upsert basé sur (category_id, name)
-- =====================================
CREATE OR REPLACE FUNCTION inventory.upsert_subcategory(
    p_category_id INT,
    p_name TEXT
)
RETURNS TABLE(id INT, category_id INT, name TEXT) AS $$
BEGIN
    RETURN QUERY
    INSERT INTO inventory.reservable_subcategory(category_id, name)
    VALUES (p_category_id, trim(p_name))
    ON CONFLICT (category_id, name) DO UPDATE
    SET name = EXCLUDED.name
    RETURNING id, category_id, name;
END;
$$ LANGUAGE plpgsql;
