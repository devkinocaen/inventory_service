export async function deleteSubcategory(client, subcategoryId) {
  if (!subcategoryId) throw new Error('L’ID de la sous-catégorie est requis pour la suppression');
  const { error } = await client.rpc('delete_subcategory', { p_subcategory_id: subcategoryId });
  if (error) {
    console.error('[deleteSubcategory] Erreur serveur :', error);
    throw error;
  }
  return true;
}
