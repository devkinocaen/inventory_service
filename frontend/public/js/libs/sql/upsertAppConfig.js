export async function upsertAppConfig(
  client,
  newSessionId,
  useCurrentTime = null,
  newAppVersion = null,
  newAdminEmail = null,
  viewerAllowed = null,
  showPrices = null,
  defaultManagerId = null,
  defaultOwnerId = null,
  defaultStorageLocationId = null
) {
  const { error } = await client.rpc('upsert_app_config', {
    p_current_session_id: newSessionId,
    p_use_current_time: useCurrentTime,
    p_app_version: newAppVersion,
    p_admin_email: newAdminEmail,
    p_viewer_allowed: viewerAllowed,
    p_show_prices: showPrices,
    p_default_manager_id: defaultManagerId,
    p_default_owner_id: defaultOwnerId,
    p_default_storage_location_id: defaultStorageLocationId
  });

  if (error) {
    console.error('❌ Erreur lors de la mise à jour de la config:', error);
    throw error;
  }
}
