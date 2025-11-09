// js/api/fetchPlanningMatrix.js
export async function fetchPlanningMatrix(client, params = {}) {
  const rpcParams = {
    p_start: params.p_start ?? null,
    p_end: params.p_end ?? null,
    p_granularity: params.p_granularity ?? '1 day'
  };

  const { data, error } = await client.rpc('get_planning_matrix', rpcParams);
  if (error) {
    console.error('[fetchPlanningMatrix] Erreur serveur :', error);
    return [];
  }

  return (data || []).map(r => ({
    reservable_batch_id: r.reservable_batch_id,
    batch_description: r.batch_description,
    slots: r.slots || []
  }));
}
