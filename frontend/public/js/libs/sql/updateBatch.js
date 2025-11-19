// met à jour un batch avec description et réservables
import { single } from '../helpers.js';

export async function updateBatch(client, batch) {
    if (!batch?.id) return null;
    console.log ('batch', batch)
    try {
        const { data, error } = await client.rpc('update_batch', {
            p_batch_id: batch.id,
            p_description: batch.description,
            p_reservable_ids: batch.reservables?.map(r => r.id) || null
        });
        if (error) throw error;
        
        console.log ('batch updated', data)
        return single(data);
        
        
    } catch (err) {
        console.error('[updateBatch]', err);
        return null;
    }
}
