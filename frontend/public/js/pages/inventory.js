// js/pages/inventory.js

import { fetchReservables } from '../libs/sql/index.js'; // ta fonction côté backend
import {formatServerError } from '../libs/helpers.js'
import { initClient } from '../libs/client.js';

const client = await initClient();

let currentItems = [];

// ========== Rendu du tableau ==========
function renderStockTable(items) {
  const tbody = document.querySelector('#stock_table tbody');
  if (!tbody) return;

  tbody.innerHTML = '';
  currentItems = items;

  items.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.name}</td>
      <td>${item.type_name || ''}</td>
      <td>${item.owner_name || ''}</td>
      <td>${item.manager_name || ''}</td>
      <td>${item.status_name || ''}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ========== Filtrage dynamique ==========
function setupLookupFilter() {
  const input = document.getElementById('lookup_item_name');
  const tbody = document.querySelector('#stock_table tbody');

  if (!input || !tbody) return;

  input.addEventListener('input', () => {
    const filter = input.value.toLowerCase();
    Array.from(tbody.rows).forEach(row => {
      const nameCell = row.cells[0];
      row.style.display = nameCell.textContent.toLowerCase().includes(filter) ? '' : 'none';
    });
  });
}

// ========== Initialisation ==========
export async function init() {
  try {
      
    const items = await fetchReservables(client);
      
    renderStockTable(items);
    setupLookupFilter();
  } catch (err) {
    console.error('[inventory] Erreur lors de l’initialisation :', formatServerError(err.message));
  }
}
