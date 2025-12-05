CREATE OR REPLACE FUNCTION inventory.get_reservables(
    p_type inventory.reservable_type DEFAULT NULL,
    p_category_ids INT[] DEFAULT NULL,
    p_subcategory_ids INT[] DEFAULT NULL,
    p_gender inventory.reservable_gender[] DEFAULT NULL,
    p_style_ids INT[] DEFAULT NULL,
    p_status_ids inventory.reservable_status[] DEFAULT NULL,
    p_start_date TIMESTAMP DEFAULT NULL,
    p_end_date TIMESTAMP DEFAULT NULL,
    p_is_in_stock BOOLEAN DEFAULT NULL,
    p_privacy_min inventory.privacy_type DEFAULT NULL,
    p_color_ids INT[] DEFAULT NULL        -- <<< NOUVEAU PARAMÈTRE
)
RETURNS TABLE (
    id INT,
    name TEXT,
    serial_id TEXT,
    description TEXT,
    price_per_day double precision,
    photos JSONB,
    gender inventory.reservable_gender,
    privacy inventory.privacy_type,
    inventory_type inventory.reservable_type,
    type_id INT,
    type_name TEXT,
    category_id INT,
    category_name TEXT,
    subcategory_id INT,
    subcategory_name TEXT,
    status TEXT,
    quality TEXT,
    is_in_stock BOOLEAN,
    storage_location_id INT,
    storage_location_name TEXT,
    owner_id INT,
    owner_name TEXT,
    manager_id INT,
    manager_name TEXT,
    size TEXT,
    style_ids INT[],
    style_names TEXT[],
    colors JSONB
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.id,
        r.name::text,
        r.serial_id::text,
        r.description::text,
        r.price_per_day,
        r.photos,
        r.gender,
        r.privacy,
        r.inventory_type,
        NULL::INT AS type_id,
        r.inventory_type::text AS type_name,
        r.category_id,
        c.name::text AS category_name,
        r.subcategory_id,
        sc.name::text AS subcategory_name,
        r.status::text AS status,
        r.quality::text AS quality,
        r.is_in_stock,
        r.storage_location_id,
        sl.name::text AS storage_location_name,
        r.owner_id,
        o.name::text AS owner_name,
        r.manager_id,
        m.name::text AS manager_name,
        r.size::text,
        array_agg(DISTINCT rs.id)   FILTER (WHERE rs.id IS NOT NULL) AS style_ids,
        array_agg(DISTINCT rs.name) FILTER (WHERE rs.name IS NOT NULL) AS style_names,

        COALESCE(
            jsonb_agg(
                DISTINCT jsonb_build_object(
                    'id', c2.id,
                    'name', c2.name,
                    'hex_code', c2.hex_code
                )
            ) FILTER (WHERE c2.id IS NOT NULL),
            '[]'::jsonb
        ) AS colors

    FROM inventory.reservable r
    LEFT JOIN inventory.reservable_category c ON c.id = r.category_id
    LEFT JOIN inventory.reservable_subcategory sc ON sc.id = r.subcategory_id
    LEFT JOIN inventory.storage_location sl ON sl.id = r.storage_location_id
    LEFT JOIN inventory.organization o ON o.id = r.owner_id
    LEFT JOIN inventory.organization m ON m.id = r.manager_id

    LEFT JOIN inventory.reservable_style_link rsl ON rsl.reservable_id = r.id
    LEFT JOIN inventory.reservable_style rs ON rs.id = rsl.style_id

    LEFT JOIN inventory.reservable_color rc ON rc.reservable_id = r.id
    LEFT JOIN inventory.color c2 ON c2.id = rc.color_id

    WHERE
        (p_type IS NULL OR r.inventory_type = p_type)
        AND (p_category_ids IS NULL OR r.category_id = ANY(p_category_ids))
        AND (p_subcategory_ids IS NULL OR r.subcategory_id = ANY(p_subcategory_ids))
        AND (p_gender IS NULL OR r.gender = ANY(p_gender))
        AND (p_status_ids IS NULL OR r.status = ANY(p_status_ids))

        AND (
            p_privacy_min IS NULL
            OR array_position(ARRAY['hidden','private','public']::text[], r.privacy::text)
                >= array_position(ARRAY['hidden','private','public']::text[], p_privacy_min::text)
        )

        AND (p_is_in_stock IS NULL OR p_is_in_stock = r.is_in_stock)

        -- === FILTRE STYLES ===
        AND (
            p_style_ids IS NULL
            OR EXISTS (
                SELECT 1
                FROM inventory.reservable_style_link rsl2
                WHERE rsl2.reservable_id = r.id
                AND rsl2.style_id = ANY(p_style_ids)
            )
        )

        -- === FILTRE COULEURS (intersection) ===
        AND (
            p_color_ids IS NULL
            OR NOT EXISTS (
                SELECT 1
                FROM unnest(p_color_ids) AS needed_color(id)
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM inventory.reservable_color rc3
                    WHERE rc3.reservable_id = r.id
                      AND rc3.color_id = needed_color.id
                )
            )
        )

        AND (
            p_start_date IS NULL
            OR p_end_date IS NULL
            OR inventory.is_available(r.id, p_start_date, p_end_date)
        )

    GROUP BY r.id, r.name, r.description, r.price_per_day, r.photos,
             r.gender, r.privacy, r.inventory_type, r.category_id,
             c.name, r.subcategory_id, sc.name, r.status, r.quality,
             r.storage_location_id, sl.name, r.owner_id, o.name,
             r.manager_id, m.name, r.size

    ORDER BY r.name;
END;
$$;
