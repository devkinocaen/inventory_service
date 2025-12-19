CREATE OR REPLACE FUNCTION inventory.get_organization_by_id(p_id INT)
RETURNS TABLE (
    id INT,
    name TEXT,
    address TEXT,
    referent_id INT,
    is_individual BOOLEAN,
    is_costume_renter BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT id, name, address, referent_id, is_individual, is_costume_renter
    FROM inventory.organization
    WHERE id = p_id;
END;
$$ LANGUAGE plpgsql STABLE;
