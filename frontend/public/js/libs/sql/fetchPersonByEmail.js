// récupère une personne par email
import { single } from '../helpers.js';

export async function fetchPersonByEmail(client, email) {
    if (!email || email == '') return null;
    try {
        const { data, error } = await client.rpc('get_person_by_email', { p_email: email });
        if (error) throw error;
        return single(data);
    } catch (err) {
        return null;
    }
}
