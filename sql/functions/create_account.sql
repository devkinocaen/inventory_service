CREATE OR REPLACE FUNCTION inventory.create_account(
    p_first_name TEXT,
    p_last_name TEXT,
    p_email TEXT,
    p_phone TEXT,
    p_organization_name TEXT,
    p_organization_address TEXT,
    p_role TEXT DEFAULT 'viewer',
    p_password TEXT DEFAULT 'temporaryPassword123'
)
RETURNS TABLE (
    person_id INT,
    organization_id INT,
    created_user_id UUID
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_person_id INT;
    v_org_id INT;
    v_user_id UUID;
    v_existing_person INT;
    v_check INT;
    v_role TEXT := 'viewer';
BEGIN
    ---------------------------------------------------------
    -- Vérifier que pgcrypto est installé
    ---------------------------------------------------------
    SELECT 1 INTO v_check FROM pg_proc WHERE proname='gen_salt' LIMIT 1;
    IF v_check IS NULL THEN
        RAISE EXCEPTION 'gen_salt() indisponible. Installer pgcrypto : CREATE EXTENSION pgcrypto;';
    END IF;

    SELECT 1 INTO v_check FROM pg_proc WHERE proname='crypt' LIMIT 1;
    IF v_check IS NULL THEN
        RAISE EXCEPTION 'crypt() indisponible. Installer pgcrypto : CREATE EXTENSION pgcrypto;';
    END IF;

    ---------------------------------------------------------
    -- Créer ou récupérer l'utilisateur
    ---------------------------------------------------------
    INSERT INTO auth.users(email, encrypted_password, role)
    VALUES (
        lower(p_email),
        crypt(p_password, gen_salt('bf',12)),
        v_role
    )
    ON CONFLICT (email) DO UPDATE
      SET encrypted_password = auth.users.encrypted_password
    RETURNING auth.users.id INTO v_user_id;

    ---------------------------------------------------------
    -- Insérer / mettre à jour user_profiles
    ---------------------------------------------------------
    INSERT INTO auth.user_profiles(user_id, raw_user_meta_data)
    VALUES (v_user_id, jsonb_build_object('app_metadata', jsonb_build_object('role', v_role)))
    ON CONFLICT (user_id) DO UPDATE
    SET raw_user_meta_data = COALESCE(auth.user_profiles.raw_user_meta_data, '{}'::jsonb)
                            || EXCLUDED.raw_user_meta_data;


    ---------------------------------------------------------
    -- Vérifier si l'email est déjà associé à une personne
    ---------------------------------------------------------
    SELECT id INTO v_existing_person
    FROM inventory.person
    WHERE lower(unaccent(email)) = lower(unaccent(p_email))
    LIMIT 1;

    IF v_existing_person IS NOT NULL THEN
        RETURN QUERY SELECT v_existing_person, NULL::INT, v_user_id;
        RETURN;
    END IF;

    ---------------------------------------------------------
    -- Vérifier si la personne existe par prénom+nom
    ---------------------------------------------------------
    SELECT id INTO v_person_id
    FROM inventory.person
    WHERE lower(unaccent(first_name)) = lower(unaccent(p_first_name))
      AND lower(unaccent(last_name)) = lower(unaccent(p_last_name))
    LIMIT 1;

    IF v_person_id IS NULL THEN
        INSERT INTO inventory.person(first_name, last_name, email, phone)
        VALUES (p_first_name, p_last_name, p_email, p_phone)
        RETURNING id INTO v_person_id;
    END IF;

    ---------------------------------------------------------
    -- Upsert organisation via upsert_organization
    ---------------------------------------------------------
    SELECT uo.id INTO v_org_id
    FROM inventory.upsert_organization(
        p_name := p_organization_name,
        p_referent_id := v_person_id,
        p_address := p_organization_address,
        p_person_roles := jsonb_build_array(
            jsonb_build_object('person_id', v_person_id, 'role', p_role)
        )
    ) AS uo(id INT);

    ---------------------------------------------------------
    -- Retourner les identifiants
    ---------------------------------------------------------
    RETURN QUERY SELECT v_person_id, v_org_id, v_user_id;

END;
$$;
