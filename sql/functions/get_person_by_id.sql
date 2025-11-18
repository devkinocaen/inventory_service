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
    SELECT id, first_name, last_name, address, email, phone
    FROM inventory.person
    WHERE id = p_id;
END;
$$ LANGUAGE plpgsql STABLE;
