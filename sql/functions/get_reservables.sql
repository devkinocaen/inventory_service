CREATE OR REPLACE FUNCTION inventory.get_reservables(
    p_type inventory.reservable_type DEFAULT NULL,
    p_category_ids INT[] DEFAULT NULL,
    p_subcategory_ids INT[] DEFAULT NULL,
    p_gender inventory.reservable_gender[] DEFAULT NULL,
    p_style_ids INT[] DEFAULT NULL,
    p_start_date TIMESTAMP DEFAULT NULL,
    p_end_date TIMESTAMP DEFAULT NULL,
    p_is_in_stock BOOLEAN DEFAULT NULL
)
RETURNS TABLE (
    id INT,
    name TEXT,
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
    style_names TEXT[]
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.id,
        r.name::text,
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
        array_agg(DISTINCT rs.id) FILTER (WHERE rs.id IS NOT NULL) AS style_ids,
        array_agg(DISTINCT rs.name::text) FILTER (WHERE rs.name IS NOT NULL) AS style_names
    FROM inventory.reservable r
    LEFT JOIN inventory.reservable_category c ON c.id = r.category_id
    LEFT JOIN inventory.reservable_subcategory sc ON sc.id = r.subcategory_id
    LEFT JOIN inventory.storage_location sl ON sl.id = r.storage_location_id
    LEFT JOIN inventory.organization o ON o.id = r.owner_id
    LEFT JOIN inventory.organization m ON m.id = r.manager_id
    LEFT JOIN inventory.reservable_style_link rsl ON rsl.reservable_id = r.id
    LEFT JOIN inventory.reservable_style rs ON rs.id = rsl.style_id
    WHERE
        (p_type IS NULL OR r.inventory_type = p_type)
        AND (p_category_ids IS NULL OR r.category_id = ANY(p_category_ids))
        AND (p_subcategory_ids IS NULL OR r.subcategory_id = ANY(p_subcategory_ids))
        AND (p_gender IS NULL OR r.gender = ANY(p_gender))
        AND (
            p_is_in_stock IS NULL
            OR p_is_in_stock = r.is_in_stock
            )
        AND (
            p_style_ids IS NULL
            OR EXISTS (
                SELECT 1
                FROM inventory.reservable_style_link rsl2
                WHERE rsl2.reservable_id = r.id
                  AND rsl2.style_id = ANY(p_style_ids)
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
