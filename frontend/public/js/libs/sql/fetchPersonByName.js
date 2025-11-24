// récupère une personne par ID
import { single } from '../helpers.js';
export async function fetchPersonByName(client, firstName, lastName) {
    if (!id) return null;
    try {
        const { data, error } = await client.rpc('inventory.get_person_by_name', { p_first_name: firstName, p_last_name: lastName });
        if (error) throw error;
        return single(data);
    } catch (err) {
        console.error('[fetchPersonByName]', err);
        return null;
    }
}
