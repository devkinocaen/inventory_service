CREATE OR REPLACE FUNCTION inventory.upsert_app_config(
    p_app_name TEXT DEFAULT NULL,
    p_schema_version TEXT DEFAULT NULL,
    p_viewer_allowed BOOLEAN DEFAULT NULL,
    p_default_manager_id INT DEFAULT NULL,
    p_default_owner_id INT DEFAULT NULL,
    p_default_storage_location_id INT DEFAULT NULL,
    p_show_prices BOOLEAN DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM inventory.app_config) THEN
        UPDATE inventory.app_config
        SET app_name                 = COALESCE(p_app_name, app_name),
            schema_version           = COALESCE(p_schema_version, schema_version),
            viewer_allowed           = COALESCE(p_viewer_allowed, viewer_allowed),
            default_manager_id       = COALESCE(p_default_manager_id, default_manager_id),
            default_owner_id         = COALESCE(p_default_owner_id, default_owner_id),
            default_storage_location_id = COALESCE(p_default_storage_location_id, default_storage_location_id),
            show_prices              = COALESCE(p_show_prices, show_prices),
            updated_at               = NOW()
        WHERE TRUE;
    ELSE
        INSERT INTO inventory.app_config(
            app_name,
            schema_version,
            viewer_allowed,
            default_manager_id,
            default_owner_id,
            default_storage_location_id,
            show_prices,
            updated_at
        )
        VALUES (
            p_app_name,
            p_schema_version,
            COALESCE(p_viewer_allowed, FALSE),
            p_default_manager_id,
            p_default_owner_id,
            p_default_storage_location_id,
            COALESCE(p_show_prices, TRUE),
            NOW()
        );
    END IF;
END;
$$ LANGUAGE plpgsql;
