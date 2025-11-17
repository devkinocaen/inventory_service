// js/pages/collection.js
import {
    fetchReservables,
    fetchCategories,
    fetchSubcategories,
    fetchStyles
} from '../libs/sql/index.js';

import { initClient } from '../libs/client.js';
import { openBookingModal } from '../modals/booking_modal.js';
import { openOrgModal } from '../modals/org_modal.js';
import { formatServerError } from '../libs/helpers.js';


let client;
let currentItems = [];
let selectedItems = [];
let activeFilters = { category: [], subcategory: [], style: [], gender: [] };

let currentFilterStart = null;
let currentFilterEnd = null;


// Variables globales pour les données de filtre
let currentCategories = [];
let currentSubcategories = [];
let currentStyles = [];

const genderMap = {
  'Homme': 'male',
  'Femme': 'female',
  'Unisexe': 'unisex'
};


// ---- DOM Elements ----
let filtersSidebar, filtersToggle, cartToggle, orgToggle, container;
let lookupInput;

/**
 * Toggle filtre sélectionné
 */
function toggleFilter(type, value) {
  if (activeFilters[type].includes(value)) {
    activeFilters[type] = activeFilters[type].filter(v => v !== value);
  } else {
    activeFilters[type].push(value);
  }
}

/**
 * Render les filtres sous forme de chips stylées
 */
function renderFilterChips(categories, subcategories, styles) {
  const categoryChips = document.getElementById('cstm-categoryChips');
  const subcatChips = document.getElementById('cstm-subcatChips');
  const styleChips = document.getElementById('cstm-styleChips');
  const genderChips = document.getElementById('cstm-genderChips'); // nouvelle div dans ton HTML

  if (!categoryChips || !subcatChips || !styleChips || !genderChips) return;

  const makeChip = (name, type) => {
    const chip = document.createElement('div');
    chip.textContent = name;
    chip.className = 'filter-chip' + (activeFilters[type].includes(name) ? ' selected' : '');
    chip.onclick = () => {
      toggleFilter(type, name);
      renderFilterChips(categories, subcategories, styles);
      fetchItemsAndRender();
    };
    return chip;
  };

  categoryChips.innerHTML = '';
  categories.forEach(c => categoryChips.appendChild(makeChip(c.name, 'category')));

  subcatChips.innerHTML = '';
  if (activeFilters.category.length > 0) {
    const filteredSubcats = subcategories.filter(sc =>
      activeFilters.category.includes(sc.category_name)
    );
    filteredSubcats.forEach(s => subcatChips.appendChild(makeChip(s.name, 'subcategory')));
  }

  styleChips.innerHTML = '';
  styles.forEach(s => styleChips.appendChild(makeChip(s.name, 'style')));
    
  // Genre (constantes fixes)
  const genders = ['Homme', 'Femme', 'Unisexe'];
  genderChips.innerHTML = '';
  genders.forEach(g => genderChips.appendChild(makeChip(g, 'gender')));
}

/**
 * Fetch les items depuis la base SQL selon les filtres sidebar
 */
async function fetchItems() {
  let filterStartDate = currentFilterStart ? currentFilterStart.toISOString() : null;
  let filterEndDate = currentFilterEnd ? currentFilterEnd.toISOString() : null;

  const now = new Date();
  if (filterStartDate && new Date(filterStartDate).getTime() < now.getTime()) filterStartDate = null;
  if (filterEndDate && new Date(filterEndDate).getTime() < now.getTime()) filterEndDate = null;
  if (filterStartDate && filterEndDate && new Date(filterStartDate) >= new Date(filterEndDate)) {
    alert('La date de fin doit être après la date de début');
    filterStartDate = null;
    filterEndDate = null;
  }

  const filters = {
    p_category_ids: activeFilters.category.length
      ? currentCategories
          .filter(c => activeFilters.category.includes(c.name))
          .map(c => c.id)
      : null,
    p_subcategory_ids: activeFilters.subcategory.length
      ? currentSubcategories
          .filter(sc => activeFilters.subcategory.includes(sc.name))
          .map(sc => sc.id)
      : null,
    p_style_ids: activeFilters.style.length
      ? currentStyles
          .filter(s => activeFilters.style.includes(s.name))
          .map(s => s.id)
      : null,
    p_gender: activeFilters.gender.length
      ? activeFilters.gender.map(g => genderMap[g])
      : null,
    p_start_date: filterStartDate,
    p_end_date: filterEndDate
  };

  try {
    currentItems = await fetchReservables(client, filters);
  } catch (err) {
    console.error('[Collection] Erreur fetchReservables :', err);
  }
}

/**
 * Render les items dans le DOM
 * @param {Array} itemsToRender tableau d'items (peut être filtré localement pour lookup)
 */
function renderItems(itemsToRender = currentItems) {
  if (!container) return;
  container.innerHTML = '';

  const lookupValue = lookupInput?.value?.trim().toLowerCase();

  const filteredItems = lookupValue
    ? itemsToRender.filter(i => i.name.toLowerCase().includes(lookupValue))
    : itemsToRender;

  for (const item of filteredItems) {
    const div = document.createElement('div');
    div.className = 'cstm-costume-card' + (selectedItems.includes(item.id) ? ' selected' : '');

    const img = document.createElement('img');
    img.src = item.photos?.[0]?.url || 'data:image/svg+xml;charset=UTF-8,' +
        encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
            <rect width="200" height="200" fill="#ddd"/>
            <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#888" font-size="16">No Image</text>
        </svg>`);

    if (item.photos && item.photos.length > 1) {
      let currentIndex = 0;
      img.src = item.photos[currentIndex].url;
      let intervalId = null;

      img.addEventListener('mouseenter', () => {
        intervalId = setInterval(() => {
          currentIndex = (currentIndex + 1) % item.photos.length;
          img.src = item.photos[currentIndex].url;
        }, 1500);
      });

      img.addEventListener('mouseleave', () => {
        clearInterval(intervalId);
        intervalId = null;
        currentIndex = 0;
        img.src = item.photos[currentIndex].url;
      });
    }

    div.appendChild(img);

    const name = document.createElement('div');
    name.className = 'cstm-costume-name';
    name.innerHTML = `<strong>${item.name}</strong><br>
                      Taille: ${item.size_label || '-'}<br>
                      Prix/jour: ${item.price_per_day ? item.price_per_day + ' €' : '-'}`;
    div.appendChild(name);

    div.addEventListener('click', () => {
      if (selectedItems.includes(item.id)) {
        selectedItems = selectedItems.filter(i => i !== item.id);
        div.classList.remove('selected');
      } else {
        selectedItems.push(item.id);
        div.classList.add('selected');
      }
    });

    container.appendChild(div);
  }
}

/**
 * Combine fetch + render selon les filtres sidebar
 */
async function fetchItemsAndRender() {
  await fetchItems();
  renderItems();
}

/**
 * Charge les données depuis la base SQL au démarrage
 */
async function loadData() {
  try {
    const [items, categories, subcategories, styles] = await Promise.all([
      fetchReservables(client),
      fetchCategories(client),
      fetchSubcategories(client),
      fetchStyles(client)
    ]);

    currentItems = items;
    currentCategories = categories;
    currentSubcategories = subcategories;
    currentStyles = styles;

    renderFilterChips(categories, subcategories, styles);
    renderItems();
  } catch (err) {
    console.error('[Collection] Erreur :', formatServerError(err.message || err));
  }
}

/**
 * Initialisation après injection du HTML
 */
export async function init() {
  client = await initClient();

  filtersSidebar = document.getElementById('cstm-filtersSidebar');
  filtersToggle = document.getElementById('cstm-filtersToggle');
  cartToggle = document.getElementById('cstm-cartToggle');
  orgToggle = document.getElementById('cstm-orgToggle');
  container = document.getElementById('cstm-main');
  lookupInput = document.getElementById('cstm-lookupInput');

  if (!document.getElementById('cstm-cartBottom')) {
    const bottomCart = document.createElement('div');
    bottomCart.id = 'cstm-cartBottom';
    bottomCart.style.marginTop = '2rem';
    if (container?.parentNode) container.parentNode.appendChild(bottomCart);
  }

  filtersToggle.addEventListener('click', () => {
    filtersSidebar?.classList.toggle('cstm-collapsed');
    filtersToggle?.classList.toggle('cstm-collapsed');
  });

  cartToggle.addEventListener('click', async () => {
    const itemsForModal = selectedItems.map(id => {
      const item = currentItems.find(i => i.id === id);
      return item ? {
        id: item.id,
        name: item.name,
        category_name: item.category_name,
        photos: item.photos
      } : null;
    }).filter(Boolean);

    await openBookingModal(itemsForModal, {
      start: currentFilterStart,
      end: currentFilterEnd
    });
  });

  orgToggle.addEventListener('click', async () => {
    const itemsForModal = selectedItems.map(id => {
      const item = currentItems.find(i => i.id === id);
      return item ? {
        name: item.name,
        category_name: item.category_name,
        photos: item.photos
      } : null;
    }).filter(Boolean);

    await openOrgModal(itemsForModal);
  });

  document.getElementById('cstm-applyDateFilter')?.addEventListener('click', () => {
    const start = document.getElementById('cstm-filterStartDate')?.value || null;
    const end   = document.getElementById('cstm-filterEndDate')?.value || null;

    currentFilterStart = start ? new Date(start) : null;
    currentFilterEnd   = end   ? new Date(end)   : null;

    fetchItemsAndRender();
  });

  lookupInput?.addEventListener('input', () => {
    renderItems(); // applique uniquement la recherche locale
  });

  await loadData();
}
