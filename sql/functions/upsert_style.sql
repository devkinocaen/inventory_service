-- =====================================
-- Styles : upsert basé uniquement sur le name, retourne seulement l'ID
-- =====================================
CREATE OR REPLACE FUNCTION inventory.upsert_style(
    p_name TEXT,
    p_description TEXT DEFAULT ''
)
RETURNS INT AS $$
DECLARE
    style_id INT;
BEGIN
    INSERT INTO inventory.reservable_style(name, description)
    VALUES (trim(p_name), p_description)
    ON CONFLICT(name) DO UPDATE
    SET description = EXCLUDED.description
    RETURNING id INTO style_id;

    RETURN style_id;
END;
$$ LANGUAGE plpgsql;
