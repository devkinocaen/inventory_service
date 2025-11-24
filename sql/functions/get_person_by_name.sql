CREATE OR REPLACE FUNCTION inventory.get_person_by_name(
    p_first_name TEXT,
    p_last_name TEXT
)
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
    SELECT id, first_name, last_name, address, email, phone
    FROM inventory.person
    WHERE unaccent(lower(first_name)) = unaccent(lower(p_first_name))
      AND unaccent(lower(last_name))  = unaccent(lower(p_last_name));
END;
$$ LANGUAGE plpgsql STABLE;
