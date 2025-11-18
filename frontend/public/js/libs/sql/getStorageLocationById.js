// récupère une storage location par ID
export async function getStorageLocationById(client, id) {
    if (!id) return null;
    try {
        const { data, error } = await client.rpc('inventory.get_storage_location_by_id', { p_id: id });
        if (error) throw error;
        return data && data.length ? data[0] : null;
    } catch (err) {
        console.error('[getStorageLocationById]', err);
        return null;
    }
}
