CREATE OR REPLACE FUNCTION inventory.get_planning_matrix(
    p_start TIMESTAMP,
    p_end TIMESTAMP,
    p_granularity TEXT DEFAULT '1 day'
)
RETURNS TABLE (
    reservable_batch_id INT,
    batch_description TEXT,
    organization_id INT,
    organization_name TEXT,
    referent_first_name TEXT,
    referent_last_name TEXT,
    referent_mobile TEXT,
    reservables JSONB,
    slots JSONB
)
LANGUAGE sql STABLE
AS $$
WITH batches AS (
    SELECT b.id, b.description,
           org.id AS organization_id, org.name AS organization_name,
           p.first_name AS referent_first_name,
           p.last_name AS referent_last_name,
           p.phone AS referent_mobile
    FROM inventory.reservable_batch b
    JOIN inventory.reservable_booking bk ON bk.reservable_batch_id = b.id
    JOIN inventory.organization org ON org.id = bk.renter_organization_id
    LEFT JOIN inventory.person p ON p.id = org.referent_id
    WHERE bk.start_date < p_end AND bk.end_date > p_start
    GROUP BY b.id, org.id, org.name, p.first_name, p.last_name, p.phone
),
batch_reservables AS (
    SELECT rbl.batch_id,
           jsonb_agg(
               jsonb_build_object(
                   'id', r.id,
                   'name', r.name,
                   'inventory_type', r.inventory_type,
                   'status', r.status,
                   'quality', r.quality,
                   'is_in_stock', r.is_in_stock,
                   'owner_id', r.owner_id,
                   'manager_id', r.manager_id,
                   'storage_location_id', r.storage_location_id,
                   'category_id', r.category_id,
                   'subcategory_id', r.subcategory_id,
                   'size', r.size,
                   'gender', r.gender,
                   'privacy', r.privacy,
                   'price_per_day', r.price_per_day,
                   'description', r.description,
                   'photos', r.photos
               ) ORDER BY r.id
           ) AS reservables
    FROM inventory.reservable_batch_link rbl
    JOIN inventory.reservable r ON r.id = rbl.reservable_id
    GROUP BY rbl.batch_id
),
batch_slots AS (
    SELECT b.id AS batch_id,
           jsonb_agg(
               jsonb_build_object(
                   'start', GREATEST(bk.start_date, p_start),
                   'end', LEAST(bk.end_date, p_end)
               ) ORDER BY bk.start_date
           ) AS slots
    FROM batches b
    JOIN inventory.reservable_booking bk ON bk.reservable_batch_id = b.id
    GROUP BY b.id
)
SELECT b.id AS reservable_batch_id,
       b.description AS batch_description,
       b.organization_id,
       b.organization_name,
       b.referent_first_name,
       b.referent_last_name,
       b.referent_mobile,
       br.reservables,
       bs.slots
FROM batches b
JOIN batch_reservables br ON br.batch_id = b.id
JOIN batch_slots bs ON bs.batch_id = b.id
ORDER BY b.id;
$$;
