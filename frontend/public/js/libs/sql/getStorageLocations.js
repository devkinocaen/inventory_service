// récupère toutes les storage locations
export async function getStorageLocations(client) {
    try {
        const { data, error } = await client.rpc('inventory.get_storage_locations');
        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error('[getStorageLocations]', err);
        return [];
    }
}
