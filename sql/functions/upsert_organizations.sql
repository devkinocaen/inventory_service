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
AS $$
DECLARE
    v_org_id INT;
    v_existing_ids INT[];
    v_pid INT;
    v_referent_phone TEXT;
BEGIN
    -- Vérifier que le referent existe et a un numéro de téléphone
    IF p_referent_id IS NULL THEN
        RAISE EXCEPTION 'Le référent est obligatoire';
    END IF;

    SELECT phone INTO v_referent_phone
    FROM inventory.person
    WHERE id = p_referent_id;

    IF v_referent_phone IS NULL THEN
        RAISE EXCEPTION 'Le référent doit avoir un numéro de téléphone';
    END IF;

    -- Vérifier ou insérer l’organisation
    SELECT id INTO v_org_id
    FROM inventory.organization
    WHERE name = p_name
    LIMIT 1;

    IF v_org_id IS NULL THEN
        INSERT INTO inventory.organization (name, address, referent_id)
        VALUES (p_name, p_address, p_referent_id)
        RETURNING id INTO v_org_id;
    ELSE
        UPDATE inventory.organization
        SET address = COALESCE(p_address, address),
            referent_id = COALESCE(p_referent_id, referent_id)
        WHERE id = v_org_id;
    END IF;

    -- Récupérer les liens existants
    SELECT array_agg(person_id) INTO v_existing_ids
    FROM inventory.organization_person
    WHERE organization_id = v_org_id;

    -- Supprimer les liens qui ne sont plus dans p_person_ids
    DELETE FROM inventory.organization_person
    WHERE organization_id = v_org_id
      AND person_id <> ALL (p_person_ids);

    -- Ajouter les nouveaux liens
    FOREACH v_pid IN ARRAY p_person_ids LOOP
        INSERT INTO inventory.organization_person(organization_id, person_id)
        VALUES (v_org_id, v_pid)
        ON CONFLICT (organization_id, person_id) DO NOTHING;
    END LOOP;

    -- Retourner l’organisation
    RETURN QUERY
    SELECT o.id, o.name, o.address, o.referent_id
    FROM inventory.organization o
    WHERE o.id = v_org_id;
END;
$$ LANGUAGE plpgsql;
