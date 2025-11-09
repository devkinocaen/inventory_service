-- get_availability.sql
-- Retourne un enregistrement par (batch x slot) entre p_start et p_end,
-- avec is_reserved = true si le slot est chevauché par une réservation.
CREATE OR REPLACE FUNCTION inventory.get_availability(
  p_start TIMESTAMP,
  p_end TIMESTAMP,
  p_granularity INTERVAL DEFAULT INTERVAL '1 day'
)
RETURNS TABLE (
  reservable_batch_id INT,
  start_slot TIMESTAMP,
  end_slot TIMESTAMP,
  is_reserved BOOLEAN
)
LANGUAGE sql STABLE
AS $$
  WITH slots AS (
    SELECT generate_series(p_start, p_end - p_granularity, p_granularity) AS slot_start
  )
  SELECT
    rb.id AS reservable_batch_id,
    s.slot_start AS start_slot,
    (s.slot_start + p_granularity) AS end_slot,
    EXISTS (
      SELECT 1 FROM inventory.reservable_booking b
      WHERE b.reservable_batch_id = rb.id
        AND b.start_date < (s.slot_start + p_granularity)
        AND b.end_date > s.slot_start
    ) AS is_reserved
  FROM inventory.reservable_batch rb
  CROSS JOIN slots s
  ORDER BY rb.id, s.slot_start;
$$;
