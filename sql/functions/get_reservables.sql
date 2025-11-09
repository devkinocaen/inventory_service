-- SQL: get_reservables
CREATE OR REPLACE FUNCTION inventory.get_reservables(
    p_type inventory.reservable_type DEFAULT NULL,
    p_category_id INT DEFAULT NULL,
    p_subcategory_id INT DEFAULT NULL,
    p_gender inventory.reservable_gender DEFAULT NULL,
    p_style_ids INT[] DEFAULT NULL
)
RETURNS TABLE (
    id INT,
    name VARCHAR,
    description TEXT,
    price_per_day NUMERIC(10,2),
    photos JSONB,
    gender inventory.reservable_gender,
    privacy inventory.privacy_type,
    inventory_type inventory.reservable_type,
    type_id INT,           -- alias to inventory_type as int (nullable)
    type_name TEXT,
    category_id INT,
    category_name VARCHAR,
    subcategory_id INT,
    subcategory_name VARCHAR,
    status inventory.reservable_status,
    status_id INT,
    status_name TEXT,
    storage_location_id INT,
    storage_location_name VARCHAR,
    owner_id INT,
    owner_name VARCHAR,
    manager_id INT,
    manager_name VARCHAR,
    size_id INT,
    size_label TEXT,
    style_ids INT[],
    style_names TEXT[]
)
LANGUAGE plpgsql STABLE
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
      NULL::INT AS type_id,
      (r.inventory_type)::TEXT AS type_name,
      r.category_id,
      c.name,
      r.subcategory_id,
      sc.name,
      r.status,
      NULL::INT AS status_id,
      (r.status)::TEXT AS status_name,
      r.storage_location_id,
      sl.name,
      r.owner_id,
      o.name,
      r.manager_id,
      m.name,
      r.size_id,
      s.label,
      -- styles aggregation
      array_remove(array_agg(DISTINCT rsl.style_id), NULL) AS style_ids,
      array_remove(array_agg(DISTINCT rs.name), NULL) AS style_names
    FROM inventory.reservable r
    LEFT JOIN inventory.reservable_category c ON c.id = r.category_id
    LEFT JOIN inventory.reservable_subcategory sc ON sc.id = r.subcategory_id
    LEFT JOIN inventory.storage_location sl ON sl.id = r.storage_location_id
    LEFT JOIN inventory.organization o ON o.id = r.owner_id
    LEFT JOIN inventory.organization m ON m.id = r.manager_id
    LEFT JOIN inventory.size s ON s.id = r.size_id
    LEFT JOIN inventory.reservable_style_link rsl ON rsl.reservable_id = r.id
    LEFT JOIN inventory.reservable_style rs ON rs.id = rsl.style_id
    WHERE
      (p_type IS NULL OR r.inventory_type = p_type)
      AND (p_category_id IS NULL OR r.category_id = p_category_id)
      AND (p_subcategory_id IS NULL OR r.subcategory_id = p_subcategory_id)
      AND (p_gender IS NULL OR r.gender = p_gender)
      -- si p_style_ids fourni : garder les objets contenant AU MOINS une des styles (OR logic)
      AND (
        p_style_ids IS NULL
        OR EXISTS (
          SELECT 1 FROM inventory.reservable_style_link rsl2
          WHERE rsl2.reservable_id = r.id
            AND rsl2.style_id = ANY(p_style_ids)
        )
      )
    GROUP BY r.id, c.name, sc.name, sl.name, o.name, m.name, s.label
    ORDER BY r.name;
END;
$$;
