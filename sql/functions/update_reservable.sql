CREATE OR REPLACE FUNCTION inventory.update_reservable(
    p_id INT,
    p_name TEXT DEFAULT NULL,
    p_serial_id TEXT DEFAULT NULL,
    p_inventory_type inventory.reservable_type DEFAULT NULL,
    p_owner_id INT DEFAULT NULL,
    p_manager_id INT DEFAULT NULL,
    p_storage_location_id INT DEFAULT NULL,
    p_category_id INT DEFAULT NULL,
    p_subcategory_id INT DEFAULT NULL,
    p_size TEXT DEFAULT NULL,
    p_gender inventory.reservable_gender DEFAULT NULL,
    p_privacy inventory.privacy_type DEFAULT NULL,
    p_price_per_day double precision DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_photos JSONB DEFAULT NULL,
    p_status inventory.reservable_status DEFAULT NULL,
    p_quality inventory.reservable_quality DEFAULT NULL,
    p_is_in_stock BOOLEAN DEFAULT NULL,
    p_style_ids INT[] DEFAULT NULL,
    p_color_ids INT[] DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_old_category INT;
    v_old_subcategory INT;
    v_new_category INT;
    v_new_subcategory INT;
BEGIN
    -- Récupérer les valeurs actuelles
    SELECT category_id, subcategory_id
    INTO v_old_category, v_old_subcategory
    FROM inventory.reservable
    WHERE id = p_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'reservable id=% not found', p_id;
    END IF;

    -- Déterminer la nouvelle catégorie (COALESCE comme demandé)
    v_new_category := COALESCE(p_category_id, v_old_category);

    -- Détermination de la nouvelle subcategory selon les règles
    IF p_subcategory_id IS NOT NULL THEN
        v_new_subcategory := p_subcategory_id;
    ELSIF p_category_id IS NOT NULL AND p_category_id <> v_old_category THEN
        v_new_subcategory := NULL;
    ELSE
        v_new_subcategory := v_old_subcategory;
    END IF;

    -- Vérification de cohérence
    IF v_new_subcategory IS NOT NULL THEN
        PERFORM 1
        FROM inventory.reservable_subcategory s
        WHERE s.id = v_new_subcategory
          AND s.category_id IS NOT DISTINCT FROM v_new_category;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Subcategory % does not belong to category %', v_new_subcategory, v_new_category;
        END IF;
    END IF;

    -- Mise à jour principale
    UPDATE inventory.reservable
    SET
        name = COALESCE(p_name, name),
        serial_id = COALESCE(p_serial_id, serial_id),
        inventory_type = COALESCE(p_inventory_type, inventory_type),
        owner_id = COALESCE(p_owner_id, owner_id),
        manager_id = COALESCE(p_manager_id, manager_id),
        storage_location_id = COALESCE(p_storage_location_id, storage_location_id),
        category_id = v_new_category,
        subcategory_id = v_new_subcategory,
        size = COALESCE(p_size, size),
        gender = COALESCE(p_gender, gender),
        privacy = COALESCE(p_privacy, privacy),
        price_per_day = COALESCE(p_price_per_day, price_per_day),
        description = COALESCE(p_description, description),
        photos = COALESCE(p_photos, photos),
        status = COALESCE(p_status, status),
        quality = COALESCE(p_quality, quality),
        is_in_stock = COALESCE(p_is_in_stock, is_in_stock)
    WHERE id = p_id;

    -- Mise à jour des styles si fournis
    IF p_style_ids IS NOT NULL THEN
        DELETE FROM inventory.reservable_style_link
        WHERE reservable_id = p_id;

        INSERT INTO inventory.reservable_style_link (reservable_id, style_id)
        SELECT p_id, unnest(p_style_ids);
    END IF;

    -- Mise à jour des couleurs si fournies
    IF p_color_ids IS NOT NULL THEN
        DELETE FROM inventory.reservable_color_link
        WHERE reservable_id = p_id;

        INSERT INTO inventory.reservable_color_link (reservable_id, color_id)
        SELECT p_id, unnest(p_color_ids);
    END IF;
END;
$$;
