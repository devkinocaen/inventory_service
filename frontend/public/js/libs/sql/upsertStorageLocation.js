/**
 * Crée ou met à jour une storage location
 * @param {object} client - instance du client RPC (Neon / PostgREST)
 * @param {object} params - paramètres de la location
 * @param {number|null} params.id - ID existant (update) ou null (insert)
 * @param {string} params.name - nom de la storage location
 * @param {string|null} params.address - adresse (optionnelle)
 * @returns {Promise<object|null>} - la storage location créée ou mise à jour
 */
export async function upsertStorageLocation(client, { id = null, name, address = null }) {
    try {
        const { data, error } = await client.rpc('upsert_storage_location', {
            p_id: id,
            p_name: name,
            p_address: address
        });

        if (error) throw error;
        // retourne la première ligne (on attend toujours un seul enregistrement)
        return data?.[0] || null;
    } catch (err) {
        console.error('[upsertStorageLocation]', err);
        return null;
    }
}
