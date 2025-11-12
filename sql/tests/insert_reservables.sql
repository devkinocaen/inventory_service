DO $$
DECLARE
    r RECORD;
    i INT := 1;
    v_owner INT;
    v_manager INT;
    v_size_id INT;
    v_size_type_id INT;
    v_cat_id INT;
    v_subcat_id INT;
    v_storage_id INT;
    v_new_label TEXT;
BEGIN
    -- fallback owner/manager : première organisation
    SELECT id INTO v_owner FROM inventory.organization ORDER BY id LIMIT 1;
    IF v_owner IS NULL THEN
        RAISE EXCEPTION 'Aucune organisation trouvée. Créez-en au moins une.';
    END IF;
    v_manager := v_owner;

    -- stockage par défaut
    SELECT id INTO v_storage_id FROM inventory.storage_location ORDER BY id LIMIT 1;
    IF v_storage_id IS NULL THEN
        RAISE EXCEPTION 'Aucun lieu de stockage trouvé. Créez-en au moins un.';
    END IF;

    -- Vérification table temporaire CSV
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename='reservable_temp_raw') THEN
        RAISE EXCEPTION 'La table reservable_temp_raw n''existe pas. Charger le CSV avant.';
    END IF;

    -- Boucle sur la table temporaire
    FOR r IN SELECT * FROM reservable_temp_raw LOOP

        -- Ignorer si déjà présent
        IF EXISTS (SELECT 1 FROM inventory.reservable WHERE name = r.name) THEN
            CONTINUE;
        END IF;

        -- Category : créer si inexistante
        SELECT id INTO v_cat_id
        FROM inventory.reservable_category
        WHERE name = r.category
        LIMIT 1;
        IF v_cat_id IS NULL THEN
            INSERT INTO inventory.reservable_category(name) VALUES (r.category)
            RETURNING id INTO v_cat_id;
        END IF;

        -- Subcategory : créer si inexistante
        SELECT id INTO v_subcat_id
        FROM inventory.reservable_subcategory
        WHERE name = r.subcategory AND category_id = v_cat_id
        LIMIT 1;
        IF v_subcat_id IS NULL THEN
            INSERT INTO inventory.reservable_subcategory(name, category_id)
            VALUES (r.subcategory, v_cat_id)
            RETURNING id INTO v_subcat_id;
        END IF;

        -- Size : soit récupérer size_label, soit créer une nouvelle taille
        IF r.size_label IS NOT NULL AND trim(r.size_label) <> '' THEN
            SELECT id INTO v_size_id FROM inventory.size WHERE label = r.size_label LIMIT 1;
        ELSE
            -- Choisir un type de taille aléatoire
            SELECT id INTO v_size_type_id
            FROM inventory.size_type
            ORDER BY random()
            LIMIT 1;

            -- Créer un nouveau label de taille basé sur l'index i
            v_new_label := format('Taille %s', i);

            -- Insérer la nouvelle taille
            INSERT INTO inventory.size(size_type_id, label)
            VALUES (v_size_type_id, v_new_label)
            RETURNING id INTO v_size_id;
        END IF;

        -- Insertion finale
        INSERT INTO inventory.reservable (
            name,
            inventory_type,
            owner_id,
            manager_id,
            status,
            storage_location_id,
            category_id,
            subcategory_id,
            size_id,
            gender,
            price_per_day,
            privacy,
            description,
            photos
        )
        VALUES (
            r.name,
            r.inventory_type::inventory.reservable_type,
            v_owner,
            v_manager,
            COALESCE(NULLIF(r.status,''),'disponible')::inventory.reservable_status,
            v_storage_id,
            v_cat_id,
            v_subcat_id,
            v_size_id,
            r.gender::inventory.reservable_gender,
            CASE WHEN r.price_per_day IS NULL OR trim(r.price_per_day) = '' THEN 0 ELSE r.price_per_day::numeric END,
            COALESCE(NULLIF(r.privacy,''),'private')::inventory.privacy_type,
            r.description,
            jsonb_build_array(
                jsonb_build_object(
                    'url', COALESCE(NULLIF(r.photo_url1,''), format('https://picsum.photos/seed/%sa/150/100', i)),
                    'caption', 'Vue 1'
                ),
                jsonb_build_object(
                    'url', COALESCE(NULLIF(r.photo_url2,''), format('https://picsum.photos/seed/%sb/150/100', i)),
                    'caption', 'Vue 2'
                ),
                jsonb_build_object(
                    'url', COALESCE(NULLIF(r.photo_url3,''), format('https://picsum.photos/seed/%sc/150/100', i)),
                    'caption', 'Vue 3'
                )
            )
        )
        ON CONFLICT (name) DO NOTHING;

        i := i + 1;
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
