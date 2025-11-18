// récupère une storage location par ID
import { single } from '../helpers.js';
export async function fetchStorageLocationById(client, id) {
    if (!id) return null;
    try {
        const { data, error } = await client.rpc('inventory.get_storage_location_by_id', { p_id: id });
        if (error) throw error;
        return single (data);
        
    } catch (err) {
        console.error('[getStorageLocationById]', err);
        return null;
    }
}
