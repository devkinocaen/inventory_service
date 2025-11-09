// js/api/fetchStyles.js
export async function fetchStyles(client) {
  const { data, error } = await client.rpc('get_styles', {});
  if (error) {
    console.error('[fetchStyles] Erreur serveur :', error);
    return [];
  }
  return data || [];
}
