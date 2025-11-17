CREATE OR REPLACE FUNCTION inventory.get_planning_matrix(
    p_start TIMESTAMP,
    p_end TIMESTAMP,
    p_granularity TEXT DEFAULT '1 day'
)
RETURNS TABLE (
    reservable_batch_id INT,
    batch_description TEXT,
    slots JSONB
)
LANGUAGE sql STABLE
AS $$
WITH batches AS (
    SELECT id, description
    FROM inventory.reservable_batch
),
batch_reservables AS (
    SELECT
        rbl.batch_id,
        jsonb_agg(
            jsonb_build_object(
                'id', r.id,
                'name', r.name,
                'gender', r.gender,
                'type', r.inventory_type
            ) ORDER BY r.id
        ) AS reservables
    FROM inventory.reservable_batch_link rbl
    JOIN inventory.reservable r ON r.id = rbl.reservable_id
    GROUP BY rbl.batch_id
),
slot_series AS (
    SELECT generate_series(p_start, p_end - (p_granularity::interval), p_granularity::interval) AS slot_start
),
batch_slots AS (
    SELECT
        b.id AS batch_id,
        jsonb_agg(
            jsonb_build_object(
                'start', s.slot_start,
                'end', s.slot_start + (p_granularity::interval),
                'reservables', br.reservables,
                'bookings', (
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            'id', bk.id,
                            'start_date', bk.start_date,
                            'end_date', bk.end_date,
                            'organization_id', bk.renter_organization_id,
                            'organization_name', org.name
                        )
                    )
                    FROM inventory.reservable_booking bk
                    LEFT JOIN inventory.organization org
                        ON org.id = bk.renter_organization_id
                    WHERE bk.reservable_batch_id = b.id
                      AND bk.start_date < (s.slot_start + (p_granularity::interval))
                      AND bk.end_date > s.slot_start
                )
            ) ORDER BY s.slot_start
        ) AS slots
    FROM batches b
    JOIN batch_reservables br ON br.batch_id = b.id
    CROSS JOIN slot_series s
    GROUP BY b.id
)
SELECT
    b.id AS reservable_batch_id,
    b.description AS batch_description,
    bs.slots
FROM batches b
JOIN batch_slots bs ON bs.batch_id = b.id
ORDER BY b.id;
$$;
