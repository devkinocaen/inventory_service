import { initClient } from '../libs/client.js';
import {
  fetchReservables,
  fetchOrganizations,
} from '../libs/sql/index.js';
import { formatServerError } from '../libs/helpers.js';

let client;
let modal, dialog, itemsContainer, cancelBtn, validateBtn;
let bookingItems = [];


// -----------------------------
// Charger modal dans le DOM
// -----------------------------
export async function loadBookingModal() {
  if (!document.getElementById('booking-modal')) {
    const response = await fetch(`${window.ENV.BASE_PATH}/pages/booking_modal.html`);
    if (!response.ok) throw new Error('Impossible de charger le modal booking');
    const html = await response.text();
    const div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div);
  }

  modal = document.getElementById('booking-modal');
  if (!modal) return;

  dialog = modal.querySelector('.booking-modal-dialog');
  itemsContainer = document.getElementById('booking-items');
  cancelBtn = document.getElementById('cancel-booking-btn');
  validateBtn = document.getElementById('validate-booking-btn');

  if (cancelBtn && !cancelBtn.dataset.bound) {
    cancelBtn.addEventListener('click', closeBookingModal);
    cancelBtn.dataset.bound = 'true';
  }
}

// -----------------------------
// Ouvrir modal réservation
// -----------------------------
export async function openBookingModal(selectedItems = []) {
  await loadBookingModal();
  if (!modal || !dialog) return;

  bookingItems = selectedItems || [];
  renderBookingItems();

  dialog.classList.remove('show');
  modal.classList.remove('hidden');
  void dialog.offsetWidth; // reset animation
  dialog.classList.add('show');
}

// -----------------------------
// Fermer modal réservation
// -----------------------------
export function closeBookingModal() {
  if (!modal || !dialog) return;
  dialog.classList.remove('show');
  modal.classList.add('hidden');
}

// -----------------------------
// Afficher les items sélectionnés
// -----------------------------
export function renderBookingItems() {
  if (!itemsContainer) return;
  itemsContainer.innerHTML = '';
  bookingItems.forEach(item => {
    const div = document.createElement('div');
    div.className = 'cart-item';

    const img = document.createElement('img');
    img.src = item.photos?.[0]?.url || 'data:image/svg+xml;charset=UTF-8,' +
      encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60">
        <rect width="60" height="60" fill="#ddd"/>
        <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#888" font-size="10">No Image</text>
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

    const info = document.createElement('div');
    info.style.flex = '1';
    const name = document.createElement('div');
    name.className = 'cart-item-name';
    name.textContent = item.name || '';
    const cat = document.createElement('div');
    cat.className = 'cart-item-cat';
    cat.textContent = item.category_name || '';
    info.appendChild(name);
    info.appendChild(cat);

    div.appendChild(img);
    div.appendChild(info);
    itemsContainer.appendChild(div);
  });
}

// -----------------------------
// Initialisation du modal
// -----------------------------
export async function initBookingModal() {
  client = await initClient();
  await loadBookingModal();

  try {
    const [orgs ] = await Promise.all([
      fetchOrganizations(client),
    ]);

    const orgSelect = document.getElementById('organization');

    if (orgSelect) {
      orgSelect.innerHTML = '';
      orgs.forEach(o => {
        const opt = document.createElement('option');
        opt.value = o.id;
        opt.textContent = o.name;
        orgSelect.appendChild(opt);
      });
    }

  } catch (err) {
    console.error('[Booking Modal] Erreur chargement organisations :', formatServerError(err.message || err));
  }
}


