CREATE OR REPLACE FUNCTION inventory.get_organizations()
RETURNS TABLE(
    id TEXT,
    name TEXT,
    referent_id TEXT,
    referent_first_name TEXT,
    referent_last_name TEXT,
    referent_email TEXT,
    referent_phone TEXT
)
AS $$
BEGIN
    RETURN QUERY
    SELECT
        o.id::TEXT,
        o.name::TEXT,
        o.referent_id::TEXT,
        p.first_name::TEXT,
        p.last_name::TEXT,
        p.email::TEXT,
        p.phone::TEXT
    FROM inventory.organization o
    LEFT JOIN inventory.person p
        ON o.referent_id = p.id
    ORDER BY o.name;
END;
$$ LANGUAGE plpgsql;
