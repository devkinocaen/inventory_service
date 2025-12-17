CREATE OR REPLACE FUNCTION inventory.create_reservable(
    p_name TEXT,
    p_serial_id TEXT,
    p_inventory_type inventory.reservable_type,
    p_owner_id INT,
    p_manager_id INT,
    p_storage_location_id INT DEFAULT NULL,
    p_category_id INT DEFAULT NULL,
    p_subcategory_id INT DEFAULT NULL,
    p_size TEXT DEFAULT '',
    p_pattern_id INT DEFAULT NULL,
    p_gender inventory.reservable_gender DEFAULT 'unisex',
    p_privacy inventory.privacy_type DEFAULT 'private',
    p_price_per_day DOUBLE PRECISION DEFAULT 0,
    p_description TEXT DEFAULT '',
    p_photos JSONB DEFAULT '[]'::jsonb,
    p_status inventory.reservable_status DEFAULT 'disponible',
    p_quality inventory.reservable_quality DEFAULT 'bon état',
    p_is_in_stock BOOLEAN DEFAULT TRUE,
    p_style_ids INT[] DEFAULT NULL,
    p_color_ids INT[] DEFAULT NULL
)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
    v_id INT;
BEGIN
    INSERT INTO inventory.reservable (
        name,
        serial_id,
        inventory_type,
        owner_id,
        manager_id,
        storage_location_id,
        category_id,
        subcategory_id,
        size,
        gender,
        privacy,
        price_per_day,
        description,
        photos,
        status,
        quality,
        is_in_stock,
        pattern_id,
        created_at
    ) VALUES (
        p_name,
        p_serial_id,
        p_inventory_type,
        p_owner_id,
        p_manager_id,
        p_storage_location_id,
        p_category_id,
        p_subcategory_id,
        p_size,
        p_gender,
        p_privacy,
        p_price_per_day,
        p_description,
        p_photos,
        p_status,
        p_quality,
        p_is_in_stock,
        p_pattern_id,
        NOW()
    )
    RETURNING id INTO v_id;

    -- 🔹 Ajouter les styles si fournis
    IF p_style_ids IS NOT NULL THEN
        INSERT INTO inventory.reservable_style_link (reservable_id, style_id)
        SELECT v_id, unnest_id
        FROM unnest(p_style_ids) AS unnest_id;
    END IF;

    -- 🔹 Ajouter les couleurs si fournies
    IF p_color_ids IS NOT NULL THEN
        INSERT INTO inventory.reservable_color_link (reservable_id, color_id)
        SELECT v_id, unnest_id
        FROM unnest(p_color_ids) AS unnest_id;
    END IF;

    RETURN v_id;
END;
$$;
