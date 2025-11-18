import { single } from '../helpers.js';

export async function isBatchInStock(client, batchId) {
    try {
        const { data, error } = await client.rpc('is_batch_in_stock', { p_batch_id: batchId });

        if (error) {
            console.error('Erreur isBatchInStock RPC:', error);
            return null;
        }
        if (data.length < 1) return null

        return single(data).is_batch_in_stock; // true / false / null directement
    } catch (err) {
        console.error('Erreur JS isBatchInStock:', err);
        return null;
    }
}
