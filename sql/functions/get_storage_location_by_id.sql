CREATE OR REPLACE FUNCTION inventory.get_storage_location_by_id(p_id INT)
RETURNS TABLE (
    id INT,
    name VARCHAR,
    address TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT id, name, address
    FROM inventory.storage_location
    WHERE id = p_id;
END;
$$ LANGUAGE plpgsql STABLE;
