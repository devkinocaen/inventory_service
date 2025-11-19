// récupère un booking + batch par ID
export async function fetchBookingById(client, id) {
    if (!id) return null;
    try {
        const { data, error } = await client.rpc('get_booking_by_id', { p_booking_id: id });
        if (error) throw error;
        console.log('raw data', data);

        if (!data || data.length === 0) return null;

        // data[0] = { get_booking_by_id: { booking: ..., batch: ... } }
        const bookingObj = Object.values(data[0])[0]; // récupère directement { booking, batch }
        return bookingObj;

    } catch (err) {
        console.error('[fetchBookingById]', err);
        return null;
    }
}
