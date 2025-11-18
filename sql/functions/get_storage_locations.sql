CREATE OR REPLACE FUNCTION inventory.get_storage_locations()
RETURNS TABLE (
    id INT,
    name TEXT,
    address TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT id, name, address
    FROM inventory.storage_location
    ORDER BY name;
END;
$$ LANGUAGE plpgsql STABLE;
