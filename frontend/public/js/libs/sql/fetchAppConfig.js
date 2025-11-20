/**
 * Récupère la configuration complète de l'application.
 *
 * @param {object} client - Instance Supabase / Neon.
 * @returns {Promise<object|null>}
 */
export async function fetchAppConfig(client) {
  const { data, error } = await client.rpc('get_app_config');
  if (error) {
    console.error('❌ Erreur lors de la récupération de la config:', error);
    return null;
  }

  // On retourne le premier élément du tableau (peut inclure viewer_allowed, show_prices, defaults, etc.)
  return data?.[0] ?? null;
}
