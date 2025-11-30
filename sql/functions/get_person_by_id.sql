CREATE OR REPLACE FUNCTION inventory.get_person_by_id(p_id INT)
RETURNS TABLE (
    id INT,
    first_name TEXT,
    last_name TEXT,
    address TEXT,
    email TEXT,
    phone TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT person.id,
    person.first_name::TEXT,
    person.last_name::TEXT,
    person.address::TEXT,
    person.email::TEXT,
    person.phone::TEXT
    FROM inventory.person
    WHERE person.id = p_id;
END;
$$ LANGUAGE plpgsql STABLE;
