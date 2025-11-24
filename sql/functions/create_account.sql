CREATE OR REPLACE FUNCTION inventory.create_account(
    p_first_name TEXT,
    p_last_name TEXT,
    p_email TEXT,
    p_phone TEXT,
    p_organization_name TEXT,
    p_organization_address TEXT,
    p_role TEXT DEFAULT NULL
)
RETURNS TABLE (
    person_id INT,
    organization_id INT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_person_id INT;
    v_org_id INT;
BEGIN
    ---------------------------------------------------------
    -- 1. Vérifier si la personne existe déjà
    ---------------------------------------------------------
    SELECT id INTO v_person_id
    FROM inventory.person
    WHERE lower(unaccent(first_name)) = lower(unaccent(p_first_name))
      AND lower(unaccent(last_name))  = lower(unaccent(p_last_name));

    IF v_person_id IS NOT NULL THEN
        RAISE EXCEPTION 'La personne "%" "%" existe déjà.', p_first_name, p_last_name
            USING ERRCODE = 'unique_violation';
    END IF;

    ---------------------------------------------------------
    -- 2. Créer la personne
    ---------------------------------------------------------
    INSERT INTO inventory.person (first_name, last_name, email, phone)
    VALUES (p_first_name, p_last_name, p_email, p_phone)
    RETURNING id INTO v_person_id;

    ---------------------------------------------------------
    -- 3. Créer ou mettre à jour l'organisation via upsert
    ---------------------------------------------------------
    -- On considère la personne nouvellement créée comme référent
    -- et on gère le lien personne ↔ organisation via p_person_roles

    SELECT uo.id
    INTO v_org_id
    FROM inventory.upsert_organization(
        p_name := p_organization_name,
        p_referent_id := v_person_id,
        p_address := p_organization_address,
        p_person_roles := jsonb_build_array(
            jsonb_build_object('person_id', v_person_id, 'role', p_role)
        )
    ) AS uo;  -- <-- plus de "(id INT, name TEXT, ...)"


    -- ❌ Plus besoin de ce bloc :
    -- INSERT INTO inventory.organization_person (organization_id, person_id, role)
    -- VALUES (v_org_id, v_person_id, p_role);
        

    ---------------------------------------------------------
    -- 4. Retourner les IDs
    ---------------------------------------------------------
    RETURN QUERY SELECT v_person_id, v_org_id;

END;
$$;
