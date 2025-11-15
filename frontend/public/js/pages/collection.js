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

// Variables globales pour les données de filtre
let currentCategories = [];
let currentSubcategories = [];
let currentStyles = [];

// ---- DOM Elements ----
let filtersSidebar, filtersToggle, cartToggle, orgToggle, container;

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
      renderItems();
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
 * Récupère et affiche les items filtrés selon la sidebar
 */
async function renderItems() {
  if (!container) return;
  container.innerHTML = '';

  let filterStartDate = document.getElementById('cstm-filterStartDate')?.value || null;
  let filterEndDate = document.getElementById('cstm-filterEndDate')?.value || null;
  const now = new Date();

  if (filterStartDate && new Date(filterStartDate).getTime() < now.getTime()) filterStartDate = null;
  if (filterEndDate && new Date(filterEndDate).getTime() < now.getTime()) filterEndDate = null;
  if (filterStartDate && filterEndDate && new Date(filterStartDate) >= new Date(filterEndDate)) {
    alert('La date de fin doit être après la date de début');
    filterStartDate = null;
    filterEndDate = null;
  }

  const filters = {
    // Maintenant on passe des tableaux pour catégories et sous-catégories
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

    // Styles restent un tableau
    p_style_ids: activeFilters.style.length
      ? currentStyles
          .filter(s => activeFilters.style.includes(s.name))
          .map(s => s.id)
      : null,
    p_gender: activeFilters.gender.length ? activeFilters.gender : null,

    p_start_date: filterStartDate,
    p_end_date: filterEndDate
  };

  try {
    currentItems = await fetchReservables(client, filters);
  } catch (err) {
    console.error('[Collection] Erreur fetchReservables :', err);
    return;
  }

  for (const item of currentItems) {
    const div = document.createElement('div');
    div.className = 'cstm-costume-card' + (selectedItems.includes(item.id) ? ' selected' : '');

    const img = document.createElement('img');
    img.src = item.photos?.[0]?.url || 'data:image/svg+xml;charset=UTF-8,' +
      encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
        <rect width="200" height="200" fill="#ddd"/>
        <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#888" font-size="16">No Image</text>
      </svg>`);
    div.appendChild(img);

    const name = document.createElement('div');
    name.className = 'cstm-costume-name';
    name.innerHTML = `<strong>${item.name}</strong><br>
                      Taille: ${item.size_label || '-'}<br>
                      Prix/jour: ${item.price_per_day ? item.price_per_day + ' €' : '-'}`;
    div.appendChild(name);

    div.addEventListener('click', () => {
      if (selectedItems.includes(item.id)) selectedItems = selectedItems.filter(i => i !== item.id);
      else selectedItems.push(item.id);
      renderItems();
      renderCart();
    });

    container.appendChild(div);
  }
}


/**
 * Render le panier en bas
 */
function renderCart() {
  const cartContainer = document.getElementById('cstm-cartBottom');
  if (!cartContainer) return;

  cartContainer.innerHTML = '<h4>Panier</h4>';
  selectedItems.forEach(id => {
    const item = currentItems.find(i => i.id === id);
    if (!item) return;

    const div = document.createElement('div');
    div.className = 'cart-item';
    div.innerHTML = `<strong>${item.name}</strong> | Taille: ${item.size_label || '-'} | Prix/jour: ${item.price_per_day ? item.price_per_day + ' €' : '-'}`;
    cartContainer.appendChild(div);
  });
}

/**
 * Charge les données depuis la base SQL
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
    renderCart();
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
        name: item.name,
        category_name: item.category_name,
        photos: item.photos
      } : null;
    }).filter(Boolean);

    await openBookingModal(itemsForModal);
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

  document.getElementById('cstm-filterStartDate')?.addEventListener('change', renderItems);
  document.getElementById('cstm-filterEndDate')?.addEventListener('change', renderItems);

  await loadData();
}
