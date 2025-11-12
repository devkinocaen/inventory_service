// js/pages/collection.js
import { fetchReservables, fetchCategories, fetchSubcategories, fetchStyles } from '../libs/sql/index.js';
import { initClient } from '../libs/client.js';
import { openBookingModal } from '../modals/booking_modal.js';
import { formatServerError } from '../libs/helpers.js';

let client;
let currentItems = [];
let selectedItems = [];
let activeFilters = { category: [], subcategory: [], style: [] };

// ---- DOM Elements ----
let filtersSidebar, filtersToggle, cartSidebar, cartToggle, container;

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

  if (!categoryChips || !subcatChips || !styleChips) return;

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

  // --- Catégories ---
  categoryChips.innerHTML = '';
  categories.forEach(c => categoryChips.appendChild(makeChip(c.name, 'category')));

  // --- Sous-catégories ---
  subcatChips.innerHTML = '';
  if (activeFilters.category.length > 0) {
    // On ne montre que les sous-catégories appartenant à une catégorie sélectionnée
    const filteredSubcats = subcategories.filter(sc =>
      activeFilters.category.includes(sc.category_name)
    );
    filteredSubcats.forEach(s => subcatChips.appendChild(makeChip(s.name, 'subcategory')));
  }

  // --- Styles ---
  styleChips.innerHTML = '';
  styles.forEach(s => styleChips.appendChild(makeChip(s.name, 'style')));
}

/**
 * Render les costumes filtrés
 */
function renderItems() {
  if (!container) return;
  container.innerHTML = '';

  currentItems.forEach(item => {
    if (activeFilters.category.length && !activeFilters.category.includes(item.category_name)) return;
    if (activeFilters.subcategory.length && !activeFilters.subcategory.includes(item.subcategory_name)) return;
    if (activeFilters.style.length && !activeFilters.style.includes(item.style_names?.[0])) return;

    const div = document.createElement('div');
    div.className = 'cstm-costume-card' + (selectedItems.includes(item.id) ? ' selected' : '');

    // ⚡ Image principale + hover cycle
    const img = document.createElement('img');
    img.src = item.photos?.[0]?.url || 'data:image/svg+xml;charset=UTF-8,' +
      encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
        <rect width="200" height="200" fill="#ddd"/>
        <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#888" font-size="16">No Image</text>
      </svg>`);

    let hoverInterval, idx = 0;
    div.addEventListener('mouseenter', () => {
      if (!item.photos?.length) return;
      hoverInterval = setInterval(() => {
        idx = (idx + 1) % item.photos.length;
        img.src = item.photos[idx].url;
      }, 1000);
    });
    div.addEventListener('mouseleave', () => {
      clearInterval(hoverInterval);
      idx = 0;
      img.src = item.photos?.[0]?.url || img.src;
    });
    div.appendChild(img);

    // Nom + taille + prix/jour
                         console.log ('item', item)
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
  });
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
  cartSidebar = document.getElementById('cstm-cartSidebar');
  cartToggle = document.getElementById('cstm-cartToggle');
  container = document.getElementById('cstm-main');

  if (!document.getElementById('cstm-cartBottom')) {
    const bottomCart = document.createElement('div');
    bottomCart.id = 'cstm-cartBottom';
    bottomCart.style.marginTop = '2rem';
    container.parentNode.appendChild(bottomCart);
  }

  filtersToggle.addEventListener('click', () => {
    filtersSidebar.classList.toggle('cstm-collapsed');
    filtersToggle.classList.toggle('cstm-collapsed');
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

  await loadData();
}
