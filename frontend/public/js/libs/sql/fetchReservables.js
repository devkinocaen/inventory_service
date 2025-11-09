// js/api/fetchReservables.js
export async function fetchReservables(client, filters = {}) {
  const params = {
    p_type: filters.p_type ?? null,
    p_category_id: filters.p_category_id ?? null,
    p_subcategory_id: filters.p_subcategory_id ?? null,
    p_gender: filters.p_gender ?? null,
    p_style_ids: filters.p_style_ids ?? null
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
    status_id: item.status_id,
    status_name: item.status_name,
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
