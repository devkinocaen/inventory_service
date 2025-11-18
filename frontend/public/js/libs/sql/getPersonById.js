// récupère une personne par ID
export async function getPersonById(client, id) {
    if (!id) return null;
    try {
        const { data, error } = await client.rpc('inventory.get_person_by_id', { p_id: id });
        if (error) throw error;
        return data && data.length ? data[0] : null;
    } catch (err) {
        console.error('[getPersonById]', err);
        return null;
    }
}
