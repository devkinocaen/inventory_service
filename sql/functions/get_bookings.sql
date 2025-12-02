CREATE OR REPLACE FUNCTION inventory.get_bookings(
  p_start TIMESTAMP DEFAULT NULL,
  p_end   TIMESTAMP DEFAULT NULL,
  p_organization_ids INT[] DEFAULT NULL,
  p_category_ids INT[] DEFAULT NULL,
  p_subcategory_ids INT[] DEFAULT NULL
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
  booked_at TIMESTAMP,
  booking_person_id INT,
  booking_person_name TEXT,
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
    b.booked_at,
    b.booking_person_id,
    CONCAT_WS(' ', p.first_name, p.last_name) AS booking_person_name,
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
  LEFT JOIN inventory.person p ON p.id = b.booking_person_id
  WHERE (p_start IS NULL OR b.end_date > p_start)
    AND (p_end IS NULL OR b.start_date < p_end)
    AND (p_organization_ids IS NULL OR b.renter_organization_id = ANY(p_organization_ids))
    AND (
      p_category_ids IS NULL OR EXISTS (
        SELECT 1 FROM inventory.reservable r
        JOIN inventory.reservable_batch_link rbl2 ON rbl2.reservable_id = r.id
        WHERE rbl2.batch_id = b.reservable_batch_id
          AND r.category_id = ANY(p_category_ids)
      )
    )
    AND (
      p_subcategory_ids IS NULL OR EXISTS (
        SELECT 1 FROM inventory.reservable r
        JOIN inventory.reservable_batch_link rbl3 ON rbl3.reservable_id = r.id
        WHERE rbl3.batch_id = b.reservable_batch_id
          AND r.subcategory_id = ANY(p_subcategory_ids)
      )
    )
  ORDER BY b.start_date, b.id;
$$;
