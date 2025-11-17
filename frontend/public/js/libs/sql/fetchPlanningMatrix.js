// js/api/fetchPlanningMatrix.js

// ---------- Utilitaire ----------
function minutesToPostgresInterval(minutes) {
  if (typeof minutes !== 'number' || isNaN(minutes) || minutes <= 0) {
    alert('Granularité invalide : ' + minutes);
    throw new Error('Granularité invalide');
  }

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  // format HH:MM:SS, toujours 2 chiffres pour HH et MM
  const pad = n => n.toString().padStart(2, '0');
  return `${pad(hours)}:${pad(mins)}:00`;
}

// ---------- Fonction principale ----------
export async function fetchPlanningMatrix(client, params = {}) {
  // Granularité obligatoire en minutes
  const granMinutes = Number(params.p_granularity);
  const granularity = minutesToPostgresInterval(granMinutes);

  const rpcParams = {
    p_start: params.p_start,
    p_end: params.p_end,
    p_granularity: granularity
  };

  console.log("rpcParams", rpcParams);

  const { data, error } = await client.rpc('get_planning_matrix', rpcParams);

  if (error) {
    console.error('[fetchPlanningMatrix] Erreur serveur :', error);
    return [];
  }

  // Mapping propre des résultats
  return (data || []).map(r => ({
    reservable_batch_id: r.reservable_batch_id,
    batch_description: r.batch_description,
    slots: r.slots || []
  }));
}
