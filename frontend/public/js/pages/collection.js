// js/pages/collection.js
import {
    fetchReservables,
    fetchCategories,
    fetchColors,
    fetchSubcategories,
    fetchStyles,
    fetchAppConfig
} from '../libs/sql/index.js';

import { initClient } from '../libs/client.js';
import { openBookingModal } from '../modals/booking_modal.js';
import { openOrgModal } from '../modals/org_modal.js';
import { formatServerError, formatDateForDatetimeLocal } from '../libs/helpers.js';

import { displayImage } from '../libs/image_utils.js';

let client;
let appConfig = null;

let currentItems = [];
let selectedItems = [];
let activeFilters = { category: [], subcategory: [], style: [], gender: [], color: [] };
let currentFilterStart = null;
let currentFilterEnd = null;

// Variables globales pour les données de filtre
let currentCategories = [];
let currentSubcategories = [];
let currentStyles = [];
let currentColors = []; // variable globale

const genderMap = {
  'Homme': 'male',
  'Femme': 'female',
  'Unisexe': 'unisex'
};

// Inverser le mapping pour affichage
const genderLabelMap = Object.fromEntries(
  Object.entries(genderMap).map(([label, key]) => [key, label])
);


function normalize(str) {
  return str
    .normalize("NFD")               // décompose les accents
    .replace(/[\u0300-\u036f]/g, "") // supprime les diacritiques
    .toLowerCase();
}

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
    
    // Si c'est une catégorie qui change, on reset les sous-catégories
    if (type === 'category') {
      activeFilters.subcategory = [];
    }
  }
}


// Fonction utilitaire pour déterminer si une couleur est sombre ou claire
function isColorDark(hex) {
  // enlever le # si présent
  hex = hex.replace('#', '');
  const r = parseInt(hex.substring(0,2), 16);
  const g = parseInt(hex.substring(2,4), 16);
  const b = parseInt(hex.substring(4,6), 16);
  // luminance relative
  const luminance = 0.299*r + 0.587*g + 0.114*b;
  return luminance < 186; // seuil à ajuster si nécessaire
}


function renderFilterChips(categories, subcategories, styles, colors) {
  const categoryChips = document.getElementById('cstm-categoryChips');
  const subcatChips = document.getElementById('cstm-subcatChips');
  const styleChips = document.getElementById('cstm-styleChips');
  const genderChips = document.getElementById('cstm-genderChips');
  const colorChips = document.getElementById('cstm-colorChips');
  if (!categoryChips || !subcatChips || !styleChips || !genderChips || !colorChips) return;

  const makeChip = (name, type, colorHex=null) => {
    const chip = document.createElement('div');
    chip.textContent = name;
    if (type == 'color') {
      chip.className = 'color-chip' + (activeFilters[type].includes(name) ? ' selected' : '');
          
      if (colorHex) {
        chip.style.backgroundColor = colorHex;
        chip.style.color = isColorDark(colorHex) ? 'white' : 'black';
        chip.style.border = '1px solid #ccc';
      }
    } else {
       chip.className = 'filter-chip' + (activeFilters[type].includes(name) ? ' selected' : '');
    }


    chip.onclick = () => {
      toggleFilter(type, name);              // met à jour activeFilters
      renderFilterChips(currentCategories, currentSubcategories, currentStyles, currentColors); // rerender
      fetchItemsAndRender();
    };

    return chip;
  };

  // ---- catégories, sous-catégories, styles, genres (inchangés) ----
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

  // ---- chips couleurs ----
  colorChips.innerHTML = '';
  let row = document.createElement('div');
  row.className = 'chip-row';
  colors.forEach((c, idx) => {
    row.appendChild(makeChip(c.name, 'color', c.hex_code));
    if ((idx+1) % 3 === 0) {
      colorChips.appendChild(row);
      row = document.createElement('div');
      row.className = 'chip-row';
    }
  });
  if (row.children.length > 0) colorChips.appendChild(row);
}


/**
 * Fetch les items depuis la base SQL selon les filtres sidebar
 */
async function fetchItems() {
    let filterStartDate = currentFilterStart ? formatDateForDatetimeLocal(currentFilterStart) : null;
    let filterEndDate   = currentFilterEnd   ? formatDateForDatetimeLocal(currentFilterEnd)   : null;
    
    
  if (filterStartDate && filterEndDate && new Date(filterStartDate) >= new Date(filterEndDate)) {
    alert('La date de fin doit être après la date de début');
    filterStartDate = null;
    filterEndDate = null;
  }
console.log ('activeFilters', activeFilters)
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
      p_color_ids: activeFilters.color.length
        ? currentColors
            .filter(c => activeFilters.color.includes(c.name))
            .map(c => c.id)
        : null,

    p_gender: activeFilters.gender.length
      ? activeFilters.gender.map(g => genderMap[g])
      : null,
    p_start_date: filterStartDate,
    p_end_date: filterEndDate,
    p_privacy_min: 'private',
    p_status_ids: ['disponible']
  };

  try {
      console.log ('filters', filters)
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
  ? itemsToRender.filter(i =>
      normalize(i.name).includes(normalize(lookupValue))
    )
  : itemsToRender;

  for (const item of filteredItems) {
    const div = document.createElement('div');
    div.className = 'cstm-costume-card' + (selectedItems.includes(item.id) ? ' selected' : '');
    div.addEventListener('dblclick', () => openZoom(item));

      
    // Ajouter classe indisponible
    const isUnavailable = item.status !== 'disponible';
    if (isUnavailable) div.classList.add('unavailable');

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
                      ${appConfig.show_prices
                      ? `Prix/jour: ${item.price_per_day ? item.price_per_day + ' €' : '-'}`
                      : ''}                      ${isUnavailable ? `<br><small style="color:red;">${item.status}</small>` : ''}`;
    div.appendChild(name);

    // Click uniquement si disponible
    if (!isUnavailable) {
      div.addEventListener('click', () => {
        if (selectedItems.includes(item.id)) {
          selectedItems = selectedItems.filter(i => i !== item.id);
          div.classList.remove('selected');
        } else {
          selectedItems.push(item.id);
          div.classList.add('selected');
        }
          updateCartCount();

      });
    }

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
    const [items, categories, subcategories, styles, colors] = await Promise.all([
      fetchReservables(client, {p_privacy_min: 'private', p_status_ids: ['disponible']}),
      fetchCategories(client),
      fetchSubcategories(client),
      fetchStyles(client),
      fetchColors(client)
    ]);

    currentItems = items;
    currentCategories = categories;
    currentSubcategories = subcategories;
    currentStyles = styles;
    currentColors = colors;

    // <-- passer colors à renderFilterChips
    renderFilterChips(categories, subcategories, styles, colors);
    await renderItems();
  } catch (err) {
    const errMsg = formatServerError(err.message || err);
    console.error('[Collection] Erreur :', errMsg);
    alert(`❌ Erreur : ${errMsg}`);
  }
}


/**
 * Initialisation après injection HTML
 */
export async function init() {
  client = await initClient();
    
  appConfig = await fetchAppConfig(client);

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
        console.log ('item', item)
      return item ? {
        id: item.id,
        name: item.name,
        price_per_day: item.price_per_day,
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
  updateCartCount();
    
    // -----------------------------
     // Rendre les sections filtres repliables
     // -----------------------------
     const collapsibleSections = document.querySelectorAll('#cstm-filtersSidebar .filter-section');

     collapsibleSections.forEach(section => {
       section.classList.add('cstm-filter-collapsible');
       
       const titleDiv = section.querySelector('div:first-child');
       
       titleDiv.addEventListener('click', () => {
         section.classList.toggle('collapsed');
       });
     });
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
    await displayImage(client, container, photo.url);
  };

  await showPhoto(item.photos[currentIndex]);

  if (item.photos.length > 1) {
    // Supprime d'abord les anciens listeners pour éviter l'empilement
    container.onmouseenter = null;
    container.onmouseleave = null;

    container.addEventListener('mouseenter', () => {
      if (intervalId) clearInterval(intervalId);
      intervalId = setInterval(async () => {
        currentIndex = (currentIndex + 1) % item.photos.length;
        await showPhoto(item.photos[currentIndex]);
      }, 1500);
    });

    container.addEventListener('mouseleave', async () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      currentIndex = 0;
      await showPhoto(item.photos[currentIndex]);
    });
  }
}


/***********************************
 * ZOOM DETAILLE D’UN ITEM
 ***********************************/
let zoomOverlay = null;

// Listener global ESC (déclaré ici pour pouvoir remove)
function handleEscClose(e) {
  if (e.key === 'Escape') {
    closeZoom();
  }
}

function closeZoom() {
  if (zoomOverlay) {
    zoomOverlay.remove();
    zoomOverlay = null;
    document.body.style.overflow = '';
  }

  // Supprimer l’écouteur ESC
  document.removeEventListener('keydown', handleEscClose);
}

async function openZoom(item) {
  // Fermer tout overlay existant avant d’en ouvrir un nouveau
  closeZoom();
    console.log ('item', item)

  document.body.style.overflow = 'hidden';

  zoomOverlay = document.createElement('div');
  zoomOverlay.className = 'zoom-overlay';

  const content = document.createElement('div');
  content.className = 'zoom-content';

  /**************************
   * Bouton fermer
   **************************/
  const closeBtn = document.createElement('div');
  closeBtn.className = 'zoom-close-btn';
  closeBtn.innerHTML = '&times;';
  closeBtn.onclick = closeZoom;
  content.appendChild(closeBtn);

  /**************************
   * Titre
   **************************/
  const title = document.createElement('h2');
  title.textContent = item.name;
  content.appendChild(title);

    /**************************
     * CARROUSEL
     **************************/
    const carousel = document.createElement('div');
    carousel.className = 'zoom-carousel';

    if (item.photos?.length) {
      for (const [index, photo] of item.photos.entries()) {
        const cell = document.createElement('div');
        cell.className = 'zoom-carousel-cell';

        await displayImage(client, cell, photo.url); // OK car dans for...of

        cell.addEventListener('click', () => openImageZoom(item, index));

        carousel.appendChild(cell);
      }
    } else {
      const noPhoto = document.createElement('div');
      noPhoto.className = 'no-photo';
      noPhoto.textContent = 'Aucune photo disponible';
      carousel.appendChild(noPhoto);
    }

    content.appendChild(carousel);

  /**************************
   * INFOS EN 3 COLONNES
   **************************/
  const infoData = [
    { label: 'Taille', value: item.size || '-' },
    { label: 'Catégorie', value: item.category_name || '-' },
    { label: 'État', value: item.quality },
    { label: 'Genre', value: genderLabelMap[item.gender] || '-' },
    { label: 'Sous-catégorie', value: item.subcategory_name || '-' },
    { label: 'Description', value: item.description },
    { label: 'En magasin', value: item.is_in_stock? 'Oui':'Non' },
    { label: 'Style', value: (item.style_names?.length ? item.style_names.join(', ') : '-') },
  ];

  if (appConfig.show_prices) {
    infoData.push({
      label: 'Prix/jour',
      value: item.price_per_day ? item.price_per_day + ' €' : '-'
    });
  }

  const infoGrid = document.createElement('div');
  infoGrid.className = 'zoom-info-grid';

  for (const info of infoData) {
    const p = document.createElement('p');
    p.innerHTML = `<strong>${info.label} :</strong> ${info.value}`;
    infoGrid.appendChild(p);
  }

  content.appendChild(infoGrid);

  /**************************
   * Finalisation overlay
   **************************/
  zoomOverlay.appendChild(content);
  document.body.appendChild(zoomOverlay);

  // Clic extérieur → fermeture
  zoomOverlay.addEventListener('click', (e) => {
    if (e.target === zoomOverlay) closeZoom();
  });

  // Activation écouteur ESC
  document.addEventListener('keydown', handleEscClose);
}


/***********************************
 * IMAGE ZOOM (800px)
 ***********************************/
let imgZoomOverlay = null;
let imgZoomCurrentIndex = 0;
let imgZoomCurrentItem = null;


function closeImageZoom() {
  if (imgZoomOverlay) {
    imgZoomOverlay.remove();
    imgZoomOverlay = null;
    imgZoomCurrentIndex = 0;
    imgZoomCurrentItem = null;
  }
  document.removeEventListener('keydown', handleEscImgZoom);
  document.removeEventListener('keydown', handleArrowImgZoom);
}

function handleEscImgZoom(e) {
  if (e.key === 'Escape') closeImageZoom();
}

function handleArrowImgZoom(e) {
  if (!imgZoomCurrentItem?.photos?.length) return;

  const len = imgZoomCurrentItem.photos.length;

  if (e.key === 'ArrowLeft') {
    imgZoomCurrentIndex = (imgZoomCurrentIndex - 1 + len) % len;
    updateImgZoom();
  } else if (e.key === 'ArrowRight') {
    imgZoomCurrentIndex = (imgZoomCurrentIndex + 1) % len;
    updateImgZoom();
  }
}

async function updateImgZoom() {
  if (!imgZoomOverlay || !imgZoomCurrentItem?.photos) return;

  const photo = imgZoomCurrentItem.photos[imgZoomCurrentIndex];
  const wrapper = imgZoomOverlay.querySelector('.imgzoom-wrapper');

  if (!wrapper) return;

  // On délègue l'affichage à displayImage
  await displayImage(client, wrapper, photo.url, { width: '800px', withPreview: false });
}


function openImageZoom(item, startIndex = 0) {
  if (!item?.photos?.length) return;

  closeImageZoom();

  imgZoomCurrentItem = item;
  imgZoomCurrentIndex = startIndex;

  imgZoomOverlay = document.createElement('div');
  imgZoomOverlay.className = 'imgzoom-overlay';

  const wrapper = document.createElement('div');
  wrapper.className = 'imgzoom-wrapper';
  wrapper.style.width = '800px';
  wrapper.style.height = 'auto';
  wrapper.style.margin = '0 auto';

  imgZoomOverlay.appendChild(wrapper);
  document.body.appendChild(imgZoomOverlay);

  updateImgZoom(); // affichage de la première image via displayImage

  // clic à l’extérieur → fermer
  imgZoomOverlay.addEventListener('click', (e) => {
    if (e.target === imgZoomOverlay) closeImageZoom();
  });

  document.addEventListener('keydown', handleEscImgZoom);
  document.addEventListener('keydown', handleArrowImgZoom);
}


function updateCartCount() {
  if (!cartToggle) return;

  const count = selectedItems.length;

  if (count === 0) {
    cartToggle.textContent = '🛒';
    cartToggle.classList.add('disabled');
    cartToggle.style.pointerEvents = 'none';
    cartToggle.style.opacity = '0.5';
  } else {
    cartToggle.textContent = `🛒 (${count})`;
    cartToggle.classList.remove('disabled');
    cartToggle.style.pointerEvents = 'auto';
    cartToggle.style.opacity = '1';
  }
}
