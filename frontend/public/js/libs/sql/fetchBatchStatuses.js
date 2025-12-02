// js/api/fetchBatchStatuses.js
export async function fetchBatchStatuses(client) {
  const { data, error } = await client.rpc('get_batch_statuses', {});
  if (error) {
    console.error('[fetchBatchStatuses] Erreur serveur :', error);
    return [];
  }

  return (data || []).map(r => ({
    batch_id: r.batch_id,
    status: r.status   // 'in_stock' | 'out' | 'mixed'
  }));
}
