import { initClient } from '../libs/client.js';
import {
  fetchOrganizations,
  createReservableBatch,
  upsertBookingReference,
  createBooking,
  isAvailable
} from '../libs/sql/index.js';
 
import {
    formatServerError,
    formatDateForDatetimeLocal,
    roundDateByMinute
} from '../libs/helpers.js';

import { populateSelect } from '../libs/ui/populateSelect.js';

let client;
let modal, dialog, itemsContainer, cancelBtn, validateBtn;
let orgSelect, bookingPersonSelect, startDateInput, endDateInput;
let bookingItems = [];
let organizations = [];

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
  dialog = modal.querySelector('.booking-modal-dialog');
  itemsContainer = document.getElementById('booking-items');
  cancelBtn = document.getElementById('cancel-booking-btn');
  validateBtn = document.getElementById('validate-booking-btn');

  orgSelect = document.getElementById('organization');
  bookingPersonSelect = document.getElementById('booking_person');
  startDateInput = document.getElementById('startDate');
  endDateInput = document.getElementById('endDate');

  if (cancelBtn && !cancelBtn.dataset.bound) {
    cancelBtn.addEventListener('click', closeBookingModal);
    cancelBtn.dataset.bound = 'true';
  }

  if (validateBtn && !validateBtn.dataset.bound) {
    validateBtn.addEventListener('click', handleBookingValidate);
    validateBtn.dataset.bound = 'true';
  }

  if (orgSelect && !orgSelect.dataset.bound) {
    orgSelect.addEventListener('change', updateBookingPersons);
    orgSelect.dataset.bound = 'true';
  }
}

// -----------------------------
// Ouvrir modal réservation
// -----------------------------
export async function openBookingModal(selectedItems = [], dates = {}) {
  if (!selectedItems || selectedItems.length === 0) {
    alert('Aucun article sélectionné pour la réservation.');
    return;
  }

  await initBookingModal();
  if (!modal || !dialog) return;

  bookingItems = selectedItems || [];
  renderBookingItems();

  // --------------------------
  // Initialisation date/heure
  // --------------------------
  const { start, end } = dates ?? {};

  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000);

  const startInit = start
    ? roundDateByMinute(start, 'down')
    : formatDateForDatetimeLocal(now);

  const endInit = end
    ? roundDateByMinute(end, 'up')
    : formatDateForDatetimeLocal(tomorrow);

  startDateInput.value = startInit;
  endDateInput.value = endInit;

  // --------------------------
  dialog.classList.remove('show');
  modal.classList.remove('hidden');
  void dialog.offsetWidth;
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
    organizations = await fetchOrganizations(client);

    populateSelect(orgSelect, organizations, null, {
      labelField: 'name',
      placeholder: '-- Choisir une organisation --'
    });

    updateBookingPersons();
  } catch (err) {
    console.error('[Booking Modal] Erreur chargement organisations :', formatServerError(err.message || err));
  }
}

// -----------------------------
// Met à jour le select des personnes de l’organisation
// -----------------------------
function updateBookingPersons() {
  const orgId = parseInt(orgSelect.value);
  const org = organizations.find(o => o.id === orgId);

  if (!org) {
    console.warn('[Booking Modal] Organisation introuvable pour id:', orgId);
    populateSelect(bookingPersonSelect, [], null, {
      labelField: (p) => `${p.first_name} ${p.last_name}${p.role ? ` (${p.role})` : ''}`,
      placeholder: '-- Choisir la personne de retrait --',
      disablePlaceholder: true
    });
    return;
  }

  populateSelect(bookingPersonSelect, org.persons || [], org.referent_id, {
    labelField: (p) => `${p.first_name} ${p.last_name}${p.role ? ` (${p.role})` : ''}`,
    placeholder: '-- Choisir la personne de retrait --',
    disablePlaceholder: true
  });
}

                       
// -----------------------------
// Validation réservation avec création automatique de booking_reference
// -----------------------------
async function handleBookingValidate() {
  try {
    const orgId = parseInt(orgSelect.value);
    const bookingPersonId = parseInt(bookingPersonSelect.value);
    const startDate = startDateInput.value;
    const endDate = endDateInput.value;

    if (!orgId || !bookingPersonId || !startDate || !endDate) {
      alert('Veuillez remplir toutes les informations obligatoires');
      return;
    }

    // Vérification disponibilité de chaque item
    for (const item of bookingItems) {
      const available = await isAvailable(client, item.id, startDate, endDate);
      if (!available) {
        alert(`L’article "${item.name}" n’est pas disponible sur cette période.`);
        return;
      }
    }

    // Création du batch
    const batchRes = await createReservableBatch(client, bookingItems.map(i => i.id));
    let batchId;
    if (Array.isArray(batchRes)) {
      if (!batchRes.length || !batchRes[0].id) {
        throw new Error('Batch créé invalide : aucun ID reçu');
      }
      batchId = batchRes[0].id;
    } else if (batchRes && batchRes.id) {
      batchId = batchRes.id;
    } else {
      throw new Error('Batch créé invalide : aucun ID reçu');
    }

    console.log('[Booking Modal] Batch créé avec ID :', batchId);

    // Création ou récupération de la booking reference via la lib
    const bookingReference = await upsertBookingReference(client, {
      name: 'LOCATION',
      description: ''
    });
    const bookingReferenceId = bookingReference.id;

    console.log('[Booking Modal] Booking reference ID :', bookingReferenceId);

    // Détermine le pickupPerson : si "immediate checkout" coché, c'est bookingPerson
    const immediateCheckout = document.getElementById('immediate_checkout')?.checked ?? false;
    const pickupPersonId = immediateCheckout ? bookingPersonId : null;

    // Création de la réservation
    const booking = await createBooking(client, {
      p_reservable_batch_id: batchId,
      p_renter_organization_id: orgId,
      p_booking_person_id: bookingPersonId,
      p_start_date: startDate,
      p_end_date: endDate,
      p_pickup_person_id: pickupPersonId,
      p_booking_reference_id: bookingReferenceId
    });

    console.log('[Booking Modal] Réservation créée :', booking);

    alert('Réservation créée avec succès !');
    closeBookingModal();

  } catch (err) {
    console.error('[Booking Modal] Erreur création réservation :', err);
    alert(`Erreur : ${formatServerError(err.message || err)}`);
  }
}
