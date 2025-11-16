export async function deleteStyle(client, styleId) {
  if (!styleId) throw new Error('L’ID du style est requis pour la suppression');
  const { error } = await client.rpc('delete_style', { p_style_id: styleId });
  if (error) {
    console.error('[deleteStyle] Erreur serveur :', error);
    throw error;
  }
  return true;
}
