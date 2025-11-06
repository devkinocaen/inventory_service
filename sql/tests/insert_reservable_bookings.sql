-- insert_reservable_bookings.sql
DO $$
DECLARE
  r RECORD;
  slot_start TIMESTAMP;
  slot_end TIMESTAMP;
  chosen_reservable_ids INT[];
  nb INT;
  br_id INT;
  renter_id INT;
BEGIN
  -- Pour chaque batch existant
  FOR r IN SELECT id AS batch_id FROM inventory.reservable_batch LOOP
    nb := 1 + floor(random()*3)::int;  -- 1 à 3 réservations par batch
    FOR i IN 1..nb LOOP

      -- Sélection aléatoire d'une booking_reference existante
      SELECT id INTO br_id
      FROM inventory.booking_reference
      ORDER BY random()
      LIMIT 1;

      -- Sélection aléatoire d'une organisation pour renter
      SELECT id INTO renter_id
      FROM inventory.organization
      ORDER BY random()
      LIMIT 1;

      -- Créneaux aléatoires dans les 30 prochains jours, 2 à 8h de durée
      slot_start := now()
                    + (floor(random()*30)::int) * interval '1 day'
                    + (floor(random()*8)::int) * interval '1 hour';
      slot_end := slot_start + (2 + floor(random()*6)) * interval '1 hour';

      -- Récupérer quelques reservables du batch
      SELECT array_agg(reservable_id) INTO chosen_reservable_ids
      FROM inventory.reservable_batch_link
      WHERE batch_id = r.batch_id
      ORDER BY random()
      LIMIT (1 + floor(random()*3))::int;

      -- Si pas de reservables, passer au batch suivant
      IF chosen_reservable_ids IS NULL THEN
        CONTINUE;
      END IF;

      -- Créer une réservation pour le batch
      INSERT INTO inventory.reservable_booking (
        reservable_batch_id, renter_organization_id, booking_reference_id, start_date, end_date
      ) VALUES (
        r.batch_id,
        renter_id,
        br_id,
        slot_start,
        slot_end
      )
      ON CONFLICT DO NOTHING;

    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
