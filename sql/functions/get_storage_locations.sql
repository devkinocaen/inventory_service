CREATE OR REPLACE FUNCTION inventory.get_storage_locations()
RETURNS TABLE (
    id INT,
    name TEXT,
    address TEXT
)
AS $$
BEGIN
    RETURN QUERY
    SELECT
        sl.id,
        sl.name::TEXT,
        sl.address::TEXT
    FROM inventory.storage_location sl
    ORDER BY sl.name;
END;
$$ LANGUAGE plpgsql
STABLE
SECURITY DEFINER;
