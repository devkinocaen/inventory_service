import { single } from '../helpers.js';

/**
 * Crée un reservable
 */
export async function createReservable(client, {
  name,
  serial_id = null,
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
  is_in_stock = true,
  color_ids = null
}) {

  const { data, error } = await client.rpc('create_reservable', {
    p_name: name,
    p_serial_id: serial_id,
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
    p_is_in_stock: is_in_stock,
    p_color_ids: color_ids
  });

  if (error) {
    console.error('[createReservable] Erreur serveur :', error);
    throw new Error(error.message || 'Erreur lors de la création du réservable');
  }

  console.log('data in createReservable', data);

  return single(data).create_reservable;
}
