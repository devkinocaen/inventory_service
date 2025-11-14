CREATE OR REPLACE FUNCTION inventory.delete_organization(
    p_org_id INT
)
RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
    v_exists INT;
BEGIN
    -- Vérifier que l'organisation existe
    SELECT id INTO v_exists
    FROM inventory.organization
    WHERE id = p_org_id;

    IF v_exists IS NULL THEN
        RAISE EXCEPTION 'Organisation ID % n''existe pas', p_org_id;
    END IF;

    -- Suppression (les liens avec les personnes seront supprimés en cascade)
    DELETE FROM inventory.organization
    WHERE id = p_org_id;
END;
$$;
