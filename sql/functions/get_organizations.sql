CREATE OR REPLACE FUNCTION inventory.get_organizations()
RETURNS TABLE(
    id TEXT,
    name TEXT,
    referent_id TEXT,
    referent_name TEXT,
    persons JSONB
)
AS $$
BEGIN
    RETURN QUERY
    SELECT
        o.id::TEXT,
        o.name::TEXT,
        o.referent_id::TEXT,
        CONCAT(pr.first_name, ' ', pr.last_name) AS referent_name,
        COALESCE(
            JSONB_AGG(
                DISTINCT JSONB_BUILD_OBJECT(
                    'id', p.id,
                    'first_name', p.first_name,
                    'last_name', p.last_name,
                    'email', p.email,
                    'phone', p.phone,
                    'role', op.role
                )
                ORDER BY p.last_name, p.first_name
            ) FILTER (WHERE p.id IS NOT NULL),
            '[]'::JSONB
        ) AS persons
    FROM inventory.organization o
    LEFT JOIN inventory.person pr ON pr.id = o.referent_id
    LEFT JOIN inventory.organization_person op ON op.organization_id = o.id
    LEFT JOIN inventory.person p ON p.id = op.person_id
    GROUP BY o.id, o.name, o.referent_id, pr.first_name, pr.last_name
    ORDER BY o.name;
END;
$$ LANGUAGE plpgsql;
