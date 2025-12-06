CREATE OR REPLACE FUNCTION inventory.get_reservable_by_id(p_id INT)
RETURNS TABLE (
    id INT,
    name TEXT,
    serial_id TEXT,
    inventory_type inventory.reservable_type,
    owner_id INT,
    manager_id INT,
    storage_location_id INT,
    category_id INT,
    category_name TEXT,
    subcategory_id INT,
    subcategory_name TEXT,
    size TEXT,
    gender inventory.reservable_gender,
    privacy inventory.privacy_type,
    price_per_day DOUBLE PRECISION,
    description TEXT,
    photos JSONB,
    status inventory.reservable_status,
    quality inventory.reservable_quality,
    is_in_stock BOOLEAN,
    style_ids INT[],
    style_names TEXT[],
    colors JSONB
)
LANGUAGE sql
AS $$
    SELECT
        r.id,
        r.name,
        r.serial_id,
        r.inventory_type,
        r.owner_id,
        r.manager_id,
        r.storage_location_id,
        r.category_id,
        c.name AS category_name,
        r.subcategory_id,
        s.name AS subcategory_name,
        r.size,
        r.gender,
        r.privacy,
        r.price_per_day,
        r.description,
        r.photos,
        r.status,
        r.quality,
        r.is_in_stock,
        ARRAY_AGG(rs.style_id) FILTER (WHERE rs.style_id IS NOT NULL) AS style_ids,
        ARRAY_AGG(st.name) FILTER (WHERE st.name IS NOT NULL) AS style_names,
        COALESCE(
            JSONB_AGG(
                DISTINCT JSONB_BUILD_OBJECT(
                    'id', c2.id,
                    'name', c2.name,
                    'hex_code', c2.hex_code
                )
            ) FILTER (WHERE c2.id IS NOT NULL),
            '[]'::jsonb
        ) AS colors
    FROM inventory.reservable r
    LEFT JOIN inventory.reservable_category c ON c.id = r.category_id
    LEFT JOIN inventory.reservable_subcategory s ON s.id = r.subcategory_id
    LEFT JOIN inventory.reservable_style_link rs ON rs.reservable_id = r.id
    LEFT JOIN inventory.reservable_style st ON st.id = rs.style_id
    LEFT JOIN inventory.reservable_color_link rc ON rc.reservable_id = r.id
    LEFT JOIN inventory.color c2 ON c2.id = rc.color_id
    WHERE r.id = p_id
    GROUP BY
        r.id, r.name, r.serial_id, r.inventory_type, r.owner_id, r.manager_id,
        r.storage_location_id, r.category_id, c.name,
        r.subcategory_id, s.name, r.size, r.gender,
        r.privacy, r.price_per_day, r.description,
        r.photos, r.status, r.quality, r.is_in_stock;
$$;
