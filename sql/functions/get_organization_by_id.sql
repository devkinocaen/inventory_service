CREATE OR REPLACE FUNCTION inventory.get_organization_by_id(p_id INT)
RETURNS TABLE (
    id INT,
    name TEXT,
    address TEXT,
    referent_id INT
) AS $$
BEGIN
    RETURN QUERY
    SELECT id, name, address, referent_id
    FROM inventory.organization
    WHERE id = p_id;
END;
$$ LANGUAGE plpgsql STABLE;
