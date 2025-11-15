// js/api/createReservableBatch.js

export async function createReservableBatch(client, reservableIds = []) {
  const rpcParams = {
    p_reservable_ids: reservableIds && Array.isArray(reservableIds)
      ? reservableIds
      : []
  };

  const { data, error } = await client.rpc('create_reservable_batch', rpcParams);

  if (error) {
    console.error('[createReservableBatch] Erreur serveur :', error);
    throw error;
  }

  return data || null; // data = { id, description }
}
