CREATE OR REPLACE FUNCTION inventory.delete_person(
    p_first_name TEXT,
    p_last_name TEXT
)
RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
    org_info RECORD;
BEGIN
    -- Cherche la première organisation où la personne est référente
    SELECT o.id, o.name
    INTO org_info
    FROM inventory.organization o
    JOIN inventory.person p
      ON o.referent_id = p.id
    WHERE p.first_name = p_first_name
      AND p.last_name = p_last_name
    LIMIT 1;

    IF org_info IS NOT NULL THEN
        RAISE EXCEPTION 'Impossible de supprimer % % : elle est référente de l''organisation % (id=%)',
            p_first_name, p_last_name, org_info.name, org_info.id;
    END IF;

    -- Sinon, suppression
    DELETE FROM inventory.person
    WHERE first_name = p_first_name
      AND last_name = p_last_name;
END;
$$;
