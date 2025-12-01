DO $$
DECLARE
  v_total_batches INT := 20; -- <<== choisis ici combien de batches tu veux
  v_batch_index INT;
  v_batch_id INT;
  v_owner INT;
  v_manager INT;
  v_status inventory.reservable_status;
  chosen_ids INT[];
  r INT;
BEGIN
  -- fallback owner/manager/status
  SELECT id INTO v_owner FROM inventory.organization ORDER BY id LIMIT 1;
  v_manager := v_owner;
  v_status := 'disponible'::inventory.reservable_status;

  FOR v_batch_index IN 1..v_total_batches LOOP
    
    -- créer le batch (batch1, batch2, … batchN)
    INSERT INTO inventory.reservable_batch (description)
    VALUES (format('batch%s', v_batch_index))
    RETURNING id INTO v_batch_id;

    -- choisir 1 à 10 reservables costumé/equipment aléatoires
    SELECT array_agg(id) INTO chosen_ids
    FROM (
      SELECT id
      FROM inventory.reservable
      WHERE inventory_type IN ('costume'::inventory.reservable_type,
                               'equipment'::inventory.reservable_type)
      ORDER BY random()
      LIMIT (1 + floor(random()*10))::int   -- 1 à 10
    ) s;

    -- lier les reservables
    IF chosen_ids IS NOT NULL THEN
      FOREACH r IN ARRAY chosen_ids LOOP
        INSERT INTO inventory.reservable_batch_link (batch_id, reservable_id)
        VALUES (v_batch_id, r)
        ON CONFLICT DO NOTHING;

        -- forcer status et stock
        UPDATE inventory.reservable
        SET status = v_status,
            is_in_stock = TRUE
        WHERE id = r;
      END LOOP;
    END IF;

  END LOOP;

  -- ajuster la séquence des batchs
  PERFORM setval(
    pg_get_serial_sequence('inventory.reservable_batch', 'id'),
    (SELECT COALESCE(MAX(id),0) FROM inventory.reservable_batch),
    true
  );

END;
$$ LANGUAGE plpgsql;
