// js/api/fetchGenders.js
export async function fetchGenders(client) {
  const { data, error } = await client.rpc('get_genders', {});
  if (error) {
    console.error('[fetchGenders] Erreur serveur :', error);
    return [];
  }
  return (data || []).map(r => r.gender);
}
