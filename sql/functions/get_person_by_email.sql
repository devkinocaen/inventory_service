CREATE OR REPLACE FUNCTION inventory.get_person_by_email(p_email TEXT)
RETURNS TABLE (
    id INT,
    first_name TEXT,
    last_name TEXT,
    address TEXT,
    email TEXT,
    phone TEXT
) AS $$
DECLARE
    cnt INT;
BEGIN
    -- Compte les occurrences en insensible à la casse
    SELECT COUNT(*) INTO cnt
    FROM inventory.person
    WHERE LOWER(person.email) = LOWER(p_email);

    -- Cas interdit : plusieurs personnes avec le même email (case-insensitive)
    IF cnt > 1 THEN
        RAISE EXCEPTION
            'Plusieurs personnes trouvées avec le même email (%) – violation logique: email doit être unique.',
            p_email
            USING ERRCODE = 'P0001';
    END IF;

    -- Retourne la ou les lignes (0 ou 1) en insensible à la casse
    RETURN QUERY
    SELECT
        person.id,
        person.first_name::TEXT,
        person.last_name::TEXT,
        person.address::TEXT,
        person.email::TEXT,
        person.phone::TEXT
    FROM inventory.person
    WHERE LOWER(person.email) = LOWER(p_email);

END;
$$ LANGUAGE plpgsql STABLE;
