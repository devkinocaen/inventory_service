// js/api/fetchPatterns.js
export async function fetchPatterns(client) {
  const { data, error } = await client.rpc('get_patterns', {});
  if (error) {
    console.error('[fetchPatterns] Erreur serveur :', error);
    return [];
  }
  return data || [];
}
