// js/api/fetchAvailability.js
export async function fetchAvailability(client, params = {}) {
  const rpcParams = {
    p_start: params.p_start ?? null,
    p_end: params.p_end ?? null,
    p_granularity: params.p_granularity ?? '1 day'
  };

  const { data, error } = await client.rpc('get_availability', rpcParams);
  if (error) {
    console.error('[fetchAvailability] Erreur serveur :', error);
    return [];
  }

  return (data || []).map(r => ({
    reservable_batch_id: r.reservable_batch_id,
    start_slot: r.start_slot,
    end_slot: r.end_slot,
    is_reserved: !!r.is_reserved
  }));
}
