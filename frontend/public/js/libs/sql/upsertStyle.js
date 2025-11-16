export async function upsertStyle(client, { id = null, name }) {
  if (!name) throw new Error('Le nom du style est obligatoire');
  const { data, error } = await client.rpc('upsert_style', {
    p_style_id: id,
    p_name: name
  });
  if (error) {
    console.error('[upsertStyle] Erreur serveur :', error);
    throw error;
  }
  return data?.[0] ?? null;
}
