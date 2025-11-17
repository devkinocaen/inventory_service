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

import {
    getDisplayableImageUrl,
    isInstagramUrl,
    createInstagramBlockquote
} from '../libs/image_utils.js';

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
  const genderChips = document.getElementById('cstm-genderChips');

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
 */
async function renderItems(itemsToRender = currentItems) {
  if (!container) return;
  container.innerHTML = '';

  const lookupValue = lookupInput?.value?.trim().toLowerCase();

  const filteredItems = lookupValue
    ? itemsToRender.filter(i => i.name.toLowerCase().includes(lookupValue))
    : itemsToRender;

  for (const item of filteredItems) {
    const div = document.createElement('div');
    div.className = 'cstm-costume-card' + (selectedItems.includes(item.id) ? ' selected' : '');

    const photoContainer = document.createElement('div');
    photoContainer.className = 'cstm-costume-photo';
    photoContainer.style.width = '200px';
    photoContainer.style.height = '200px';
    photoContainer.style.overflow = 'hidden';
    photoContainer.style.borderRadius = '4px';
    div.appendChild(photoContainer);

    await renderItemPhoto(item, photoContainer);

    const name = document.createElement('div');
    name.className = 'cstm-costume-name';
    name.innerHTML = `<strong>${item.name}</strong><br>
                      Taille: ${item.size || '-'}<br>
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
 * Combine fetch + render
 */
async function fetchItemsAndRender() {
  await fetchItems();
  await renderItems();
}

/**
 * Chargement initial des données
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
    await renderItems();
  } catch (err) {
    console.error('[Collection] Erreur :', formatServerError(err.message || err));
  }
}

/**
 * Initialisation après injection HTML
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

  lookupInput?.addEventListener('input', async () => {
    await renderItems();
  });

  await loadData();
}

/**
 * Afficher une image (URL ou Instagram)
 */
async function displayImage(container, url) {
  container.innerHTML = '';
  const placeholder = document.createElement('img');
  placeholder.src = 'https://placehold.co/70x70?text=+';
  placeholder.style.width = '100%';
  placeholder.style.height = '100%';
  placeholder.style.objectFit = 'cover';
  container.appendChild(placeholder);

  if (!url) return;

  try {
   // loadingOverlay?.classList.remove('hidden');

    if (isInstagramUrl(url)) {
      container.innerHTML = '';
      const bq = createInstagramBlockquote(url);
      bq.classList.add('photo-instagram-preview');

      const wrapper = document.createElement('div');
      wrapper.style.width = '300px';
      wrapper.style.height = '300px';
      wrapper.style.overflow = 'hidden';
      wrapper.style.margin = '0 auto';
      wrapper.style.position = 'relative';

      bq.style.width = '100%';
      bq.style.height = 'auto';
      bq.style.transform = 'scale(0.5) translateY(-55px)';
      bq.style.transformOrigin = 'center';
      wrapper.appendChild(bq);
      container.appendChild(wrapper);

      if (window.instgrm) window.instgrm.Embeds.process();
      return;
    }

    const { url: displayUrl } = await getDisplayableImageUrl(url, { client: client , withPreview: true });
    if (displayUrl) {
      container.innerHTML = '';
      const imgEl = document.createElement('img');
      imgEl.src = displayUrl;
      imgEl.style.width = '100%';
      imgEl.style.height = '100%';
      imgEl.style.objectFit = 'cover';
      container.appendChild(imgEl);

      const linkWrapper = document.createElement('a');
      linkWrapper.href = url;
      linkWrapper.target = '_blank';
      container.replaceChild(linkWrapper, imgEl);
      linkWrapper.appendChild(imgEl);
    }

  } catch (err) {
    console.error('[displayImage] Erreur :', err);
    container.innerHTML = '';
    container.appendChild(placeholder);
  } finally {
   // loadingOverlay?.classList.add('hidden');
  }
}

/**
 * Affichage d'une photo dans la collection
 */
async function renderItemPhoto(item, container) {
  container.innerHTML = '';

  const placeholder = document.createElement('img');
  placeholder.src = 'https://placehold.co/200x200?text=+';
  placeholder.style.width = '100%';
  placeholder.style.height = '100%';
  placeholder.style.objectFit = 'cover';
  container.appendChild(placeholder);

  if (!item.photos || item.photos.length === 0) return;

  let currentIndex = 0;
  let intervalId = null;

  const showPhoto = async (photo) => {
    await displayImage(container, photo.url);
  };

  await showPhoto(item.photos[currentIndex]);

  if (item.photos.length > 1) {
    container.addEventListener('mouseenter', async () => {
      intervalId = setInterval(async () => {
        currentIndex = (currentIndex + 1) % item.photos.length;
        await showPhoto(item.photos[currentIndex]);
      }, 1500);
    });

    container.addEventListener('mouseleave', async () => {
      clearInterval(intervalId);
      intervalId = null;
      currentIndex = 0;
      await showPhoto(item.photos[currentIndex]);
    });
  }
}
