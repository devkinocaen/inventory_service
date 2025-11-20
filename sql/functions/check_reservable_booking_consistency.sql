CREATE OR REPLACE FUNCTION inventory.check_reservable_booking_consistency()
RETURNS TABLE(
    reservable_id INT,
    reservable_name TEXT,
    booking_id INT,
    issue TEXT
) AS $$
BEGIN
    -- 🔹 1️⃣ Vérifie que les objets réservés sont 'disponible'
    RETURN QUERY
    SELECT r.id::INT,
           r.name::TEXT,
           rb.id::INT,
           ('Reservable booked while not available (' || r.status || ')')::TEXT
    FROM inventory.reservable_booking rb
    JOIN inventory.reservable_batch_link rbl ON rbl.batch_id = rb.reservable_batch_id
    JOIN inventory.reservable r ON r.id = rbl.reservable_id
    WHERE r.status <> 'disponible';

    -- 🔹 2️⃣ Vérifie qu'aucun objet n'est booké 2 fois sur des créneaux qui se chevauchent
    RETURN QUERY
    SELECT r1.id::INT,
           r1.name::TEXT,
           rb1.id::INT,
           'Reservable double-booked on overlapping periods'::TEXT
    FROM inventory.reservable_booking rb1
    JOIN inventory.reservable_batch_link rbl1 ON rbl1.batch_id = rb1.reservable_batch_id
    JOIN inventory.reservable r1 ON r1.id = rbl1.reservable_id
    JOIN inventory.reservable_booking rb2
      ON rb1.id < rb2.id  -- évite doublons
    JOIN inventory.reservable_batch_link rbl2
      ON rbl2.batch_id = rb2.reservable_batch_id
    JOIN inventory.reservable r2
      ON r2.id = rbl2.reservable_id
    WHERE r1.id = r2.id
      AND rb1.period && rb2.period;
END;
$$ LANGUAGE plpgsql;
