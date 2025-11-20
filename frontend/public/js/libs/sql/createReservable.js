import { single } from '../helpers.js';

/**
 * Crée un reservable
 */
export async function createReservable(client, {
  name,
  inventory_type,
  owner_id,
  manager_id,
  storage_location_id = null,
  category_id = null,
  subcategory_id = null,
  size = '',
  gender = 'unisex',
  privacy = 'private',
  price_per_day = 0,
  description = '',
  photos = '[]',
  status = 'disponible',
  quality = 'bon état',
  is_in_stock = true
}) {
  const { data, error } = await client.rpc('create_reservable', {
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
    p_price_per_day: price_per_day,
    p_description: description,
    p_photos: photos,
    p_status: status,
    p_quality: quality,
    p_is_in_stock: is_in_stock
  });

  if (error) {
    console.error('[createReservable] Erreur serveur :', error);
    throw new Error(error.message || 'Erreur lors de la création du reservable');
  }
console.log ('data in creatreservable', data);
    
  return single(data).create_reservable;
}
