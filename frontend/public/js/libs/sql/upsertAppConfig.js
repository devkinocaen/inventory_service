// js/api/upsertAppConfig.js
import { formatServerError } from '../helpers.js';

/**
 * Met à jour ou insère la configuration de l'application
 * @param {object} client - instance RPC (Neon / PostgREST)
 * @param {object} options - champs à mettre à jour
 * @param {string|null} options.appName
 * @param {string|null} options.schemaVersion
 * @param {boolean|null} options.viewerAllowed
 * @param {boolean|null} options.showPrices
 * @param {number|null} options.defaultManagerId
 * @param {number|null} options.defaultOwnerId
 * @param {number|null} options.defaultStorageLocationId
 */
export async function upsertAppConfig(
  client,
  {
    appName = null,
    schemaVersion = null,
    viewerAllowed = null,
    showPrices = null,
    defaultManagerId = null,
    defaultOwnerId = null,
    defaultStorageLocationId = null
  } = {}
) {
  const { error } = await client.rpc('upsert_app_config', {
    p_app_name: appName,
    p_schema_version: schemaVersion,
    p_viewer_allowed: viewerAllowed,
    p_show_prices: showPrices,
    p_default_manager_id: defaultManagerId,
    p_default_owner_id: defaultOwnerId,
    p_default_storage_location_id: defaultStorageLocationId
  });

  if (error) {
    console.error('❌ Erreur upsertAppConfig:', error);
    throw new Error(formatServerError(error));
  }
}
