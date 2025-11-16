CREATE OR REPLACE FUNCTION inventory.delete_category(
    p_category_id INT
) RETURNS VOID AS $$
BEGIN
    DELETE FROM inventory.reservable_category WHERE id = p_category_id;
END;
$$ LANGUAGE plpgsql;

