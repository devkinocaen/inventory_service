CREATE OR REPLACE FUNCTION inventory.get_batch_statuses()
RETURNS TABLE (
    batch_id INT,
    status inventory.reservable_batch_status
)
LANGUAGE plpgsql STABLE
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH stats AS (
        SELECT
            bl.batch_id,
            COUNT(*) FILTER (WHERE r.status = 'disponible' AND r.is_in_stock) AS nb_in_stock,
            COUNT(*) FILTER (WHERE NOT (r.status = 'disponible' AND r.is_in_stock)) AS nb_out
        FROM inventory.reservable_batch_link AS bl
        JOIN inventory.reservable AS r ON r.id = bl.reservable_id
        GROUP BY bl.batch_id
    )
    SELECT
        stats.batch_id,
        CASE
            WHEN stats.nb_out = 0 THEN 'in_stock'::inventory.reservable_batch_status
            WHEN stats.nb_in_stock = 0 THEN 'out'::inventory.reservable_batch_status
            ELSE 'mixed'::inventory.reservable_batch_status
        END AS status
    FROM stats
    ORDER BY stats.batch_id;
END;
$$;
