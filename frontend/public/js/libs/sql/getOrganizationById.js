// récupère une organisation par ID
export async function getOrganizationById(client, id) {
    if (!id) return null;
    try {
        const { data, error } = await client.rpc('inventory.get_organization_by_id', { p_id: id });
        if (error) throw error;
        return data && data.length ? data[0] : null;
    } catch (err) {
        console.error('[getOrganizationById]', err);
        return null;
    }
}
