CREATE OR REPLACE FUNCTION inventory.upsert_organization(
    p_name TEXT,
    p_referent_id INT,
    p_address TEXT DEFAULT NULL,
    p_person_ids INT[] DEFAULT '{}'
)
RETURNS TABLE(
    id INT,
    name TEXT,
    address TEXT,
    referent_id INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_org_id INT;
    v_existing_ids INT[];
    v_pid INT;
    v_referent_phone TEXT;
BEGIN
    -----------------------------------------------------------------------
    -- 1) Vérifier que le référent existe et possède un numéro de téléphone
    -----------------------------------------------------------------------
    IF p_referent_id IS NULL THEN
        RAISE EXCEPTION 'Le référent est obligatoire';
    END IF;

    SELECT p.phone
    INTO v_referent_phone
    FROM inventory.person AS p
    WHERE p.id = p_referent_id;

    IF v_referent_phone IS NULL THEN
        RAISE EXCEPTION 'Le référent doit avoir un numéro de téléphone';
    END IF;

    ----------------------------------------------------
    -- 2) Upsert organisation (via SELECT + UPDATE/INSERT)
    ----------------------------------------------------
    SELECT o.id
    INTO v_org_id
    FROM inventory.organization AS o
    WHERE o.name = p_name
    LIMIT 1;

    IF v_org_id IS NULL THEN
        INSERT INTO inventory.organization (name, address, referent_id)
        VALUES (p_name, p_address, p_referent_id)
        RETURNING organization.id INTO v_org_id;
    ELSE
        UPDATE inventory.organization AS organization
        SET address = COALESCE(p_address, organization.address),
            referent_id = COALESCE(p_referent_id, organization.referent_id)
        WHERE organization.id = v_org_id;
    END IF;

    ----------------------------------------------------
    -- 3) Récupérer les liens existants
    ----------------------------------------------------
    SELECT array_agg(op.person_id)
    INTO v_existing_ids
    FROM inventory.organization_person AS op
    WHERE op.organization_id = v_org_id;

    ----------------------------------------------------
    -- 4) Supprimer les liens absents dans p_person_ids
    ----------------------------------------------------
    DELETE FROM inventory.organization_person AS op
    WHERE op.organization_id = v_org_id
      AND op.person_id NOT IN (SELECT UNNEST(p_person_ids));

    ----------------------------------------------------
    -- 5) Ajouter les nouveaux liens
    ----------------------------------------------------
    FOREACH v_pid IN ARRAY p_person_ids LOOP
        INSERT INTO inventory.organization_person (organization_id, person_id)
        VALUES (v_org_id, v_pid)
        ON CONFLICT (organization_id, person_id) DO NOTHING;
    END LOOP;

    ----------------------------------------------------
    -- 6) Retourner l’enregistrement final
    ----------------------------------------------------
    RETURN QUERY
    SELECT o.id, o.name::TEXT, o.address::TEXT, o.referent_id
    FROM inventory.organization AS o
    WHERE o.id = v_org_id;

END;
$$;
