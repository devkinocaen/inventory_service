import { initClient } from '../libs/client.js';
import { fetchReservables, fetchOrganizations, fetchOrganizationReferents } from '../libs/sql/index.js';
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

  // 🔹 Reset animation
  dialog.classList.remove('show');
  modal.classList.remove('hidden');

  // Force reflow pour relancer transition
  void dialog.offsetWidth;

  // Jouer l'animation
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

  for (const item of bookingItems) {
    const div = document.createElement('div');
    div.className = 'cart-item';

    const img = document.createElement('img');
    img.src = item.photos?.[0] || 'https://placehold.co/60x60?text=+';
    div.appendChild(img);

    const info = document.createElement('div');
    info.style.flex = '1'; // pour alignement correct

    const name = document.createElement('div');
    name.className = 'cart-item-name';
    name.textContent = item.name || '';

    const cat = document.createElement('div');
    cat.className = 'cart-item-cat';
    cat.textContent = item.category_name || '';

    info.appendChild(name);
    info.appendChild(cat);
    div.appendChild(info);

    itemsContainer.appendChild(div);
  }
}

// -----------------------------
// Initialisation du modal et des selects
// -----------------------------
export async function initBookingModal() {
  client = await initClient();
  await loadBookingModal();

  try {
    const [orgs, refs] = await Promise.all([
      fetchOrganizations(client),
      fetchOrganizationReferents(client)
    ]);

    const orgSelect = document.getElementById('organization');
    const refSelect = document.getElementById('referent');

    if (orgSelect) {
      orgSelect.innerHTML = ''; // 🔹 éviter doublons
      orgs.forEach(o => {
        const opt = document.createElement('option');
        opt.value = o.id;
        opt.textContent = o.name;
        orgSelect.appendChild(opt);
      });
    }

    if (refSelect) {
      refSelect.innerHTML = ''; // 🔹 éviter doublons
      refs.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.id;
        opt.textContent = r.name;
        refSelect.appendChild(opt);
      });
    }
  } catch (err) {
    console.error(
      '[Booking Modal] Erreur chargement organisations / référents :',
      formatServerError(err.message || err)
    );
  }
}
