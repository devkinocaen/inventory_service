CREATE OR REPLACE FUNCTION public.get_reservables(
    p_owner_id INT DEFAULT NULL,
    p_category_id INT DEFAULT NULL,
    p_subcategory_id INT DEFAULT NULL,
    p_status_id INT DEFAULT NULL,
    p_gender reservable_gender DEFAULT NULL,
    p_type_id INT DEFAULT NULL,
    p_privacy privacy_type DEFAULT NULL
) RETURNS TABLE(
    id INT,
    name TEXT,
    type_id INT,
    owner_id INT,
    manager_id INT,
    status_id INT,
    category_id INT,
    subcategory_id INT,
    gender reservable_gender,
    privacy privacy_type,
    price_per_day NUMERIC,
    description TEXT,
    photos JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM reservable
    WHERE (p_owner_id IS NULL OR owner_id = p_owner_id)
      AND (p_category_id IS NULL OR category_id = p_category_id)
      AND (p_subcategory_id IS NULL OR subcategory_id = p_subcategory_id)
      AND (p_status_id IS NULL OR status_id = p_status_id)
      AND (p_gender IS NULL OR gender = p_gender)
      AND (p_type_id IS NULL OR type_id = p_type_id)
      AND (p_privacy IS NULL OR privacy = p_privacy);
END;
$$ LANGUAGE plpgsql STABLE;