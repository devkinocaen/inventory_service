CREATE OR REPLACE FUNCTION inventory.delete_subcategory(
    p_subcategory_id INT
) RETURNS VOID AS $$
BEGIN
    DELETE FROM inventory.reservable_subcategory WHERE id = p_subcategory_id;
END;
$$ LANGUAGE plpgsql;
