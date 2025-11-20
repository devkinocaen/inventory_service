-- =====================================
-- Categories : upsert basé sur le name, retourne uniquement l'ID
-- =====================================
CREATE OR REPLACE FUNCTION inventory.upsert_category(
    p_name TEXT,
    p_description TEXT DEFAULT ''
)
RETURNS INT AS $$
DECLARE
    category_id INT;
BEGIN
    INSERT INTO inventory.reservable_category(name, description)
    VALUES (trim(p_name), p_description)
    ON CONFLICT(name) DO UPDATE
    SET description = EXCLUDED.description
    RETURNING id INTO category_id;

    RETURN category_id;
END;
$$ LANGUAGE plpgsql;
