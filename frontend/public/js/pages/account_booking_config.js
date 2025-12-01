import { fetchBookings, deleteBooking } from '../libs/sql/index.js';
import { initClient } from '../libs/client.js';
import { openBatchModal } from '../modals/batch_modal.js';
import { formatServerError, formatDateTime, escapeHtml } from '../libs/helpers.js';

let client;
let currentBookings = [];


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
    const startDate = formatDateTime(b.start_date);
    const endDate = formatDateTime(b.end_date);
    const bookedAt = formatDateTime(b.booked_at);
    const bookingPersonName =  b.booking_person_name;
 
    // Carrousel des items : max 5
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
                <img src="${escapeHtml(photos[0].url)}" alt="${escapeHtml(r.name || '')}" data-photos='${JSON.stringify(photos)}'>
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

    // Hover pour faire défiler les images
    card.querySelectorAll('.booking-item img').forEach(imgEl => {
      let idx = 0, interval;
      const photos = JSON.parse(imgEl.dataset.photos || '[]');

      imgEl.addEventListener('mouseenter', () => {
        if (photos.length <= 1) return;
        interval = setInterval(() => {
          idx = (idx + 1) % photos.length;
          imgEl.src = photos[idx].url;
        }, 1000);
      });
      imgEl.addEventListener('mouseleave', () => {
        clearInterval(interval);
        idx = 0;
        imgEl.src = photos[0]?.url || imgEl.src;
      });
    });

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
