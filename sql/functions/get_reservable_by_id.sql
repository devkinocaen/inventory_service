CREATE OR REPLACE FUNCTION inventory.get_reservable_by_id(p_id INT)
RETURNS TABLE (
    id INT,
    name TEXT,
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
    style_ids INT[],
    style_names TEXT[]
)
LANGUAGE sql
AS $$
    SELECT
        r.id,
        r.name,
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
        ARRAY_AGG(rs.style_id) FILTER (WHERE rs.style_id IS NOT NULL) AS style_ids,
        ARRAY_AGG(st.name) FILTER (WHERE st.name IS NOT NULL) AS style_names
    FROM inventory.reservable r
    LEFT JOIN inventory.reservable_category c ON c.id = r.category_id
    LEFT JOIN inventory.reservable_subcategory s ON s.id = r.subcategory_id
    LEFT JOIN inventory.reservable_style_link rs ON rs.reservable_id = r.id
    LEFT JOIN inventory.reservable_style st ON st.id = rs.style_id
    WHERE r.id = p_id
    GROUP BY
        r.id, r.name, r.inventory_type, r.owner_id, r.manager_id,
        r.storage_location_id, r.category_id, c.name,
        r.subcategory_id, s.name, r.size, r.gender,
        r.privacy, r.price_per_day, r.description,
        r.photos, r.status, r.quality;
$$;
