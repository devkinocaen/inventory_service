export async function fetchAppConfig(client) {
  const { data, error } = await client.rpc('get_app_config');
  if (error) {
    console.error('❌ Erreur lors de la récupération de la config:', error);
    return null;
  }

  // On retourne le premier élément du tableau (inclut viewer_allowed)
  return data?.[0] ?? null;
}

/**
 * Met à jour ou insère la configuration de l'application.
 *
 * @param {object} client - Instance Supabase.
 * @param {number} newSessionId - ID de la session actuelle.
 * @param {boolean|null} useCurrentTime - Optionnel : true/false ou null.
 * @param {string|null} newAppVersion - Optionnel : version de l'app.
 * @param {string|null} newAdminEmail - Optionnel : email admin.
 * @param {boolean|null} viewerAllowed - Optionnel : active/désactive le mode viewer.
 * @returns {Promise<void>}
 */
export async function upsertAppConfig(
  client,
  newSessionId,
  useCurrentTime = null,
  newAppVersion = null,
  newAdminEmail = null,
  viewerAllowed = null
) {
  const { error } = await client.rpc('upsert_app_config', {
    p_current_session_id: newSessionId,
    p_use_current_time: useCurrentTime,
    p_app_version: newAppVersion,
    p_admin_email: newAdminEmail,
    p_viewer_allowed: viewerAllowed
  });

  if (error) {
    console.error('❌ Erreur lors de la mise à jour de la config:', error);
    throw error;
  }
}
