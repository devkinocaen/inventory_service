import { formatServerError } from '../helpers.js';

/**
 * Réaligne les séquences de toutes les tables du schema inventory
 * @param {object} client - instance Neon / Supabase / Postgres RPC
 */
export async function realignSequences(client) {
    console.log('🔹 Realignement des séquences...');
    await client.rpc('realign_sequences'); // appelle la fonction PL/pgSQL
    console.log('✅ Séquences réalignées avec succès.');
    return true;
}
