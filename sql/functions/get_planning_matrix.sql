CREATE OR REPLACE FUNCTION inventory.get_planning_matrix(
  p_start TIMESTAMP,
  p_end   TIMESTAMP,
  p_granularity TEXT DEFAULT '1 day'
)
RETURNS TABLE (
  reservable_batch_id INT,
  batch_description TEXT,
  reservables JSONB,
  slots JSONB
)
LANGUAGE sql STABLE
AS $$
WITH batches AS (
  SELECT
    rb.id,
    rb.description
  FROM inventory.reservable_batch rb
),
batch_reservables AS (
  SELECT
    rbl.reservable_batch_id AS batch_id,
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'name', r.name,
        'gender', r.gender,
        'type', r.type
      ) ORDER BY r.id
    ) AS reservables_json
  FROM inventory.reservable_batch_link rbl
  JOIN inventory.reservable r ON r.id = rbl.reservable_id
  GROUP BY rbl.reservable_batch_id
),
slots AS (
  SELECT
    b.id AS batch_id,
    jsonb_agg(
      jsonb_build_object(
        'start', s.slot_start,
        'end', s.slot_start + (p_granularity::interval),
        'is_reserved', EXISTS (
           SELECT 1
           FROM inventory.reservable_booking bk
           WHERE bk.reservable_batch_id = b.id
             AND bk.start_date < (s.slot_start + (p_granularity::interval))
             AND bk.end_date > s.slot_start
        ),
        'booking', (
           SELECT jsonb_build_object(
             'id', bk2.id,
             'start_date', bk2.start_date,
             'end_date', bk2.end_date,
             'organization_id', bk2.renter_organization_id,
             'organization_name', org.name
           )
           FROM inventory.reservable_booking bk2
           LEFT JOIN inventory.organization org
             ON org.id = bk2.renter_organization_id
           WHERE bk2.reservable_batch_id = b.id
             AND bk2.start_date < (s.slot_start + (p_granularity::interval))
             AND bk2.end_date > s.slot_start
           LIMIT 1
        )
      )
      ORDER BY s.slot_start
    ) AS slots_json
  FROM batches b
  JOIN (
    SELECT generate_series(
      p_start,
      p_end - (p_granularity::interval),
      (p_granularity::interval)
    ) AS slot_start
  ) s ON TRUE
  GROUP BY b.id
)

SELECT
  b.id AS reservable_batch_id,
  b.description AS batch_description,
  br.reservables_json AS reservables,
  sl.slots_json AS slots
FROM batches b
LEFT JOIN batch_reservables br ON br.batch_id = b.id
LEFT JOIN slots sl ON sl.batch_id = b.id
ORDER BY b.id;
$$;
