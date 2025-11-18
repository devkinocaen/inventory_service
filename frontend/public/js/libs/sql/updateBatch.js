// met à jour un batch avec description et réservables
export async function updateBatch(client, batch) {
    if (!batch?.id) return null;
    try {
        const { data, error } = await client.rpc('inventory.update_batch', {
            p_batch_id: batch.id,
            p_description: batch.description,
            p_reservable_ids: batch.reservables?.map(r => r.id) || null
        });
        if (error) throw error;
        return data?.[0] || null;
    } catch (err) {
        console.error('[updateBatch]', err);
        return null;
    }
}
