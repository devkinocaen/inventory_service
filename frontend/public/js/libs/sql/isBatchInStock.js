import { single } from '../libs/helpers.js';

/**
 * Vérifie si un batch est en stock
 * @param {number} batchId - ID du batch
 * @returns {Promise<boolean|null>} true si tous disponibles, false si tous sortis, null sinon
 */
export async function isBatchInStock(client, batchId) {
    try {
        const { data, error } = await client
            .rpc('is_batch_in_stock', { p_batch_id: batchId })
            .single(); // on récupère exactement une ligne / valeur

        if (error) {
            console.error('Erreur isBatchInStock RPC:', error);
            return null;
        }

        return data; // true / false / null
    } catch (err) {
        console.error('Erreur JS isBatchInStock:', err);
        return null;
    }
}
