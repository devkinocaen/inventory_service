import { initClient } from '../libs/client.js';

import {
  fetchBookings,
  cancelBooking, // RPC : status = 'annulé'
  fetchOrganizationsByPersonId
} from '../libs/sql/index.js';

import {
  formatServerError,
  formatDateTime,
  escapeHtml
} from '../libs/helpers.js';

import { displayImage } from '../libs/image_utils.js';
import { openBatchModal } from '../modals/batch_modal.js';

let client;
let currentBookings = [];
let currentFilters = {};

// ---------------- Hover photos ----------------
function setupBookingItemHover(photoContainer, photos) {
  let idx = 0;
  let intervalId = null;

  const showPhoto = () => {
    displayImage(client, photoContainer, photos[idx].url, {
      width: '80px',
      withPreview: true
    });
  };

  showPhoto();

  if (photos.length > 1) {
    photoContainer.onmouseenter = () => {
      intervalId = setInterval(() => {
        idx = (idx + 1) % photos.length;
        showPhoto();
      }, 1500);
    };

    photoContainer.onmouseleave = () => {
      clearInterval(intervalId);
      intervalId = null;
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

    // 🎨 statut annulé → style spécifique
    if (b.status === 'annulé') {
      card.classList.add('booking-cancelled');
    }

    const lotName =
      b.batch_description?.trim() ||
      `Lot #${b.reservable_batch_id ?? b.booking_id ?? 'N/A'}`;

    const startDate = formatDateTime(b.start_date);
    const endDate = formatDateTime(b.end_date);
    const bookedAt = formatDateTime(b.booked_at);

    const items = Array.isArray(b.reservables)
      ? b.reservables.slice(0, 10)
      : [];

    const itemsHtml = items.length
      ? `<div class="booking-items-container">
          ${items
            .map(r => {
              const photos =
                Array.isArray(r.photos) && r.photos.length
                  ? r.photos
                  : [
                      {
                        url:
                          'data:image/svg+xml;charset=UTF-8,' +
                          encodeURIComponent(
                            `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80">
                              <rect width="80" height="80" fill="#ddd"/>
                              <text x="50%" y="50%" dominant-baseline="middle"
                                text-anchor="middle" fill="#888" font-size="12">
                                No Image
                              </text>
                            </svg>`
                          )
                      }
                    ];

              return `
                <div class="booking-item">
                  <div class="booking-item-photo"
                       data-photos='${JSON.stringify(photos)}'></div>
                  <span>${escapeHtml(r.name || '')}</span>
                </div>
              `;
            })
            .join('')}
        </div>`
      : '<div>Aucun objet</div>';

    // ---------------- Actions ----------------
    const actions = [
      `<button class="btn-details" data-id="${b.booking_id}">
        Voir détails
      </button>`
    ];

    // ✅ Annulation uniquement si "à valider"
    if (b.status === 'à valider') {
      actions.push(
        `<button class="btn-cancel" data-id="${b.booking_id}">
          Annuler
        </button>`
      );
    }

    card.innerHTML = `
      <div class="booking-info">
        <div class="batch-name">${escapeHtml(lotName)}</div>
        ${itemsHtml}
      </div>

      <div class="booking-reserved">
        <div>Réservé par : ${escapeHtml(b.booking_person_name || '')}</div>
        <div>Pour : ${escapeHtml(b.renter_name || '')}</div>
        <div>Le : ${escapeHtml(bookedAt)}</div>
      </div>

      <div class="booking-right">
        <div class="booking-dates">
          Du ${escapeHtml(startDate)} au ${escapeHtml(endDate)}
        </div>
        <div class="booking-status">
          Statut : ${escapeHtml(b.status)}
        </div>
        <div class="booking-actions">
          ${actions.join('')}
        </div>
      </div>
    `;

    // ---------------- Photos hover ----------------
    card.querySelectorAll('.booking-item-photo').forEach(photoContainer => {
      const photos = JSON.parse(photoContainer.dataset.photos || '[]');
      if (photos.length) setupBookingItemHover(photoContainer, photos);
    });

    // ---------------- Détails ----------------
    card.querySelector('.btn-details')?.addEventListener('click', e => {
      const id = Number(e.currentTarget.dataset.id);
      if (id) openBatchModal(id, refreshBookings, 'viewer');
    });

    // ---------------- Annulation ----------------
    card.querySelector('.btn-cancel')?.addEventListener('click', async e => {
      const id = Number(e.currentTarget.dataset.id);
      if (!id) return;

      if (!confirm(`Annuler la réservation #${id} ?`)) return;

      try {
        await cancelBooking(client, id);
        await refreshBookings();
      } catch (err) {
        alert('Erreur annulation : ' + formatServerError(err));
      }
    });

    container.appendChild(card);
  }
}

// ---------------- Refresh ----------------
export async function refreshBookings(filters = {}) {
  try {
    const merged = { ...currentFilters, ...filters };
    const bookings = await fetchBookings(client, merged);
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
    const logged = JSON.parse(localStorage.getItem('loggedUser') || '{}');

    if (logged.role === 'viewer' && !logged.personId) {
      alert('Utilisateur inconnu');
      return;
    }

    if (logged.personId) {
      const orgs = await fetchOrganizationsByPersonId(client, logged.personId);
      orgIds = orgs.map(o => o.id);
    }

    currentFilters = {
      p_organization_ids: orgIds?.length ? orgIds : null
    };

    await refreshBookings();
  } catch (err) {
    console.error('Erreur init:', formatServerError(err));
  }
}
