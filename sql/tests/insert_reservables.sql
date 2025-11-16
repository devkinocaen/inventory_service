DO $$
DECLARE
    rec_temp RECORD;
    row_index INT := 1;

    -- Organisation / gestion
    org_owner_id INT;
    org_manager_id INT;

    -- Stockage
    storage_location_id INT;

    -- Enums
    enum_status inventory.reservable_status;
    enum_quality inventory.reservable_quality;
    enum_type inventory.reservable_type;
    enum_gender inventory.reservable_gender;
    enum_privacy inventory.privacy_type;

    -- Catégories
    category_id_var INT;
    subcategory_id_var INT;

    -- Styles
    style_id INT;
    style_ids INT[];
    n_styles INT := 3; -- nombre de styles aléatoires à associer

    -- Reservable inséré
    inserted_reservable_id INT;
BEGIN
    -- Choisir au hasard un lieu de stockage existant
    SELECT id INTO storage_location_id
    FROM inventory.storage_location
    ORDER BY random() LIMIT 1;

    IF storage_location_id IS NULL THEN
        RAISE EXCEPTION 'Aucun lieu de stockage trouvé. Créez-en au moins un.';
    END IF;

    -- Vérification table temporaire CSV
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename='reservable_temp_raw') THEN
        RAISE EXCEPTION 'La table reservable_temp_raw n''existe pas. Charger le CSV avant.';
    END IF;

    -- Boucle sur la table temporaire
    FOR rec_temp IN SELECT * FROM reservable_temp_raw LOOP

        -- Ignorer si déjà présent
        IF EXISTS (SELECT 1 FROM inventory.reservable WHERE name = rec_temp.name) THEN
            CONTINUE;
        END IF;

        -- Tirer deux organisations différentes
        SELECT o1.id, o2.id INTO org_owner_id, org_manager_id
        FROM inventory.organization o1
        JOIN inventory.organization o2 ON o1.id <> o2.id
        ORDER BY random()
        LIMIT 1;

        IF org_owner_id IS NULL OR org_manager_id IS NULL THEN
            RAISE EXCEPTION 'Pas assez d''organisations pour assigner owner et manager différents.';
        END IF;

        -- Enums aléatoires
        SELECT enumlabel::inventory.reservable_status INTO enum_status
        FROM unnest(enum_range(NULL::inventory.reservable_status)) AS enumlabel
        ORDER BY random() LIMIT 1;

        SELECT enumlabel::inventory.reservable_quality INTO enum_quality
        FROM unnest(enum_range(NULL::inventory.reservable_quality)) AS enumlabel
        ORDER BY random() LIMIT 1;

        enum_type := 'costume'::inventory.reservable_type;

        SELECT enumlabel::inventory.reservable_gender INTO enum_gender
        FROM unnest(enum_range(NULL::inventory.reservable_gender)) AS enumlabel
        ORDER BY random() LIMIT 1;

        SELECT enumlabel::inventory.privacy_type INTO enum_privacy
        FROM unnest(enum_range(NULL::inventory.privacy_type)) AS enumlabel
        ORDER BY random() LIMIT 1;

        -- Catégorie / sous-catégorie
        SELECT id INTO category_id_var
        FROM inventory.reservable_category
        ORDER BY random() LIMIT 1;

        IF category_id_var IS NULL THEN
            INSERT INTO inventory.reservable_category(name) VALUES ('Autres')
            RETURNING id INTO category_id_var;
        END IF;

        SELECT id INTO subcategory_id_var
        FROM inventory.reservable_subcategory
        WHERE category_id = category_id_var
        ORDER BY random() LIMIT 1;

        IF subcategory_id_var IS NULL THEN
            INSERT INTO inventory.reservable_subcategory(name, category_id)
            VALUES ('Autres', category_id_var)
            RETURNING id INTO subcategory_id_var;
        END IF;

        -- Insertion du reservable
        INSERT INTO inventory.reservable (
            name,
            inventory_type,
            owner_id,
            manager_id,
            status,
            quality,
            storage_location_id,
            category_id,
            subcategory_id,
            size,
            gender,
            price_per_day,
            privacy,
            description,
            photos
        )
        VALUES (
            rec_temp.name,
            enum_type,
            org_owner_id,
            org_manager_id,
            enum_status,
            enum_quality,
            storage_location_id,
            category_id_var,
            subcategory_id_var,
            rec_temp.size,
            enum_gender,
            CASE WHEN rec_temp.price_per_day IS NULL OR trim(rec_temp.price_per_day) = '' THEN 0 ELSE rec_temp.price_per_day::numeric END,
            enum_privacy,
            rec_temp.description,
            jsonb_build_array(
                jsonb_build_object('url', COALESCE(NULLIF(rec_temp.photo1,''), format('https://picsum.photos/seed/%sa/150/100', row_index)), 'caption','Vue 1'),
                jsonb_build_object('url', COALESCE(NULLIF(rec_temp.photo2,''), format('https://picsum.photos/seed/%sb/150/100', row_index)), 'caption','Vue 2'),
                jsonb_build_object('url', COALESCE(NULLIF(rec_temp.photo3,''), format('https://picsum.photos/seed/%sc/150/100', row_index)), 'caption','Vue 3')
            )
        )
        RETURNING id INTO inserted_reservable_id;

        -- Associer N styles aléatoires
        style_ids := ARRAY(
            SELECT id FROM inventory.reservable_style ORDER BY random() LIMIT n_styles
        );

        FOREACH style_id IN ARRAY style_ids LOOP
            INSERT INTO inventory.reservable_style_link(reservable_id, style_id)
            VALUES (inserted_reservable_id, style_id)
            ON CONFLICT DO NOTHING;
        END LOOP;

        row_index := row_index + 1;
    END LOOP;

    -- Réaligner la séquence
    PERFORM setval(
        pg_get_serial_sequence('inventory.reservable','id'),
        GREATEST((SELECT COALESCE(MAX(id),0) FROM inventory.reservable), 1),
        true
    );

    -- Supprimer la table temporaire
    DROP TABLE IF EXISTS reservable_temp_raw;

END;
$$ LANGUAGE plpgsql;
