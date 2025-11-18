/**
 * Met un batch dans le stock ou le retire selon p_in_stock
 * @param {object} client - instance du client RPC (Neon/PostgreSQL)
 * @param {number} batchId - ID du batch
 * @param {boolean} inStock - true pour mettre en stock, false pour sortir
 */
export async function setBatchInStock(client, batchId, inStock) {
  if (!client) throw new Error('Client RPC manquant');
  if (typeof batchId !== 'number') throw new Error('batchId doit être un nombre');
  if (typeof inStock !== 'boolean') throw new Error('inStock doit être un booléen');

  try {
    await client.rpc('set_batch_in_stock', {
      p_batch_id: batchId,
      p_in_stock: inStock
    });
  } catch (err) {
    console.error(`Erreur setBatchInStock (batch ${batchId}) :`, err);
    throw err; // remonte l'erreur pour traitement côté UI
  }
}
