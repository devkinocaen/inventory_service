import {
    fetchReservables,
    updateReservable,
    createReservable
} from '../libs/sql/index.js';

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
      <td class="editable" data-field="name" data-id="${item.id}">${item.name || ''}</td>
      <td class="editable" data-field="size" data-id="${item.id}">${item.size || ''}</td>
      <td class="editable" data-field="description" data-id="${item.id}">${item.description || ''}</td>
      <td class="editable-select" data-field="gender" data-id="${item.id}">${displayGender(item.gender)}</td>
      <td class="editable" data-field="price_per_day" data-id="${item.id}">${item.price_per_day != null ? item.price_per_day.toFixed(2) : ''}</td>
      <td class="editable-select" data-field="status" data-id="${item.id}">${item.status || ''}</td>
      <td class="editable" data-field="quality" data-id="${item.id}">${item.quality || ''}</td>
      <td class="editable-select" data-field="category" data-id="${item.id}">${item.category_name || ''}</td>
      <td class="editable-select" data-field="subcategory" data-id="${item.id}">${item.subcategory_name || ''}</td>
      <td class="editable" data-field="styles" data-id="${item.id}">${stylesList}</td>
      <td><button class="btn-photos" data-id="${item.id}">Voir</button></td>
      <td><button class="btn-edit" data-id="${item.id}">Editer</button></td>
      <td><button class="btn-delete" data-id="${item.id}">Supprimer</button></td>
    `;

    tbody.appendChild(tr);
  });

  initEditableCells();
}

// ========== Gestion édition inline ==========
function initEditableCells() {
  const tbody = document.querySelector('#stock_table tbody');
  if (!tbody) return;

  tbody.querySelectorAll('.editable').forEach(td => {
    td.addEventListener('dblclick', async () => {
      const oldValue = td.textContent;
      const input = document.createElement('input');
      input.type = td.dataset.field === 'price_per_day' ? 'number' : 'text';
      input.value = oldValue;
      td.textContent = '';
      td.appendChild(input);
      input.focus();

      const cancelEdit = () => { td.textContent = oldValue; };

      input.addEventListener('blur', async () => {
        const newValue = input.value.trim();
        if (newValue !== oldValue) {
          const itemId = Number(td.dataset.id);
          const field = td.dataset.field;
          const item = currentItems.find(i => i.id === itemId);
          if (item) {
            try {
              const payload = { id: itemId };
              payload[field] = field === 'price_per_day' ? parseFloat(newValue) : newValue;
              await updateReservable(client, payload);
              item[field] = payload[field];
              td.textContent = field === 'gender' ? displayGender(payload[field]) : payload[field];
            } catch (err) {
              alert('Erreur lors de la sauvegarde : ' + formatServerError(err));
              td.textContent = oldValue;
            }
          }
        } else {
          td.textContent = oldValue;
        }
      });

      input.addEventListener('keydown', e => {
        if (e.key === 'Escape') cancelEdit();
        if (e.key === 'Enter') input.blur();
      });
    });
  });

  tbody.querySelectorAll('.editable-select').forEach(td => {
    td.addEventListener('dblclick', async () => {
      td.textContent = '';
      const select = document.createElement('select');
      const field = td.dataset.field;
      const itemId = Number(td.dataset.id);
      const item = currentItems.find(i => i.id === itemId);

      let options = [];
      if (field === 'gender') options = ['male', 'female', 'unisex'];
      else if (field === 'rstatus') options = ['Disponible', 'Réservé', 'En maintenance']; // adapter
      else if (field === 'category_id') options = [{id:1,name:'Vêtements'}, {id:2,name:'Accessoires'}]; // exemple
      else if (field === 'subcategory_id') options = [{id:10,name:'Haut'}, {id:11,name:'Bas'}]; // exemple

      options.forEach(opt => {
        const option = document.createElement('option');
        if (typeof opt === 'object') {
          option.value = opt.id;
          option.textContent = opt.name;
          if ((item && item[field + '_name'] === opt.name) || (item && item[field] === opt.id)) option.selected = true;
        } else {
          option.value = opt;
          option.textContent = field === 'gender' ? displayGender(opt) : opt;
          if (item && item[field] === opt) option.selected = true;
        }
        select.appendChild(option);
      });

      td.appendChild(select);
      select.focus();

      const cancelEdit = () => {
        td.textContent = (item && (item[field + '_name'] || displayGender(item[field]))) || '';
      };

      select.addEventListener('change', async () => {
        const newValue = select.value;
        if (item) {
          try {
            const payload = { id: itemId };
            payload[field] = isNaN(newValue) ? newValue : Number(newValue);
            await updateReservable(client, payload);
            item[field] = payload[field];
            td.textContent = field === 'gender' ? displayGender(payload[field]) : (typeof newValue === 'number' ? options.find(o => o.id === payload[field]).name : payload[field]);
          } catch (err) {
            alert('Erreur lors de la sauvegarde : ' + formatServerError(err));
            cancelEdit();
          }
        }
      });

      select.addEventListener('blur', cancelEdit);
      select.addEventListener('keydown', e => { if (e.key === 'Escape') cancelEdit(); });
    });
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
