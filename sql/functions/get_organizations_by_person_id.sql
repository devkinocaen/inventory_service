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
    person_role TEXT  -- rôle dans l'organisation (NULL si référent)
) AS $$
BEGIN
    -- 🔹 Organisations où la personne est référent
    RETURN QUERY
    SELECT
        o.id,
        o.name,
        o.address,
        o.referent_id,
        r.first_name AS referent_first_name,
        r.last_name  AS referent_last_name,
        NULL AS person_role
    FROM inventory.organization o
    LEFT JOIN inventory.person r ON o.referent_id = r.id
    WHERE o.referent_id = p_person_id
    ORDER BY o.name;

    -- 🔹 Organisations où la personne est membre via organization_person
    RETURN QUERY
    SELECT
        o.id,
        o.name,
        o.address,
        o.referent_id,
        r.first_name AS referent_first_name,
        r.last_name  AS referent_last_name,
        op.role AS person_role
    FROM inventory.organization_person op
    JOIN inventory.organization o ON op.organization_id = o.id
    LEFT JOIN inventory.person r ON o.referent_id = r.id
    WHERE op.person_id = p_person_id
      AND o.referent_id <> p_person_id  -- exclure celles déjà listées comme référent
    ORDER BY o.name;
END;
$$ LANGUAGE plpgsql STABLE;
