CREATE OR REPLACE FUNCTION inventory.upsert_organization(
    p_name TEXT,
    p_address TEXT DEFAULT NULL,
    p_referent_id INT DEFAULT NULL
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
    v_valid_referent INT;
BEGIN
    -- Vérifier que le referent existe
    IF p_referent_id IS NOT NULL THEN
        SELECT id INTO v_valid_referent
        FROM inventory.person
        WHERE id = p_referent_id;

        IF v_valid_referent IS NULL THEN
            RAISE EXCEPTION 'Referent ID % n''existe pas', p_referent_id;
        END IF;
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

    -- Retourner l’enregistrement complet
    RETURN QUERY
    SELECT o.id, o.name, o.address, o.referent_id
    FROM inventory.organization o
    WHERE o.id = v_org_id;
END;
$$ LANGUAGE plpgsql;
