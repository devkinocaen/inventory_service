// js/api/fetchReservables.js
export async function fetchReservables(client, filters = {}) {
  // Prépare les params en respectant le nouveau RPC
  const params = {
    p_type: filters.p_type ?? null,
    p_category_ids: Array.isArray(filters.p_category_ids) && filters.p_category_ids.length
      ? filters.p_category_ids
      : null,
    p_subcategory_ids: Array.isArray(filters.p_subcategory_ids) && filters.p_subcategory_ids.length
      ? filters.p_subcategory_ids
      : null,
    p_gender: Array.isArray(filters.p_gender) && filters.p_gender.length
      ? filters.p_gender
      : null, // <- maintenant vecteur
    p_style_ids: Array.isArray(filters.p_style_ids) && filters.p_style_ids.length
      ? filters.p_style_ids
      : null,
    p_start_date: filters.p_start_date ?? null,
    p_end_date: filters.p_end_date ?? null,
    p_is_in_stock: filters.p_is_in_stock ?? null

  };

  console.log('fetchReservables params', params);

  const { data, error } = await client.rpc('get_reservables', params);

  if (error) {
    console.error('[fetchReservables] Erreur serveur :', error);
    return [];
  }

  return (data || []).map(item => ({
    id: item.id,
    name: item.name,
    description: item.description,
    price_per_day: item.price_per_day,
    photos: item.photos,
    gender: item.gender,
    privacy: item.privacy,
    inventory_type: item.inventory_type,
    type_id: item.type_id,
    type_name: item.type_name,
    category_id: item.category_id,
    category_name: item.category_name,
    subcategory_id: item.subcategory_id,
    subcategory_name: item.subcategory_name,
    status: item.status,
    size: item.size,
    quality: item.quality,
    p_is_in_stock: item.is_in_stock,
    storage_location_id: item.storage_location_id,
    storage_location_name: item.storage_location_name,
    owner_id: item.owner_id,
    owner_name: item.owner_name,
    manager_id: item.manager_id,
    manager_name: item.manager_name,
    size_id: item.size_id,
    size_label: item.size_label,
    style_ids: item.style_ids || [],
    style_names: item.style_names || []
  }));
}
