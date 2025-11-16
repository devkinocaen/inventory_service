export async function upsertCategory(client, { id = null, name }) {
  if (!name) throw new Error('Le nom de la catégorie est obligatoire');
  const { data, error } = await client.rpc('upsert_category', {
    p_category_id: id,
    p_name: name
  });
  if (error) {
    console.error('[upsertCategory] Erreur serveur :', error);
    throw error;
  }
  return data?.[0] ?? null;
}
