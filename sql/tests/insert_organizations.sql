DO $$
DECLARE
    r RECORD;
    v_referent_id INT;
    v_person_id INT;
    roles TEXT[] := ARRAY['assistant','technicien','costumier','real'];
    n INT;
BEGIN
    -- Vérification table temporaire CSV
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables WHERE tablename = 'organizations_temp_raw'
    ) THEN
        RAISE EXCEPTION 'La table organizations_temp_raw n''existe pas. Charger le CSV avant.';
    END IF;

    -- Boucle sur la table temporaire
    FOR r IN SELECT * FROM organizations_temp_raw LOOP

        -- Ignorer si déjà présent
        IF EXISTS (
            SELECT 1
            FROM inventory.organization
            WHERE name = trim(r.name)
        ) THEN
            CONTINUE;
        END IF;

        -- Choisir un référent au hasard parmi les personnes avec téléphone
        SELECT id INTO v_referent_id
        FROM inventory.person
        WHERE phone IS NOT NULL AND trim(phone) <> ''
        ORDER BY random()
        LIMIT 1;

        -- Insertion de l'organisation
        INSERT INTO inventory.organization (
            name,
            address,
            referent_id
        )
        VALUES (
            trim(r.name),
            NULLIF(trim(r.address), ''),
            v_referent_id
        )
        ON CONFLICT (name) DO NOTHING;

        -- Associer 0 à 3 autres personnes avec rôle aléatoire
        FOR n IN 1..(floor(random()*4)::int) LOOP
            SELECT id INTO v_person_id
            FROM inventory.person
            WHERE id <> v_referent_id
            ORDER BY random()
            LIMIT 1;

            INSERT INTO inventory.organization_person (
                organization_id,
                person_id,
                role
            )
            VALUES (
                (SELECT id FROM inventory.organization WHERE name = trim(r.name) LIMIT 1),
                v_person_id,
                roles[ceil(random()*array_length(roles,1))::int]
            )
            ON CONFLICT (organization_id, person_id) DO NOTHING;
        END LOOP;

    END LOOP;

    -- Réaligner la séquence
    PERFORM setval(
        pg_get_serial_sequence('inventory.organization','id'),
        GREATEST((SELECT COALESCE(MAX(id),0) FROM inventory.organization), 1),
        true
    );

    -- Supprimer la table temporaire
    DROP TABLE IF EXISTS organizations_temp_raw;

END;
$$ LANGUAGE plpgsql;
