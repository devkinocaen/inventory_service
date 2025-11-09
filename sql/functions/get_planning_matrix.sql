-- get_planning_matrix.sql
-- Retourne, pour chaque lot, un JSONB "slots" prêt à consommer côté frontend.
-- slots = array d'objets { start, end, is_reserved, renter_name (nullable), booking_id (nullable) }
CREATE OR REPLACE FUNCTION inventory.get_planning_matrix(
  p_start TIMESTAMP,
  p_end TIMESTAMP,
  p_granularity INTERVAL DEFAULT INTERVAL '1 day'
)
RETURNS TABLE (
  reservable_batch_id INT,
  batch_description TEXT,
  slots JSONB
)
LANGUAGE sql STABLE
AS $$
  SELECT
    rb.id AS reservable_batch_id,
    rb.description AS batch_description,
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'start', s.slot_start,
          'end', (s.slot_start + p_granularity),
          'is_reserved', EXISTS (
             SELECT 1 FROM inventory.reservable_booking b
             WHERE b.reservable_batch_id = rb.id
               AND b.start_date < (s.slot_start + p_granularity)
               AND b.end_date > s.slot_start
           ),
          'booking_id', (
             SELECT b2.id FROM inventory.reservable_booking b2
             WHERE b2.reservable_batch_id = rb.id
               AND b2.start_date < (s.slot_start + p_granularity)
               AND b2.end_date > s.slot_start
             LIMIT 1
          ),
          'renter_name', (
             SELECT o.name FROM inventory.organization o
             JOIN inventory.reservable_booking b3 ON b3.renter_organization_id = o.id
             WHERE b3.reservable_batch_id = rb.id
               AND b3.start_date < (s.slot_start + p_granularity)
               AND b3.end_date > s.slot_start
             LIMIT 1
          )
        )
        ORDER BY s.slot_start
      )
      FROM (
        SELECT generate_series(p_start, p_end - p_granularity, p_granularity) AS slot_start
      ) s
    ) AS slots
  FROM inventory.reservable_batch rb
  ORDER BY rb.id;
$$;
