import {
    fetchReservables,
    fetchReservableById,
    fetchCategories,
    fetchSubcategories,
    updateReservable,
    createReservable,
    deleteReservable,
    generateUniqueId
} from '../libs/sql/index.js';

import { formatServerError } from '../libs/helpers.js';
import { initClient } from '../libs/client.js';
import { openPhotoModal } from '../modals/photo_modal.js'; // chemin vers ton JS modal
import { openReservableModal } from '../modals/reservable_modal.js'; // chemin vers ton JS modal

const client = await initClient();
let currentItems = [];

let categories = null;
let subCategories = {}; // { categoryId: [subcat,...] }
let selectedCategoryId = null;

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

async function loadAllSubCategories() {
    const all = await fetchSubcategories(client);
    subCategories = {};

    for (const sc of all) {
        const cid = sc.category_id;
        if (!subCategories[cid]) subCategories[cid] = [];
        subCategories[cid].push(sc);
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
      <td class="editable-select" data-field="gender" data-id="${item.id}">${GENDER_MAP[item.gender] || ''}</td>
      <td class="editable" data-field="price_per_day" data-id="${item.id}">${item.price_per_day != null ? item.price_per_day.toFixed(2) : ''}</td>
      <td class="editable-select" data-field="status" data-id="${item.id}">${STATUS_MAP[item.status] || ''}</td>
      <td class="editable-select" data-field="quality" data-id="${item.id}">${QUALITY_MAP[item.quality] || ''}</td>
      <td class="editable-select" data-field="category" data-id="${item.id}">${item.category_name || ''}</td>
      <td class="editable-select" data-field="subcategory" data-id="${item.id}">${item.subcategory_name || ''}</td>
      <td data-field="styles" data-id="${item.id}">${stylesList}</td>
      <td><button class="btn-edit" data-id="${item.id}">Editer</button></td>
      <td><button class="btn-photos" data-id="${item.id}">Modifier (${item.photos?.length || 0})</button></td>
      <td><button class="btn-delete" data-id="${item.id}">Supprimer</button></td>
    `;
        
        tbody.appendChild(tr);
    });
    
    initEditableCells();
    setupDeleteButtons();
    setupPhotoButtons();
    setupEditButtons();
}

// ===== Mappings pour affichage =====
const GENDER_MAP = { male: 'Homme', female: 'Femme', unisex: 'Unisexe' };
const STATUS_MAP = {
  'disponible': 'Disponible',
  'indisponible': 'Indisponible',
  'en réparation': 'En réparation',
  'perdu': 'Perdu',
  'hors service': 'Hors service'
};
const QUALITY_MAP = {
  'neuf': 'Neuf',
  'bon état': 'Bon état',
  'abîmé': 'Abîmé',
  'très abîmé': 'Très abîmé',
  'inutilisable': 'Inutilisable'
};


// ========== Filtrage dynamique ==========
function setupLookupFilter() {
  const input = document.getElementById('lookup_item_name');
  const tbody = document.querySelector('#stock_table tbody');
  if (!input || !tbody) return;
    input.placeholder = "Rechercher... [dans: nom, description, styles]";

  input.addEventListener('input', () => {
    const filter = input.value.toLowerCase();

    Array.from(tbody.rows).forEach(row => {
      const nameText = row.cells[0].textContent.toLowerCase();
      const descText = row.cells[2].textContent.toLowerCase();
      const styleText = row.cells[9].textContent.toLowerCase();

      const match =
        nameText.includes(filter) ||
        descText.includes(filter) ||
        styleText.includes(filter);

      row.style.display = match ? '' : 'none';
    });
  });
}



// ========== Initialisation ==========
export async function init() {
  try {
      const items = await fetchReservables(client,  {p_privacy_min: 'hidden'});
      categories = await fetchCategories(client);
      await loadAllSubCategories();

    renderStockTable(items);
    initSortableColumns();
    setupLookupFilter();
  } catch (err) {
    console.error('[inventory] Erreur lors de l’initialisation :', formatServerError(err.message));
  }
}



// ========== Gestion édition inline ==========
function initEditableCells() {
  const tbody = document.querySelector('#stock_table tbody');
  if (!tbody) return;

  // ---- cellules éditables classiques ----
  tbody.querySelectorAll('.editable').forEach(td => {
    const field = td.dataset.field;
    // fields à traiter en input simple : tout sauf gender/status/quality/category/subcategory
    if (['gender','status','quality','category','subcategory'].includes(field)) return;
    td.addEventListener('dblclick', async () => {
      const oldValue = td.textContent;
      const input = document.createElement('input');
      input.type = field === 'price_per_day' ? 'number' : 'text';
      input.value = oldValue;
      td.textContent = '';
      td.appendChild(input);
      input.focus();

      const cancelEdit = () => { td.textContent = oldValue; };

      input.addEventListener('blur', async () => {
        const newValue = input.value.trim();
        if (newValue !== oldValue) {
          const itemId = Number(td.dataset.id);
          const item = currentItems.find(i => i.id === itemId);
          if (item) {
            try {
              const payload = { id: itemId };
              payload[field] = field === 'price_per_day' ? parseFloat(newValue) : newValue;
              await updateReservable(client, payload);
              item[field] = payload[field];
              td.textContent = payload[field];
            } catch (err) {
              alert('Erreur lors de la sauvegarde : ' + formatServerError(err));
              td.textContent = oldValue;
            }
          }
        } else td.textContent = oldValue;
      });

      input.addEventListener('keydown', e => {
        if (e.key === 'Escape') cancelEdit();
        if (e.key === 'Enter') input.blur();
      });
    });
  });

  // ---- cellules select (gender / status / quality / category / subcategory) ----
  tbody.querySelectorAll('.editable-select').forEach(td => {
    td.addEventListener('dblclick', async () => {
      td.textContent = '';
      const select = document.createElement('select');
      const field = td.dataset.field;
      const itemId = Number(td.dataset.id);
      const item = currentItems.find(i => i.id === itemId);

      let options = [];
      if (field === 'gender') options = Object.keys(GENDER_MAP);
      else if (field === 'status') options = Object.keys(STATUS_MAP);
      else if (field === 'quality') options = Object.keys(QUALITY_MAP);
      else if (field === 'category')  options = categories;
      else if (field === 'subcategory') {
          const catId = item?.category_id;
          options = subCategories[catId] || [];
      }

     options.forEach(opt => {
        const option = document.createElement('option');

        // ----- CAS 1 : objets category / subcategory -----
        if (opt && typeof opt === 'object') {
          option.value = opt.id;
          option.textContent = opt.name;

          // auto-select si l'item a le bon *_id
          if (item && item[field + '_id'] === opt.id) {
            option.selected = true;
          }
        }

        // ----- CAS 2 : ENUMs (gender, status, quality) -----
        else {
          option.value = opt;
          option.textContent =
            field === 'gender'  ? GENDER_MAP[opt] :
            field === 'status'  ? STATUS_MAP[opt] :
            field === 'quality' ? QUALITY_MAP[opt] :
            opt;

          if (item && item[field] === opt) {
            option.selected = true;
          }
        }

        select.appendChild(option);
      });


      td.appendChild(select);
      select.focus();

      const cancelEdit = () => {
        td.textContent =
          field === 'gender' ? GENDER_MAP[item[field]] :
          field === 'status' ? STATUS_MAP[item[field]] :
          field === 'quality' ? QUALITY_MAP[item[field]] :
          field === 'category' ? categories.find(c => c.id === Number(newValue))?.name || '' :
          field === 'subcategory' ? subCategories[item.category_id]?.find(sc => sc.id === Number(newValue))?.name || '' :
          item[field + '_name'] || '';
      };

      select.addEventListener('change', async () => {
        let newValue = select.value;
          const row = td.closest('tr');
        if (item) {
          try {
            if (['category', 'subcategory'].includes(field)) newValue = Number(newValue);

            const payload = { id: itemId };
            payload[field + '_id'] = newValue; // envoyer l'ID au serveur
            await updateReservable(client, payload);

            item[field + '_id'] = newValue;
            item[field + '_name'] = options.find(o => o.id === newValue)?.name || '';

            // === Si on change la catégorie, reset la sous-catégorie ===
            if (field === 'category') {
              item.subcategory_id = null;
              item.subcategory_name = '';
              const subcatCell = row.querySelector('[data-field="subcategory"]');
              if (subcatCell) subcatCell.textContent = '';
            }

            td.textContent =
              field === 'gender' ? GENDER_MAP[newValue] :
              field === 'status' ? STATUS_MAP[newValue] :
              field === 'quality' ? QUALITY_MAP[newValue] :
              item[field + '_name'] || '';

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

// ========= Tri des colonnes =========
function initSortableColumns() {
  const table = document.getElementById('stock_table');
  if (!table) return;

  const headers = table.querySelectorAll('th.sortable');
  const tbody = table.querySelector('tbody');

  headers.forEach((th, index) => {
    let asc = true; // sens du tri
    th.style.cursor = 'pointer';

    th.addEventListener('click', () => {
      const rows = Array.from(tbody.querySelectorAll('tr'));

      rows.sort((a, b) => {
        const cellA = a.children[index].textContent.trim().toLowerCase();
        const cellB = b.children[index].textContent.trim().toLowerCase();

        // Nombre ?
        const numA = parseFloat(cellA.replace(',', '.'));
        const numB = parseFloat(cellB.replace(',', '.'));
        const bothNumbers = !isNaN(numA) && !isNaN(numB);

        if (bothNumbers) {
          return asc ? numA - numB : numB - numA;
        }

        // Texte
        return asc
          ? cellA.localeCompare(cellB)
          : cellB.localeCompare(cellA);
      });

      // Réinjecter les lignes triées
      tbody.innerHTML = '';
      rows.forEach(r => tbody.appendChild(r));

      asc = !asc; // On inverse pour le clic suivant
    });
  });
}


function setupDeleteButtons() {
  const tbody = document.querySelector('#stock_table tbody');
  if (!tbody) return;

  tbody.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      const itemId = Number(btn.dataset.id);
      if (!itemId) return;

      const confirmDelete = confirm('Voulez‑vous vraiment supprimer cet item ?');
      if (!confirmDelete) return;

      // Récupérer l'objet complet depuis currentItems
      const item = currentItems.find(i => i.id === itemId);
      const itemName = item ? item.name : '(nom inconnu)';

      try {
        await deleteReservable(client, itemId);

        // Retirer la ligne du tableau
        const row = btn.closest('tr');
        if (row) row.remove();

        // Retirer de currentItems
        currentItems = currentItems.filter(i => i.id !== itemId);

        alert(`✅ L'item "${itemName}" (ID: ${itemId}) a été supprimé avec succès !`);
        console.log(`[inventory] Item ${itemName} (ID: ${itemId}) supprimé`);
      } catch (err) {
        alert('Erreur lors de la suppression : ' + formatServerError(err));
        console.error('[inventory] deleteReservable error', err);
      }
    });
  });

}

function setupPhotoButtons() {
  const tbody = document.querySelector('#stock_table tbody');
  if (!tbody) return;

  tbody.querySelectorAll('.btn-photos').forEach(btn => {
    btn.addEventListener('click', async () => {
      const itemId = Number(btn.dataset.id);
      if (!itemId) return;

      // Récupérer le nom pour l'affichage du titre
      const item = currentItems.find(i => i.id === itemId);
      const itemName = item ? item.name : '(nom inconnu)';

      try {
        await openPhotoModal(client, itemId, itemName, (updatedPhotos) => {
          // Callback après sauvegarde : mettre à jour le texte du bouton
          const count = updatedPhotos.length;
          btn.textContent = `Modifier (${count})`;
          console.log(`Photos mises à jour pour l’item ${itemId}`, updatedPhotos);
          
          // Mettre à jour l'objet currentItems pour garder le compteur à jour
          if (item) item.photos = updatedPhotos;
        });
      } catch (err) {
        alert('Erreur ouverture modal photos : ' + err.message);
        console.error(err);
      }
    });
  });
}

function setupEditButtons() {
  const tbody = document.querySelector('#stock_table tbody');
  if (!tbody) return;

  tbody.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', async () => {
      const itemId = Number(btn.dataset.id);
      if (!itemId) return;

      try {
        // Ouvre le modal avec l'ID du reservable
        await openReservableModal(itemId, (savedItem) => {
          const index = currentItems.findIndex(i => i.id === itemId);
          if (index !== -1) currentItems[index] = savedItem;
          updateTableRow(savedItem);
        });

                         
        } catch (err) {
        console.error('[inventory] openReservableModal error', err);
        alert('Erreur lors de l’ouverture du modal d’édition : ' + err.message);
      }
    });
  });
}

function refreshTable() {
  fetchReservables(client, { p_privacy_min: 'hidden' })
    .then(items => renderStockTable(items))
    .catch(err => console.error('[inventory] Erreur refresh table:', formatServerError(err)));
}

function updateTableRow(item) {
    console.log ('updateTableRow', item)
  const tbody = document.querySelector('#stock_table tbody');
  if (!tbody) return;
  const row = tbody.querySelector(`tr td[data-id="${item.id}"]`)?.parentElement;

  if (!row) return;
    console.log ('updateTableRow2', item)
console.log ('item', item)
  row.innerHTML = `
    <td class="editable" data-field="name" data-id="${item.id}">${item.name || ''}</td>
    <td class="editable" data-field="size" data-id="${item.id}">${item.size || ''}</td>
    <td class="editable" data-field="description" data-id="${item.id}">${item.description || ''}</td>
    <td class="editable-select" data-field="gender" data-id="${item.id}">${GENDER_MAP[item.gender] || ''}</td>
    <td class="editable" data-field="price_per_day" data-id="${item.id}">${item.price_per_day != null ? item.price_per_day.toFixed(2) : ''}</td>
    <td class="editable-select" data-field="status" data-id="${item.id}">${STATUS_MAP[item.status] || ''}</td>
    <td class="editable-select" data-field="quality" data-id="${item.id}">${QUALITY_MAP[item.quality] || ''}</td>
    <td class="editable-select" data-field="category" data-id="${item.id}">${item.category_name || ''}</td>
    <td class="editable-select" data-field="subcategory" data-id="${item.id}">${item.subcategory_name || ''}</td>
    <td data-field="styles" data-id="${item.id}">${item.style_names?.join(', ') || ''}</td>
    <td><button class="btn-edit" data-id="${item.id}">Editer</button></td>
    <td><button class="btn-photos" data-id="${item.id}">Modifier (${item.photos?.length || 0})</button></td>
    <td><button class="btn-delete" data-id="${item.id}">Supprimer</button></td>
  `;
  initEditableCells();
  setupDeleteButtons();
  setupPhotoButtons();
  setupEditButtons();
}


// Bouton "+" pour créer un nouveau réservable
const addReservableBtn = document.getElementById('add-reservable-btn');
if (addReservableBtn) {
  addReservableBtn.addEventListener('click', async () => {
    try {
     await openReservableModal(null, (savedItem) => {
       currentItems.push(savedItem);
       renderStockTable(currentItems); // ou ajouter la ligne seule avec updateTableRow(savedItem)
     });
    } catch (err) {
      console.error('[inventory] Erreur création réservable', formatServerError(err));
      alert('Erreur création réservable : ' + formatServerError(err.message));
    }
  });
}
