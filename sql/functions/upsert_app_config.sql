CREATE OR REPLACE FUNCTION inventory.upsert_app_config(
  p_current_session_id INTEGER,
  p_use_current_time BOOLEAN DEFAULT NULL,
  p_app_version TEXT DEFAULT NULL,
  p_admin_email TEXT DEFAULT NULL,
  p_viewer_allowed BOOLEAN DEFAULT NULL,
  p_default_manager_id INT DEFAULT NULL,
  p_default_owner_id INT DEFAULT NULL,
  p_default_storage_location_id INT DEFAULT NULL,
  p_show_prices BOOLEAN DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM inventory.app_config) THEN
    UPDATE inventory.app_config
    SET current_session_id          = p_current_session_id,
        use_current_time            = COALESCE(p_use_current_time, use_current_time),
        app_version                 = COALESCE(p_app_version, app_version),
        admin_email                 = COALESCE(p_admin_email, admin_email),
        viewer_allowed              = COALESCE(p_viewer_allowed, viewer_allowed),
        default_manager_id          = COALESCE(p_default_manager_id, default_manager_id),
        default_owner_id            = COALESCE(p_default_owner_id, default_owner_id),
        default_storage_location_id = COALESCE(p_default_storage_location_id, default_storage_location_id),
        show_prices                 = COALESCE(p_show_prices, show_prices),
        updated_at                  = NOW()
    WHERE TRUE;
  ELSE
    INSERT INTO inventory.app_config(
      current_session_id,
      use_current_time,
      app_version,
      admin_email,
      viewer_allowed,
      default_manager_id,
      default_owner_id,
      default_storage_location_id,
      show_prices,
      updated_at
    )
    VALUES (
      p_current_session_id,
      COALESCE(p_use_current_time, FALSE),
      p_app_version,
      p_admin_email,
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
