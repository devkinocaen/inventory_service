import { fetchReservables } from '../libs/sql/index.js';
import { formatServerError } from '../libs/helpers.js';
import { initClient } from '../libs/client.js';

const client = await initClient();
let currentItems = [];

// ========== Utilitaire pour afficher le genre ==========
function displayGender(value) {
  if (!value) return '';
  switch (value.toLowerCase()) {
    case 'male': return 'Homme';
    case 'female': return 'Femme';
    case 'unisex': return 'Unisexe';
    default: return value;
  }
}

// ========== Rendu du tableau ==========
function renderStockTable(items) {
  const tbody = document.querySelector('#stock_table tbody');
  if (!tbody) return;

  tbody.innerHTML = '';
  currentItems = items;

  items.forEach(item => {
    const tr = document.createElement('tr');

    // Styles : tableau N:N -> liste de noms séparés par virgule
    const stylesList = item.style_names?.join(', ') || '';

    tr.innerHTML = `
      <td>${item.name || ''}</td>
      <td>${item.size || ''}</td>
      <td>${item.description || ''}</td>
      <td>${displayGender(item.gender)}</td>
      <td>${item.price_per_day != null ? item.price_per_day.toFixed(2) : ''}</td>
      <td>${item.status || ''}</td>
      <td>${item.quality || ''}</td>
      <td>${item.category_name || ''}</td>
      <td>${item.subcategory_name || ''}</td>
      <td>${stylesList}</td>
      <td><button class="btn-photos" data-id="${item.id}">Voir</button></td>
      <td><button class="btn-edit" data-id="${item.id}">Editer</button></td>
      <td><button class="btn-delete" data-id="${item.id}">Supprimer</button></td>
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
