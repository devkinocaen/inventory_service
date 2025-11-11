CREATE OR REPLACE FUNCTION inventory.get_organization_referents(org_id INT)
RETURNS TABLE(
    referent_id TEXT,
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    phone TEXT
)
AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id::TEXT,
        p.first_name::TEXT,
        p.last_name::TEXT,
        p.email::TEXT,
        p.phone::TEXT
    FROM inventory.organization o
    LEFT JOIN inventory.person p
        ON o.referent_id = p.id
    WHERE o.id = org_id;
END;
$$ LANGUAGE plpgsql;
