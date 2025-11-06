// js/api/fetchReservables.js
export async function fetchReservables(client, filters = {}) {
  const params = {
    p_type: filters.p_type ?? null,
    p_category_id: filters.p_category_id ?? null,
    p_subcategory_id: filters.p_subcategory_id ?? null,
    p_gender: filters.p_gender ?? null,
  };
    console.log ('params', params)

  const { data, error } = await client.rpc('get_reservables', params);

  if (error) {
    console.error('[fetchReservables] Erreur serveur :', error);
    return [];
  }

  return data?.map(item => ({
    id: item.id,
    name: item.name,
    type_id: item.type_id,
    type_name: item.type_name,
    category_id: item.category_id,
    category_name: item.category_name,
    subcategory_id: item.subcategory_id,
    subcategory_name: item.subcategory_name,
    gender: item.gender,
    privacy: item.privacy,
    status_id: item.status_id,
    status_name: item.status_name,
    owner_id: item.owner_id,
    owner_name: item.owner_name,
    manager_id: item.manager_id,
    manager_name: item.manager_name,
    storage_location_id: item.storage_location_id,
    storage_location_name: item.storage_location_name,
    size_id: item.size_id,
    size_label: item.size_label,
    price_per_day: item.price_per_day,
    description: item.description,
    photos: item.photos
  })) || [];
}
