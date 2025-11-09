// js/api/fetchReservableTypes.js
export async function fetchReservableTypes(client) {
  const { data, error } = await client.rpc('get_reservable_types', {});
  if (error) {
    console.error('[fetchReservableTypes] Erreur serveur :', error);
    return [];
  }
  return (data || []).map(r => r.inventory_type);
}
