-- =====================================
-- Subcategories : upsert basé sur (category_id, name), retourne uniquement l'ID
-- =====================================
CREATE OR REPLACE FUNCTION inventory.upsert_subcategory(
    p_category_id INT,
    p_name TEXT
)
RETURNS INT AS $$
DECLARE
    subcategory_id INT;
BEGIN
    INSERT INTO inventory.reservable_subcategory(category_id, name)
    VALUES (p_category_id, trim(p_name))
    ON CONFLICT (category_id, name) DO UPDATE
    SET name = EXCLUDED.name
    RETURNING id INTO subcategory_id;

    RETURN subcategory_id;
END;
$$ LANGUAGE plpgsql;
