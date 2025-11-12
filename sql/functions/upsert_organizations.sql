CREATE OR REPLACE FUNCTION inventory.upsert_organization(
    p_name TEXT,
    p_referent_first_name TEXT,
    p_referent_last_name TEXT,
    p_referent_email TEXT DEFAULT NULL,
    p_referent_phone TEXT DEFAULT NULL,
    p_address TEXT DEFAULT NULL
)
RETURNS TABLE(
    id TEXT,
    name TEXT,
    referent_id TEXT,
    referent_first_name TEXT,
    referent_last_name TEXT,
    referent_email TEXT,
    referent_phone TEXT,
    address TEXT
)
AS $$
DECLARE
    v_referent_id INT;
    v_org_id INT;
BEGIN
    -- 1️⃣ Vérifier ou insérer le référent
    SELECT id INTO v_referent_id
    FROM inventory.person
    WHERE first_name = p_referent_first_name
      AND last_name = p_referent_last_name
    LIMIT 1;

    IF v_referent_id IS NULL THEN
        INSERT INTO inventory.person (first_name, last_name, email, phone)
        VALUES (p_referent_first_name, p_referent_last_name, p_referent_email, p_referent_phone)
        RETURNING id INTO v_referent_id;
    ELSE
        UPDATE inventory.person
        SET email = COALESCE(p_referent_email, email),
            phone = COALESCE(p_referent_phone, phone)
        WHERE id = v_referent_id;
    END IF;

    -- 2️⃣ Vérifier ou insérer l’organisation
    SELECT id INTO v_org_id
    FROM inventory.organization
    WHERE name = p_name
    LIMIT 1;

    IF v_org_id IS NULL THEN
        INSERT INTO inventory.organization (name, address, referent_id)
        VALUES (p_name, p_address, v_referent_id)
        RETURNING id INTO v_org_id;
    ELSE
        UPDATE inventory.organization
        SET referent_id = v_referent_id,
            address = COALESCE(p_address, address)
        WHERE id = v_org_id;
    END IF;

    -- 3️⃣ Retourner l’enregistrement complet
    RETURN QUERY
    SELECT
        o.id::TEXT,
        o.name::TEXT,
        o.referent_id::TEXT,
        p.first_name::TEXT AS referent_first_name,
        p.last_name::TEXT AS referent_last_name,
        p.email::TEXT AS referent_email,
        p.phone::TEXT AS referent_phone,
        o.address::TEXT
    FROM inventory.organization o
    LEFT JOIN inventory.person p ON o.referent_id = p.id
    WHERE o.id = v_org_id;

END;
$$ LANGUAGE plpgsql;
