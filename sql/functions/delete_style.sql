
CREATE OR REPLACE FUNCTION inventory.delete_style(
    p_style_id INT
) RETURNS VOID AS $$
BEGIN
    DELETE FROM inventory.reservable_style WHERE id = p_style_id;
END;
$$ LANGUAGE plpgsql;

