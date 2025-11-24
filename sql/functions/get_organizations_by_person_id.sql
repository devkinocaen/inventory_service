CREATE OR REPLACE FUNCTION inventory.get_organizations_by_person_id(
    p_person_id INT
)
RETURNS TABLE (
    organization_id INT,
    organization_name TEXT,
    organization_address TEXT,
    referent_id INT,
    referent_first_name TEXT,
    referent_last_name TEXT,
    person_role TEXT
)
 LANGUAGE plpgsql STABLE
 SECURITY DEFINER
 AS $$
BEGIN
    -- 🔹 Organisations où la personne est référent
    RETURN QUERY
    SELECT
        o.id::int,
        o.name::text,
        o.address::text,
        o.referent_id::int,
        r.first_name::text,
        r.last_name::text,
        NULL::text
    FROM inventory.organization o
    LEFT JOIN inventory.person r ON o.referent_id = r.id
    WHERE o.referent_id = p_person_id
    ORDER BY o.name;

    -- 🔹 Organisations où la personne est membre via organization_person
    RETURN QUERY
    SELECT
        o.id::int,
        o.name::text,
        o.address::text,
        o.referent_id::int,
        r.first_name::text,
        r.last_name::text,
        op.role::text
    FROM inventory.organization_person op
    JOIN inventory.organization o ON op.organization_id = o.id
    LEFT JOIN inventory.person r ON o.referent_id = r.id
    WHERE op.person_id = p_person_id
      AND o.referent_id <> p_person_id
    ORDER BY o.name;
END;
$$;
