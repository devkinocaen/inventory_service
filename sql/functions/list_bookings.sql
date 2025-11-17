CREATE OR REPLACE FUNCTION inventory.list_bookings(
  p_start TIMESTAMP DEFAULT NULL,
  p_end   TIMESTAMP DEFAULT NULL,
  p_organization_id INT DEFAULT NULL,
  p_category_id INT DEFAULT NULL,
  p_subcategory_id INT DEFAULT NULL
)
RETURNS TABLE (
  booking_id INT,
  reservable_batch_id INT,
  batch_description TEXT,
  renter_organization_id INT,
  renter_name TEXT,
  booking_reference_id INT,
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  reservables JSONB
)
LANGUAGE sql STABLE
AS $$
  SELECT
    b.id,
    b.reservable_batch_id,
    rb.description,
    b.renter_organization_id,
    o.name AS renter_name,
    b.booking_reference_id,
    b.start_date,
    b.end_date,
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'name', r.name,
          'category_id', r.category_id,
          'category_name', c.name,
          'subcategory_id', r.subcategory_id,
          'subcategory_name', sc.name,
          'photos', r.photos
        ) ORDER BY r.name
      )
      FROM inventory.reservable r
      JOIN inventory.reservable_batch_link rbl ON rbl.reservable_id = r.id
      LEFT JOIN inventory.reservable_category c ON c.id = r.category_id
      LEFT JOIN inventory.reservable_subcategory sc ON sc.id = r.subcategory_id
      WHERE rbl.batch_id = b.reservable_batch_id
    ) AS reservables
  FROM inventory.reservable_booking b
  JOIN inventory.reservable_batch rb ON rb.id = b.reservable_batch_id
  LEFT JOIN inventory.organization o ON o.id = b.renter_organization_id
  WHERE (p_start IS NULL OR b.end_date > p_start)
    AND (p_end IS NULL OR b.start_date < p_end)
    AND (p_organization_id IS NULL OR b.renter_organization_id = p_organization_id)
    AND (
      p_category_id IS NULL OR EXISTS (
        SELECT 1 FROM inventory.reservable r
        JOIN inventory.reservable_batch_link rbl2 ON rbl2.reservable_id = r.id
        WHERE rbl2.batch_id = b.reservable_batch_id AND r.category_id = p_category_id
      )
    )
    AND (
      p_subcategory_id IS NULL OR EXISTS (
        SELECT 1 FROM inventory.reservable r
        JOIN inventory.reservable_batch_link rbl3 ON rbl3.reservable_id = r.id
        WHERE rbl3.batch_id = b.reservable_batch_id AND r.subcategory_id = p_subcategory_id
      )
    )
  ORDER BY b.start_date, b.id;
$$;
