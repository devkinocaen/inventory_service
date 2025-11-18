// récupère une organisation par ID
import { single } from '../helpers.js';
export async function fetchOrganizationById(client, id) {
    if (!id) return null;
    try {
        const { data, error } = await client.rpc('inventory.get_organization_by_id', { p_id: id });
        if (error) throw error;
        return single (data);
    } catch (err) {
        console.error('[getOrganizationById]', err);
        return null;
    }
}
