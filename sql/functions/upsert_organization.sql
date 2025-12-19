CREATE OR REPLACE FUNCTION inventory.upsert_organization(
    p_name TEXT,
    p_referent_id INT,
    p_address TEXT DEFAULT NULL,
    p_is_individual BOOLEAN DEFAULT NULL,
    p_is_costume_renter BOOLEAN DEFAULT NULL,
    p_person_roles JSONB DEFAULT '[]'  -- [{"person_id":7,"role":"manager"}, ...]
)
RETURNS TABLE(
    org_id INT,
    org_name TEXT,
    org_address TEXT,
    org_referent_id INT,
    is_individual BOOLEAN,
    is_costume_renter BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_org_id INT;
    v_pid INT;
    v_prole TEXT;
    v_referent_phone TEXT;
    v_item JSONB;
    v_roles JSONB;
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

    IF v_referent_phone IS NULL OR v_referent_phone = '' THEN
        RAISE EXCEPTION 'Le référent doit avoir un numéro de téléphone';
    END IF;

    ----------------------------------------------------
    -- 2) Upsert organisation
    ----------------------------------------------------
    SELECT o.id
    INTO v_org_id
    FROM inventory.organization AS o
    WHERE o.name = p_name
    LIMIT 1;

    IF v_org_id IS NULL THEN
        INSERT INTO inventory.organization AS o (
            name, address, referent_id, is_individual, is_costume_renter
        )
        VALUES (
            p_name,
            p_address,
            p_referent_id,
            COALESCE(p_is_individual, FALSE),
            COALESCE(p_is_costume_renter, FALSE)
        )
        RETURNING o.id INTO v_org_id;
    ELSE
        UPDATE inventory.organization AS o
        SET address = COALESCE(p_address, o.address),
            referent_id = COALESCE(p_referent_id, o.referent_id),
            is_individual = COALESCE(p_is_individual, o.is_individual),
            is_costume_renter = COALESCE(p_is_costume_renter, o.is_costume_renter)
        WHERE o.id = v_org_id;
    END IF;

    ----------------------------------------------------
    -- 3) Ajuster les rôles si particulier
    ----------------------------------------------------
    IF COALESCE(p_is_individual, FALSE) THEN
        -- un particulier : seule la personne référent est autorisée
        v_roles := jsonb_build_array(jsonb_build_object(
            'person_id', p_referent_id,
            'role', 'referent'
        ));
    ELSE
        v_roles := p_person_roles;
    END IF;

    ----------------------------------------------------
    -- 4) Supprimer les liens absents
    ----------------------------------------------------
    DELETE FROM inventory.organization_person AS op
    WHERE op.organization_id = v_org_id
      AND op.person_id NOT IN (
          SELECT (item->>'person_id')::INT
          FROM jsonb_array_elements(v_roles) AS item
      );

    ----------------------------------------------------
    -- 5) Ajouter / mettre à jour les liens avec rôle
    ----------------------------------------------------
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_roles)
    LOOP
        v_pid := (v_item->>'person_id')::INT;
        v_prole := v_item->>'role';

        INSERT INTO inventory.organization_person (organization_id, person_id, role)
        VALUES (v_org_id, v_pid, v_prole)
        ON CONFLICT (organization_id, person_id)
        DO UPDATE SET role = EXCLUDED.role;
    END LOOP;

    ----------------------------------------------------
    -- 6) Retourner l’organisation
    ----------------------------------------------------
    RETURN QUERY
    SELECT o.id AS org_id,
           o.name::TEXT AS org_name,
           o.address::TEXT AS org_address,
           o.referent_id AS org_referent_id,
           o.is_individual,
           o.is_costume_renter
    FROM inventory.organization AS o
    WHERE o.id = v_org_id;

END;
$$;
