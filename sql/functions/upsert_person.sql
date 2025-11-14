CREATE OR REPLACE FUNCTION inventory.upsert_person(
    p_first_name TEXT,
    p_last_name TEXT,
    p_email TEXT DEFAULT NULL,
    p_phone TEXT DEFAULT NULL,
    p_address TEXT DEFAULT NULL
)
RETURNS TABLE (
    person_id INT,
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    phone TEXT,
    address TEXT
)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    INSERT INTO inventory.person(first_name, last_name, email, phone, address)
    VALUES (p_first_name, p_last_name, p_email, p_phone, p_address)
    ON CONFLICT (first_name, last_name)
    DO UPDATE SET
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        address = EXCLUDED.address
    RETURNING id, first_name, last_name, email, phone, address;
END;
$$;
