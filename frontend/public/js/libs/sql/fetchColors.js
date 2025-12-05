// js/api/fetchColors.js
export async function fetchColors(client) {
  const { data, error } = await client.rpc('get_colors', {});
  if (error) {
    console.error('[fetchColors] Erreur serveur :', error);
    return [];
  }
  return data || [];
}
