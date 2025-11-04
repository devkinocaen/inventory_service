CREATE OR REPLACE FUNCTION public.get_reservable_by_id(
    p_id INT
) RETURNS TABLE(
    id INT,
    name TEXT,
    type_id INT,
    owner_id INT,
    manager_id INT,
    status_id INT,
    storage_location_id INT,
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
    WHERE id = p_id;
END;
$$ LANGUAGE plpgsql STABLE;