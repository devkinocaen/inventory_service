CREATE OR REPLACE FUNCTION inventory.get_app_config()
RETURNS TABLE (
    current_session_id INTEGER,
    use_current_time BOOLEAN,
    app_version TEXT,
    admin_email TEXT,
    schema_version TEXT,
    viewer_allowed BOOLEAN,
    show_prices BOOLEAN,
    default_manager_id INT,
    default_owner_id INT,
    default_storage_location_id INT,
    updated_at TIMESTAMP,
    last_data_import TIMESTAMP,
    last_data_export TIMESTAMP
)
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ac.current_session_id,
        ac.use_current_time,
        ac.app_version,
        ac.admin_email,
        ac.schema_version,
        ac.viewer_allowed,
        ac.show_prices,
        ac.default_manager_id,
        ac.default_owner_id,
        ac.default_storage_location_id,
        ac.updated_at,
        ac.last_data_import,
        ac.last_data_export
    FROM inventory.app_config ac
    LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;
