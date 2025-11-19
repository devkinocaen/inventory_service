-- ===========================================
-- Récupère un batch par ID avec ses reservables (infos essentielles)
-- ===========================================
CREATE OR REPLACE FUNCTION inventory.get_batch_by_id(p_batch_id INT)
RETURNS TABLE(
    batch_id INT,
    batch_description TEXT,
    reservable_id INT,
    reservable_name TEXT,
    reservable_status inventory.reservable_status,
    reservable_in_stock BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        b.id AS batch_id,
        b.description AS batch_description,
        r.id::INT AS reservable_id,
        r.name::TEXT AS reservable_name,
        r.status::inventory.reservable_status AS reservable_status,
        r.is_in_stock::BOOLEAN AS reservable_in_stock
    FROM inventory.reservable_batch b
    LEFT JOIN inventory.reservable_batch_link bl ON bl.batch_id = b.id
    LEFT JOIN inventory.reservable r ON r.id = bl.reservable_id
    WHERE b.id = p_batch_id;
END;
$$ LANGUAGE plpgsql STABLE;
