CREATE OR REPLACE FUNCTION inventory.upsert_person(
    p_id INT,
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
DECLARE
    v_exists BOOLEAN;
BEGIN
    -- Vérification des champs obligatoires
    IF p_first_name IS NULL OR LENGTH(TRIM(p_first_name)) = 0 THEN
        RAISE EXCEPTION 'Le prénom ne peut pas être vide';
    END IF;
    IF p_last_name IS NULL OR LENGTH(TRIM(p_last_name)) = 0 THEN
        RAISE EXCEPTION 'Le nom ne peut pas être vide';
    END IF;

    -- CAS 1 : INSERT
    IF p_id IS NULL THEN
        RETURN QUERY
        INSERT INTO inventory.person (first_name, last_name, email, phone, address)
        VALUES (p_first_name, p_last_name, p_email, p_phone, p_address)
        RETURNING id, first_name, last_name, email, phone, address;

        RETURN;
    END IF;

    -- CAS 2 : UPDATE
    -- Vérifier l'existence de l'id
    SELECT TRUE INTO v_exists
    FROM inventory.person
    WHERE id = p_id;

    IF NOT v_exists THEN
        RAISE EXCEPTION 'Impossible de mettre à jour : id % introuvable', p_id;
    END IF;

    -- UPDATE avec COALESCE
    RETURN QUERY
    UPDATE inventory.person
    SET
        first_name = p_first_name,
        last_name  = p_last_name,
        email      = COALESCE(p_email, email),
        phone      = COALESCE(p_phone, phone),
        address    = COALESCE(p_address, address)
    WHERE id = p_id
    RETURNING id, first_name, last_name, email, phone, address;

END;
$$;
