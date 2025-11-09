// js/api/fetchReservableStatuses.js
export async function fetchReservableStatuses(client) {
  const { data, error } = await client.rpc('get_reservable_statuses', {});
  if (error) {
    console.error('[fetchReservableStatuses] Erreur serveur :', error);
    return [];
  }
  return (data || []).map(r => r.status);
}
