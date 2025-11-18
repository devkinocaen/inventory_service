// récupère un batch par ID avec ses reservables
import { singleOrList } from '../helpers.js';

export async function fetchBatchById(client, id) {
    if (!id) return null;
    try {
        const { data, error } = await client.rpc('inventory.get_batch_by_id', { p_batch_id: id });
        if (error) throw error;
        // si aucun reservable, data est vide ou 1 ligne avec reservable_id null
        if (!data || data.length === 0) return null;

        const batchInfo = {
            id: data[0].batch_id,
            description: data[0].batch_description,
            reservables: data
                .filter(r => r.reservable_id)
                .map(r => ({
                    id: r.reservable_id,
                    name: r.reservable_name,
                    status: r.reservable_status,
                    is_in_stock: r.reservable_in_stock
                }))
        };
        return batchInfo;
    } catch (err) {
        console.error('[fetchBatchById]', err);
        return null;
    }
}
