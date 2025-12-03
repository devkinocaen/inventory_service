CREATE OR REPLACE FUNCTION inventory.get_organizations_by_person_id(
    p_person_id INT
)
RETURNS TABLE (
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

        -- JSONB des personnes avec le référent inclus
        COALESCE(
            JSONB_AGG(
                JSONB_BUILD_OBJECT(
                    'id', p.id,
                    'first_name', p.first_name::TEXT,
                    'last_name', p.last_name::TEXT,
                    'email', p.email::TEXT,
                    'phone', p.phone::TEXT,
                    'role',
                        COALESCE(op.role::TEXT,
                                 CASE WHEN p.id = o.referent_id THEN 'Référent' END)
                )
                ORDER BY p.first_name, p.last_name
            ) FILTER (WHERE p.id IS NOT NULL),
            '[]'::JSONB
        ) AS persons

    FROM inventory.organization o
    LEFT JOIN inventory.person pr ON pr.id = o.referent_id
    LEFT JOIN inventory.organization_person op ON op.organization_id = o.id
    LEFT JOIN inventory.person p ON p.id = op.person_id OR p.id = o.referent_id  -- référent inclus

    WHERE o.referent_id = p_person_id OR op.person_id = p_person_id
    GROUP BY o.id, o.name, o.referent_id, pr.first_name, pr.last_name, pr.phone, o.address
    ORDER BY o.name;
END;
$$;
