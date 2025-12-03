import { initClient } from '../libs/client.js';

import {
    fetchBookings,
    deleteBooking,
    fetchOrganizationsByPersonId
} from '../libs/sql/index.js';


import {
    formatServerError,
    formatDateTime,
    escapeHtml
} from '../libs/helpers.js';

import {
    getDisplayableImageUrl,
    isInstagramUrl,
    createInstagramBlockquote,
    displayImage
} from '../libs/image_utils.js';

import { openBatchModal } from '../modals/batch_modal.js';

let client;
let currentBookings = [];
let currentFilters = {};

// ---------------- Hover pour faire défiler les images ----------------
function setupBookingItemHover(photoContainer, photos) {
  let idx = 0;
  let intervalId = null;

  const showPhoto = () => {
    displayImage(client, photoContainer, photos[idx].url, { width: '80px' });
  };

  showPhoto();

  if (photos.length > 1) {
    photoContainer.onmouseenter = () => {
      if (intervalId) clearInterval(intervalId);
      intervalId = setInterval(() => {
        idx = (idx + 1) % photos.length;
        showPhoto();
      }, 1500);
    };

    photoContainer.onmouseleave = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      idx = 0;
      showPhoto();
    };
  }
}

// ---------------- Render bookings ----------------
export async function renderBookings(bookings) {
  const container = document.getElementById('bookingList');
  if (!container) return;

  container.innerHTML = '';
  currentBookings = bookings || [];

  for (const b of currentBookings) {
    const card = document.createElement('div');
    card.className = 'booking-card';
 
    const lotName = b.batch_description?.trim() || `Lot #${b.reservable_batch_id ?? b.booking_id ?? 'N/A'}`;
    const bookingPersonName = b.booking_person_name;
    const renterName = b.renter_name;
    const startDate = formatDateTime(b.start_date);
    const endDate = formatDateTime(b.end_date);
    const bookedAt = formatDateTime(b.booked_at);

    // Carrousel des items : max 10
    const items = Array.isArray(b.reservables) ? b.reservables.slice(0, 10) : [];
    const itemsHtml = items.length
      ? `<div class="booking-items-container">
          ${items.map(r => {
            const photos = Array.isArray(r.photos) && r.photos.length ? r.photos : [{
              url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
                `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80">
                   <rect width="80" height="80" fill="#ddd"/>
                   <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#888" font-size="12">No Image</text>
                 </svg>`
              )
            }];
            return `
              <div class="booking-item">
                <div class="booking-item-photo" style="width:80px; height:80px; overflow:hidden;"
                     data-photos='${JSON.stringify(photos)}'></div>
                <span>${escapeHtml(r.name || '')}</span>
              </div>
            `;
          }).join('')}
        </div>`
      : '<div>Aucun objet</div>';

    card.innerHTML = `
      <div class="booking-info">
        <div class="batch-name">${escapeHtml(lotName)}</div>
        ${itemsHtml}
      </div>

      <div class="booking-reserved">
        <div>Réservé par : ${escapeHtml(bookingPersonName)}</div>
        <div>pour : ${escapeHtml(renterName)}</div>
        <div>Le : ${escapeHtml(bookedAt)}</div>
      </div>

      <div class="booking-right">
        <div class="booking-dates">Du ${escapeHtml(startDate)} au ${escapeHtml(endDate)}</div>
        <div class="booking-actions">
          <button class="btn-details" data-id="${b.booking_id}">Voir détails</button>
          <button class="btn-delete" data-id="${b.booking_id}">Supprimer</button>
        </div>
      </div>
    `;

    // Initialisation du hover sur chaque photo
    card.querySelectorAll('.booking-item-photo').forEach(photoContainer => {
      const photos = JSON.parse(photoContainer.dataset.photos || '[]');
      if (photos.length) setupBookingItemHover(photoContainer, photos);
    });

    // Boutons détails et suppression
    card.querySelector('.btn-details')?.addEventListener('click', (e) => {
      const id = Number(e.currentTarget.dataset.id);
      if (id) openBatchModal(id, () => refreshBookings(), 'viewer');
    });

    card.querySelector('.btn-delete')?.addEventListener('click', async (e) => {
      const id = Number(e.currentTarget.dataset.id);
      if (!id) return;
      if (!confirm(`Supprimer la réservation #${id} ?`)) return;
      try {
        await deleteBooking(client, id);
        currentBookings = currentBookings.filter(bk => bk.booking_id !== id);
        await renderBookings(currentBookings);
      } catch (err) {
        alert('Erreur suppression: ' + formatServerError(err));
      }
    });

    container.appendChild(card);
  }
}

// ---------------- Refresh ----------------
export async function refreshBookings(filters = {}) {
  try {
    // Combiner filtres courants et filtres passés en paramètre
    const mergedFilters = { ...currentFilters, ...filters };
    const bookings = await fetchBookings(client, mergedFilters);
    await renderBookings(bookings);
  } catch (err) {
    console.error('Erreur fetchBookings:', formatServerError(err));
  }
}

// ---------------- Init ----------------
export async function init() {
  try {
    client = await initClient();

    let orgIds = null;
    try {
      const logged = JSON.parse(localStorage.getItem("loggedUser") || "{}");
        if (logged.role == 'viewer' && logged.personId == null) {
            alert('utilisateur incoonu');
            return;
        }
      if (logged.personId) {
        const organizations = await fetchOrganizationsByPersonId(client, logged.personId);

        // Extraire les IDs en tableau
        orgIds = organizations.map(o => o.id);
      }
    } catch (err) {
        console.warn("Impossible de lire loggedUser ou fetchOrganizationsByPersonId a échoué", err);
        alert("Erreur : " + formatServerError(err.message));
        return;
    }

    // Définir les filtres courants
    currentFilters = {
      p_organization_ids: orgIds?.length ? orgIds : null
    };

    // Charger les bookings avec filtres par défaut
    await refreshBookings(currentFilters);

  } catch (err) {
    console.error('Erreur init:', formatServerError(err));
  }
}
