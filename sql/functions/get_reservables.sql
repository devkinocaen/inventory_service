CREATE OR REPLACE FUNCTION inventory.get_reservables(
    p_type inventory.reservable_type DEFAULT NULL,
    p_category_id INT DEFAULT NULL,
    p_subcategory_id INT DEFAULT NULL,
    p_gender inventory.reservable_gender DEFAULT NULL
)
RETURNS TABLE (
    id INT,
    name VARCHAR(150),
    description TEXT,
    price_per_day NUMERIC(10,2),
    photos JSONB,
    gender inventory.reservable_gender,
    privacy inventory.privacy_type,
    inventory_type inventory.reservable_type,
    category_id INT,
    category_name VARCHAR(100),
    subcategory_id INT,
    subcategory_name VARCHAR(100),
    status inventory.reservable_status,
    storage_location_id INT,
    storage_location_name VARCHAR(150),
    owner_id INT,
    owner_name VARCHAR(150),
    manager_id INT,
    manager_name VARCHAR(150)
)
AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.id,
        r.name,
        r.description,
        r.price_per_day,
        r.photos,
        r.gender,
        r.privacy,
        r.inventory_type,
        r.category_id,
        c.name AS category_name,
        r.subcategory_id,
        sc.name AS subcategory_name,
        r.status,
        r.storage_location_id,
        sl.name AS storage_location_name,
        r.owner_id,
        o.name AS owner_name,
        r.manager_id,
        m.name AS manager_name
    FROM inventory.reservable r
    LEFT JOIN inventory.reservable_category c ON c.id = r.category_id
    LEFT JOIN inventory.reservable_subcategory sc ON sc.id = r.subcategory_id
    LEFT JOIN inventory.storage_location sl ON sl.id = r.storage_location_id
    LEFT JOIN inventory.organization o ON o.id = r.owner_id
    LEFT JOIN inventory.organization m ON m.id = r.manager_id
    WHERE
        (p_type IS NULL OR r.inventory_type = p_type)
        AND (p_category_id IS NULL OR r.category_id = p_category_id)
        AND (p_subcategory_id IS NULL OR r.subcategory_id = p_subcategory_id)
        AND (p_gender IS NULL OR r.gender = p_gender)
    ORDER BY r.name;
END;
$$ LANGUAGE plpgsql STABLE;
