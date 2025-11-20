CREATE OR REPLACE FUNCTION inventory.get_app_config()
RETURNS TABLE (
    app_name TEXT,
    schema_version TEXT,
    viewer_allowed BOOLEAN,
    show_prices BOOLEAN,
    default_manager_id INT,
    default_owner_id INT,
    default_storage_location_id INT,
    updated_at TIMESTAMP
)
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ac.app_name,
        ac.schema_version,
        ac.viewer_allowed,
        ac.show_prices,
        ac.default_manager_id,
        ac.default_owner_id,
        ac.default_storage_location_id,
        ac.updated_at
    FROM inventory.app_config ac
    LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;
