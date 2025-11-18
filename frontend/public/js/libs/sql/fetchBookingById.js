// récupère un booking + batch par ID
import { single } from '../helpers.js';

export async function fetchBookingById(client, id) {
    if (!id) return null;
    try {
        const { data, error } = await client.rpc('inventory.get_booking_by_id', { p_booking_id: id });
        if (error) throw error;
        return single(data); // renvoie { booking: {...}, batch: {...} }
    } catch (err) {
        console.error('[fetchBookingById]', err);
        return null;
    }
}
