CREATE OR REPLACE FUNCTION public.update_reservable(
    p_id INT,
    p_name TEXT DEFAULT NULL,
    p_type_id INT DEFAULT NULL,
    p_owner_id INT DEFAULT NULL,
    p_manager_id INT DEFAULT NULL,
    p_status_id INT DEFAULT NULL,
    p_storage_location_id INT DEFAULT NULL,
    p_category_id INT DEFAULT NULL,
    p_subcategory_id INT DEFAULT NULL,
    p_gender reservable_gender DEFAULT NULL,
    p_privacy privacy_type DEFAULT NULL,
    p_price_per_day NUMERIC DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_photos JSONB DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    UPDATE reservable
    SET
        name = COALESCE(p_name, name),
        type_id = COALESCE(p_type_id, type_id),
        owner_id = COALESCE(p_owner_id, owner_id),
        manager_id = COALESCE(p_manager_id, manager_id),
        status_id = COALESCE(p_status_id, status_id),
        storage_location_id = COALESCE(p_storage_location_id, storage_location_id),
        category_id = COALESCE(p_category_id, category_id),
        subcategory_id = COALESCE(p_subcategory_id, subcategory_id),
        gender = COALESCE(p_gender, gender),
        privacy = COALESCE(p_privacy, privacy),
        price_per_day = COALESCE(p_price_per_day, price_per_day),
        description = COALESCE(p_description, description),
        photos = COALESCE(p_photos, photos)
    WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;