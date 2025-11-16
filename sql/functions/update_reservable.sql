CREATE OR REPLACE FUNCTION inventory.update_reservable(
    p_id INT,
    p_name TEXT DEFAULT NULL,
    p_inventory_type inventory.reservable_type DEFAULT NULL,
    p_owner_id INT DEFAULT NULL,
    p_manager_id INT DEFAULT NULL,
    p_storage_location_id INT DEFAULT NULL,
    p_category_id INT DEFAULT NULL,
    p_subcategory_id INT DEFAULT NULL,
    p_size TEXT DEFAULT NULL,
    p_gender inventory.reservable_gender DEFAULT NULL,
    p_privacy inventory.privacy_type DEFAULT NULL,
    p_price_per_day NUMERIC(10,2) DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_photos JSONB DEFAULT NULL,
    p_rstatus inventory.reservable_status DEFAULT NULL,
    p_qstatus inventory.reservable_quality DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE inventory.reservable
    SET
        name = COALESCE(p_name, name),
        inventory_type = COALESCE(p_inventory_type, inventory_type),
        owner_id = COALESCE(p_owner_id, owner_id),
        manager_id = COALESCE(p_manager_id, manager_id),
        storage_location_id = COALESCE(p_storage_location_id, storage_location_id),
        category_id = COALESCE(p_category_id, category_id),
        subcategory_id = COALESCE(p_subcategory_id, subcategory_id),
        size = COALESCE(p_size, size),
        gender = COALESCE(p_gender, gender),
        privacy = COALESCE(p_privacy, privacy),
        price_per_day = COALESCE(p_price_per_day, price_per_day),
        description = COALESCE(p_description, description),
        photos = COALESCE(p_photos, photos),
        rstatus = COALESCE(p_rstatus, rstatus),
        qstatus = COALESCE(p_qstatus, qstatus)
    WHERE id = p_id;
END;
$$;
