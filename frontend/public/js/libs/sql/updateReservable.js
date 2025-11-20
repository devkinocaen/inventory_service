import { single } from '../helpers.js';

/**
 * Met à jour un reservable par id
 */
export async function updateReservable(client, {
  id,
  name = null,
  inventory_type = null,
  owner_id = null,
  manager_id = null,
  storage_location_id = null,
  category_id = null,
  subcategory_id = null,
  size = null,
  gender = null,
  privacy = null,
  price_per_day = null,
  description = null,
  photos = null,
  status = null,
  quality = null,
  is_in_stock = null,
  style_ids = null
}) {
  const { data, error } = await client.rpc('update_reservable', {
    p_id: id,
    p_name: name,
    p_inventory_type: inventory_type,
    p_owner_id: owner_id,
    p_manager_id: manager_id,
    p_storage_location_id: storage_location_id,
    p_category_id: category_id,
    p_subcategory_id: subcategory_id,
    p_size: size,
    p_gender: gender,
    p_privacy: privacy,
    p_price_per_day: price_per_day != null ? Number(price_per_day) : null,
    p_description: description,
    p_photos: photos,
    p_status: status,
    p_quality: quality,
    p_is_in_stock: is_in_stock,
    p_style_ids: style_ids  
  });

  if (error) {
    console.error('[updateReservable] Erreur serveur :', error);
    throw new Error(error.message || 'Erreur lors de la mise à jour du reservable');
  }

  console.log('updateReservable', data);

  // La fonction SQL RETURN VOID → data = null
  return data ?? null;
}
