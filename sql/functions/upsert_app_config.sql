CREATE OR REPLACE FUNCTION public.upsert_app_config(
  p_current_session_id INTEGER,
  p_use_current_time BOOLEAN DEFAULT NULL,
  p_app_version TEXT DEFAULT NULL,
  p_admin_email TEXT DEFAULT NULL,
  p_viewer_allowed BOOLEAN DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM app_config) THEN
    UPDATE app_config
    SET current_session_id = p_current_session_id,
        use_current_time = COALESCE(p_use_current_time, use_current_time),
        app_version = COALESCE(p_app_version, app_version),
        admin_email = COALESCE(p_admin_email, admin_email),
        viewer_allowed = COALESCE(p_viewer_allowed, viewer_allowed),
        updated_at = NOW()
    WHERE TRUE;
  ELSE
    INSERT INTO app_config(
      current_session_id,
      use_current_time,
      app_version,
      admin_email,
      viewer_allowed,
      updated_at
    )
    VALUES (
      p_current_session_id,
      COALESCE(p_use_current_time, FALSE),
      p_app_version,
      p_admin_email,
      COALESCE(p_viewer_allowed, FALSE),
      NOW()
    );
  END IF;
END;
$$ LANGUAGE plpgsql;
