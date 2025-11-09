-- list_batches.sql
-- Liste tous les lots (panier) et leur contenu en JSONB (utile pour le planning / modals).
CREATE OR REPLACE FUNCTION inventory.list_batches()
RETURNS TABLE (
  batch_id INT,
  description TEXT,
  reservables JSONB
)
LANGUAGE sql STABLE
AS $$
  SELECT
    rb.id,
    rb.description,
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
      WHERE rbl.batch_id = rb.id
    ) AS reservables
  FROM inventory.reservable_batch rb
  ORDER BY rb.id;
$$;
