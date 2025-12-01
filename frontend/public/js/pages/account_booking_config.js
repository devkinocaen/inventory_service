import { fetchBookings, deleteBooking } from '../libs/sql/index.js';
import { initClient } from '../libs/client.js';
import { openBatchModal } from '../modals/batch_modal.js';
import { formatServerError, formatDateTime } from '../libs/helpers.js';

let client;
let currentBookings = [];

/* ---------------- Helpers ---------------- */
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatDateForDisplay(d) {
  if (!d) return '';
  try {
    return formatDateTime ? formatDateTime(d) : new Date(d).toLocaleString();
  } catch {
    return String(d);
  }
}

/* ---------------- Render bookings ---------------- */
export async function renderBookings(bookings) {
  const container = document.getElementById('bookingList');
  if (!container) return;

  container.innerHTML = '';
  currentBookings = bookings || [];

  for (const b of currentBookings) {
    const card = document.createElement('div');
    card.className = 'booking-card';

    const lotName = b.batch_description?.trim() || `Lot #${b.reservable_batch_id ?? b.booking_id ?? 'N/A'}`;
    const orgName = b.renter_name || '—';
    const startDate = formatDateForDisplay(b.start_date);
    const endDate = formatDateForDisplay(b.end_date);

    // Carrousel des items
    const itemsHtml = (Array.isArray(b.reservables) && b.reservables.length)
      ? `<div class="booking-items-container">
          ${b.reservables.map(r => `
            <div class="booking-item">
              <img src="${escapeHtml(r.photo || '')}" alt="${escapeHtml(r.name || '')}">
              <span>${escapeHtml(r.name || '')}</span>
            </div>
          `).join('')}
        </div>`
      : '<div>Aucun objet</div>';

    card.innerHTML = `
      <div class="booking-header">${escapeHtml(lotName)}</div>
      <div>du ${escapeHtml(startDate)}</div>
      <div>au ${escapeHtml(endDate)}</div>
      ${itemsHtml}
      <div class="booking-actions">
        <button class="btn-details" data-id="${b.booking_id}">Voir détails</button>
        <button class="btn-delete" data-id="${b.booking_id}">Supprimer</button>
      </div>
    `;

    // Events
    card.querySelector('.btn-details')?.addEventListener('click', (e) => {
      const id = Number(e.currentTarget.dataset.id);
      if (id) openBatchModal(id, () => refreshBookings());
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

/* ---------------- Refresh ---------------- */
export async function refreshBookings(filters = {}) {
  try {
    const bookings = await fetchBookings(client, filters);
    await renderBookings(bookings);
  } catch (err) {
    console.error('Erreur fetchBookings:', formatServerError(err));
  }
}

/* ---------------- Init ---------------- */
export async function init() {
  try {
    client = await initClient();
    await refreshBookings();
  } catch (err) {
    console.error('Erreur init:', formatServerError(err));
  }
}
