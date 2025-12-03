CREATE OR REPLACE FUNCTION inventory.get_organizations()
RETURNS TABLE(
    id INT,
    name TEXT,
    address TEXT,
    referent_id INT,
    referent_first_name TEXT,
    referent_last_name TEXT,
    referent_phone TEXT,
    persons JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        o.id,
        o.name::TEXT,
        o.address::TEXT,
        o.referent_id,
        pr.first_name::TEXT AS referent_first_name,
        pr.last_name::TEXT AS referent_last_name,
        pr.phone::TEXT AS referent_phone,

        (
            SELECT COALESCE(
                JSONB_AGG(
                    JSONB_BUILD_OBJECT(
                        'id', p2.id,
                        'first_name', p2.first_name,
                        'last_name', p2.last_name,
                        'email', p2.email,
                        'phone', p2.phone,
                        'role',
                            COALESCE(op2.role,
                                     CASE WHEN p2.id = o.referent_id THEN 'Référent' END)
                    )
                    ORDER BY p2.first_name, p2.last_name
                ),
                '[]'::JSONB
            )
            FROM (
                SELECT DISTINCT ON (p.id)
                    p.*,
                    op.role
                FROM inventory.person p
                LEFT JOIN inventory.organization_person op
                    ON op.person_id = p.id AND op.organization_id = o.id
                WHERE p.id = o.referent_id
                   OR p.id IN (
                        SELECT person_id
                        FROM inventory.organization_person
                        WHERE organization_id = o.id
                   )
                ORDER BY p.id
            ) AS p2(p2_id)
            LEFT JOIN inventory.organization_person op2
                ON op2.organization_id = o.id AND op2.person_id = p2.id
        ) AS persons

    FROM inventory.organization o
    LEFT JOIN inventory.person pr ON pr.id = o.referent_id
    ORDER BY o.name;
END;
$$;
