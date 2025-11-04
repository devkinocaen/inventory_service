// clients/roles.js

/**
 * Mapping des rôles Supabase vers la redirection et les permissions
 */
export const ROLES = {
  dev: {
    canRead: 'all',
    canWrite: 'all',
  },
  admin: {
    canRead: 'all',
    canWrite: [
      'app_config',
      'event',
      'session',
      'participant',
      'participant_session',
      'participant_skill',
    ],
  },
  prod: {
    canRead: 'all',
    canWrite: [
      'app_config',
      'participant',
      'participant_session',
      'participant_skill',
      'project',
      'shooting_location',
      'shooting',
      'editing_station_booking',
      'equipment_booking'
    ],
  },
  lab: {
    canRead: 'all',
    canWrite: [
      'app_config',
      'participant',
      'participant_session',
      'participant_skill',
      'project',
      'editing_station',
      'editing_station_booking',
    ],
  },
  mag: {
    canRead: 'all',
    canWrite: [
      'app_config',
      'project',
      'equipment',
      'equipment_booking',
    ],
  },
  viewer: {
    canRead: 'all',
    canWrite: null,
  },
};

/**
 * Récupère la redirection selon le rôle
 * @param {string} role
 * @returns {string}
 */
export function getRedirectByRole(role) {
    return './pages/home.html';
}

/**
 * Vérifie si un rôle peut écrire dans une table
 * @param {string} role
 * @param {string} table
 * @returns {boolean}
 */
export function canWrite(role, table) {
  const perm = ROLES[role]?.canWrite;
  if (!perm) return false;
  if (perm === 'all') return true;
  return perm.includes(table);
}

/**
 * Vérifie si un rôle peut lire une table
 * @param {string} role
 * @param {string} table
 * @returns {boolean}
 */
export function canRead(role, table) {
  const perm = ROLES[role]?.canRead;
  if (!perm) return false;
  if (perm === 'all') return true;
  return perm.includes(table);
}
