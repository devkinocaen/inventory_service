// récupère une personne par ID
import { single } from '../helpers.js';
export async function fetchPersonById(client, id) {
    if (!id) return null;
    try {
        const { data, error } = await client.rpc('get_person_by_id', { p_id: id });
        if (error) throw error;
        return single(data);
    } catch (err) {
        console.error('[getPersonById]', err);
        return null;
    }
}
