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
                        'id', p_sub.id,
                        'first_name', p_sub.first_name,
                        'last_name', p_sub.last_name,
                        'email', p_sub.email,
                        'phone', p_sub.phone,
                        'role', COALESCE(op_sub.role,
                                         CASE WHEN p_sub.id = o.referent_id THEN 'Référent' END)
                    )
                    ORDER BY p_sub.first_name, p_sub.last_name
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
            ) AS p_sub
            LEFT JOIN inventory.organization_person op_sub
                ON op_sub.organization_id = o.id AND op_sub.person_id = p_sub.id
        ) AS persons
    FROM inventory.organization o
    LEFT JOIN inventory.person pr ON pr.id = o.referent_id
    ORDER BY o.name;
END;
$$;
