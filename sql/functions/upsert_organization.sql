CREATE OR REPLACE FUNCTION inventory.upsert_organization(
    p_name TEXT,
    p_referent_id INT,
    p_address TEXT DEFAULT NULL,
    p_person_roles JSONB DEFAULT '[]'  -- [{"person_id":7,"role":"manager"}, ...]
)
RETURNS TABLE(
    org_id INT,
    org_name TEXT,
    org_address TEXT,
    org_referent_id INT
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
        INSERT INTO inventory.organization AS o (name, address, referent_id)
        VALUES (p_name, p_address, p_referent_id)
        RETURNING o.id INTO v_org_id;
    ELSE
        UPDATE inventory.organization AS o
        SET address = COALESCE(p_address, o.address),
            referent_id = COALESCE(p_referent_id, o.referent_id)
        WHERE o.id = v_org_id;
    END IF;

    ----------------------------------------------------
    -- 3) Supprimer les liens absents
    ----------------------------------------------------
    DELETE FROM inventory.organization_person AS op
    WHERE op.organization_id = v_org_id
      AND op.person_id NOT IN (
          SELECT (item->>'person_id')::INT
          FROM jsonb_array_elements(p_person_roles) AS item
      );

    ----------------------------------------------------
    -- 4) Ajouter / mettre à jour les liens avec rôle
    ----------------------------------------------------
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_person_roles)
    LOOP
        v_pid := (v_item->>'person_id')::INT;
        v_prole := v_item->>'role';

        INSERT INTO inventory.organization_person (organization_id, person_id, role)
        VALUES (v_org_id, v_pid, v_prole)
        ON CONFLICT (organization_id, person_id)
        DO UPDATE SET role = EXCLUDED.role;
    END LOOP;

    ----------------------------------------------------
    -- 5) Retourner l’organisation avec préfixe
    ----------------------------------------------------
    RETURN QUERY
    SELECT o.id AS org_id,
           o.name::TEXT AS org_name,
           o.address::TEXT AS org_address,
           o.referent_id AS org_referent_id
    FROM inventory.organization AS o
    WHERE o.id = v_org_id;

END;
$$;
