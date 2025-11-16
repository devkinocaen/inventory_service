CREATE OR REPLACE FUNCTION inventory.create_reservable(
    p_name TEXT,
    p_inventory_type inventory.reservable_type,
    p_owner_id INT,
    p_manager_id INT,
    p_storage_location_id INT DEFAULT NULL,
    p_category_id INT DEFAULT NULL,
    p_subcategory_id INT DEFAULT NULL,
    p_size TEXT DEFAULT '',
    p_gender inventory.reservable_gender DEFAULT 'unisex',
    p_privacy inventory.privacy_type DEFAULT 'private',
    p_price_per_day double precision DEFAULT 0,
    p_description TEXT DEFAULT '',
    p_photos JSONB DEFAULT '[]'::jsonb,
    p_rstatus inventory.reservable_status DEFAULT 'disponible',
    p_qstatus inventory.reservable_quality DEFAULT 'bon état'
)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
    v_id INT;
BEGIN
    INSERT INTO inventory.reservable (
        name,
        inventory_type,
        owner_id,
        manager_id,
        storage_location_id,
        category_id,
        subcategory_id,
        size,
        gender,
        privacy,
        price_per_day,
        description,
        photos,
        rstatus,
        qstatus
    ) VALUES (
        p_name,
        p_inventory_type,
        p_owner_id,
        p_manager_id,
        p_storage_location_id,
        p_category_id,
        p_subcategory_id,
        p_size,
        p_gender,
        p_privacy,
        p_price_per_day,
        p_description,
        p_photos,
        p_rstatus,
        p_qstatus
    )
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;
