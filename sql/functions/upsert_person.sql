CREATE OR REPLACE FUNCTION inventory.upsert_person(
    p_first_name TEXT,
    p_last_name TEXT,
    p_email TEXT,
    p_phone TEXT,
    p_address TEXT
)
RETURNS TABLE (
    id INT,
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    phone TEXT,
    address TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Vérification des champs obligatoires
    IF p_first_name IS NULL OR LENGTH(TRIM(p_first_name)) = 0 THEN
        RAISE EXCEPTION 'Le prénom ne peut pas être vide';
    END IF;
    IF p_last_name IS NULL OR LENGTH(TRIM(p_last_name)) = 0 THEN
        RAISE EXCEPTION 'Le nom ne peut pas être vide';
    END IF;

    RETURN QUERY
    INSERT INTO inventory.person (first_name, last_name, email, phone, address)
    VALUES (p_first_name, p_last_name, p_email, p_phone, p_address)
    ON CONFLICT ON CONSTRAINT person_first_name_last_name_key
    DO UPDATE SET
        email   = EXCLUDED.email,
        phone   = EXCLUDED.phone,
        address = EXCLUDED.address
    RETURNING
        inventory.person.id,
        inventory.person.first_name::TEXT,
        inventory.person.last_name::TEXT,
        inventory.person.email::TEXT,
        inventory.person.phone::TEXT,
        inventory.person.address::TEXT;
END;
$$;
