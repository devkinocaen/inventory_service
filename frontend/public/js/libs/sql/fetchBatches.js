// js/api/fetchBatches.js
export async function fetchBatches(client) {
  const { data, error } = await client.rpc('get_batches', {});
  if (error) {
    console.error('[fetchBatches] Erreur serveur :', error);
    return [];
  }
  return (data || []).map(r => ({
    batch_id: r.batch_id,
    description: r.description,
    reservables: r.reservables || []
  }));
}
