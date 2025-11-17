// booking.js
import {
  fetchBookings,
  createBooking,
  updateBooking,
  deleteBooking
} from '../libs/sql/index.js';

import { formatServerError, formatDateTime } from '../libs/helpers.js';
import { initClient } from '../libs/client.js';

// -----------------------------
// Client & état
// -----------------------------
const client = await initClient();
let currentBookings = []; // liste locale des bookings affichés

// -----------------------------
// Helpers d'affichage
// -----------------------------
function safeText(v) {
  if (v === null || v === undefined) return '';
  return String(v);
}

function formatDateForCell(d) {
  if (!d) return '';
  try {
    // si c'est déjà une string ISO, on la convertit proprement
    return formatDateTime ? formatDateTime(d) : new Date(d).toLocaleString();
  } catch (e) {
    return String(d);
  }
}

// -----------------------------
// Rendu du tableau des réservations
// -----------------------------
function renderBookingTable(bookings) {
  const tbody = document.querySelector('#bookings_table tbody');
  if (!tbody) return;

  tbody.innerHTML = '';
  currentBookings = bookings || [];

  bookings.forEach(b => {
    const tr = document.createElement('tr');

    // Nom du lot avec fallback "Lot #ID"
    const lotName = b.batch_description && b.batch_description.trim()
      ? b.batch_description
      : `Lot #${b.reservable_batch_id ?? b.booking_id ?? 'N/A'}`;

    const orgName = b.renter_name || '—';
    const startDate = formatDateForCell(b.start_date);
    const endDate = formatDateForCell(b.end_date);

    // Liste des noms d'objets réservés
    const itemsList = (Array.isArray(b.reservables) && b.reservables.length)
      ? b.reservables.map(r => r.name || r.label || '').filter(Boolean).join(', ')
      : '';

    tr.innerHTML = `
      <td class="lot" data-id="${b.reservable_batch_id}">${escapeHtml(lotName)}</td>
      <td class="org" data-id="${b.renter_organization_id ?? ''}">${escapeHtml(orgName)}</td>
      <td class="start" data-id="${b.booking_id}">${escapeHtml(startDate)}</td>
      <td class="end" data-id="${b.booking_id}">${escapeHtml(endDate)}</td>
      <td class="items" data-id="${b.booking_id}">${escapeHtml(itemsList)}</td>
      <td><button class="btn-edit booking-btn" data-id="${b.booking_id}">Éditer</button></td>
      <td><button class="btn-delete booking-btn" data-id="${b.booking_id}">Supprimer</button></td>

    `;

    tbody.appendChild(tr);
  });

  // Après rendu : init events and utilities
  initBookingRowButtons();
  initSortableColumns('#bookings_table');
  setupBookingLookupFilter();
}

// basic html-escape to avoid injection in inserted html
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// -----------------------------
// Filtrage (lookup) : recherche sur lot, organisation, items
// -----------------------------
function setupBookingLookupFilter() {
  const input = document.getElementById('lookup_booking');
  const table = document.getElementById('bookings_table');
  const tbody = table?.querySelector('tbody');
  if (!input || !tbody) return;

  input.placeholder = input.placeholder || 'Rechercher (lot, organisation, objets)...';

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    Array.from(tbody.rows).forEach(row => {
      const lot = row.cells[0]?.textContent?.toLowerCase() || '';
      const org = row.cells[1]?.textContent?.toLowerCase() || '';
      const items = row.cells[4]?.textContent?.toLowerCase() || '';

      const match = !q || lot.includes(q) || org.includes(q) || items.includes(q);
      row.style.display = match ? '' : 'none';
    });
  });
}

// -----------------------------
// Boutons ligne : Edit / Delete
// -----------------------------
function initBookingRowButtons() {
  const tbody = document.querySelector('#bookings_table tbody');
  if (!tbody) return;

  // Edit -> open a small inline editor modal (minimal) or fallback to prompt
  tbody.querySelectorAll('.btn-edit').forEach(btn => {
    btn.removeEventListener('click', onEditClick); // safe removal if re-init
    btn.addEventListener('click', onEditClick);
  });

  // Delete with confirmation
  tbody.querySelectorAll('.btn-delete').forEach(btn => {
    btn.removeEventListener('click', onDeleteClick);
    btn.addEventListener('click', onDeleteClick);
  });
}

async function onEditClick(e) {
  const bookingId = Number(e.currentTarget.dataset.id);
  if (!bookingId) return console.warn('booking id missing for edit');

  const booking = currentBookings.find(b => Number(b.booking_id) === bookingId);
  if (!booking) return alert('Réservation introuvable');

  // Minimal inline edit: change start/end dates via prompt (you can replace by modal)
  const oldStart = booking.start_date ? String(booking.start_date) : '';
  const oldEnd = booking.end_date ? String(booking.end_date) : '';

  const newStart = prompt('Nouvelle date de début (ISO ou vide pour conserver) :', oldStart);
  if (newStart === null) return; // cancel

  const newEnd = prompt('Nouvelle date de fin (ISO ou vide pour conserver) :', oldEnd);
  if (newEnd === null) return;

  const payload = { id: bookingId };
  if (newStart && newStart.trim()) payload.start_date = newStart.trim();
  if (newEnd && newEnd.trim()) payload.end_date = newEnd.trim();

  try {
    if (typeof updateBooking !== 'function') {
      console.warn('updateBooking RPC non disponible, tentative de mise à jour locale seulement');
      // apply locally
      if (payload.start_date) booking.start_date = payload.start_date;
      if (payload.end_date) booking.end_date = payload.end_date;
      renderBookingTable(currentBookings);
      return;
    }
    await updateBooking(client, payload);
    // refresh local copy
    if (payload.start_date) booking.start_date = payload.start_date;
    if (payload.end_date) booking.end_date = payload.end_date;
    renderBookingTable(currentBookings);
  } catch (err) {
    alert('Erreur lors de la mise à jour : ' + formatServerError(err));
    console.error(err);
  }
}

async function onDeleteClick(e) {
  const bookingId = Number(e.currentTarget.dataset.id);
  if (!bookingId) return;

  if (!confirm(`Supprimer la réservation #${bookingId} ? Cette action est irréversible.`)) return;

  try {
    if (typeof deleteBooking !== 'function') {
      console.warn('deleteBooking RPC non disponible, suppression locale seulement');
      currentBookings = currentBookings.filter(b => Number(b.booking_id) !== bookingId);
      renderBookingTable(currentBookings);
      return;
    }
    await deleteBooking(client, bookingId);
    currentBookings = currentBookings.filter(b => Number(b.booking_id) !== bookingId);
    renderBookingTable(currentBookings);
  } catch (err) {
    alert('Erreur lors de la suppression : ' + formatServerError(err));
    console.error(err);
  }
}

// -----------------------------
// Sortable columns (reusable)
// -----------------------------
function initSortableColumns(selector = '#bookings_table') {
  const table = document.querySelector(selector);
  if (!table) return;

  const headers = table.querySelectorAll('th.sortable');
  const tbody = table.querySelector('tbody');
  if (!tbody) return;

  headers.forEach((th, index) => {
    let asc = true;
    th.style.cursor = 'pointer';

    th.addEventListener('click', () => {
      const rows = Array.from(tbody.querySelectorAll('tr'));

      rows.sort((a, b) => {
        const aText = a.children[index]?.textContent?.trim()?.toLowerCase() || '';
        const bText = b.children[index]?.textContent?.trim()?.toLowerCase() || '';

        // try numeric comparison
        const aNum = parseFloat(aText.replace(',', '.'));
        const bNum = parseFloat(bText.replace(',', '.'));
        const bothNum = !isNaN(aNum) && !isNaN(bNum);

        if (bothNum) {
          return asc ? aNum - bNum : bNum - aNum;
        }
        return asc ? aText.localeCompare(bText) : bText.localeCompare(aText);
      });

      // reattach rows
      tbody.innerHTML = '';
      rows.forEach(r => tbody.appendChild(r));

      asc = !asc;
    });
  });
}

// -----------------------------
// Refresh / fetch / init
// -----------------------------
async function refreshTable(filters = {}) {
  try {
    const bookings = await fetchBookings(client, filters);
    // bookings mapping already done in RPC wrapper (fetchBookings)
      console.log ('bookings', bookings)
    renderBookingTable(bookings);
  } catch (err) {
    console.error('[bookings] Erreur fetchBookings:', formatServerError(err));
  }
}

export async function init() {
  try {
    // Initial fetch
    await refreshTable();

    // Hook up controls if present (new booking button, filters)
    const btnNew = document.getElementById('btn_new_booking');
    if (btnNew) {
      btnNew.addEventListener('click', async () => {
        // Minimal creation flow via prompt (replace by modal as needed)
        const batchDesc = prompt('Nom du lot (laisser vide pour Lot #N) :', '');
        const renter = prompt('Organisation locataire (nom ou id) :', '');
        const start = prompt('Date de début (ISO) :', '');
        const end = prompt('Date de fin (ISO) :', '');
        const items = prompt('Liste d\'IDs d\'objets séparés par des virgules (ex: 1,2,3) :', '');

        const payload = {};
        if (batchDesc) payload.p_batch_description = batchDesc;
        if (renter) payload.p_renter_organization = renter;
        if (start) payload.p_start_date = start;
        if (end) payload.p_end_date = end;
        if (items) payload.p_reservable_ids = items.split(',').map(s => Number(s.trim())).filter(Boolean);

        try {
          if (typeof createBooking !== 'function') {
            console.warn('createBooking RPC non disponible, ajout local seulement (mock id)');
            const mock = {
              booking_id: Date.now(),
              reservable_batch_id: null,
              batch_description: payload.p_batch_description || '',
              renter_organization_id: null,
              renter_name: payload.p_renter_organization || '',
              booking_reference_id: null,
              start_date: payload.p_start_date || '',
              end_date: payload.p_end_date || '',
              reservables: []
            };
            currentBookings.unshift(mock);
            renderBookingTable(currentBookings);
            return;
          }
          const res = await createBooking(client, {
            p_reservable_batch_id: payload.p_reservable_ids || [],
            p_renter_organization_id: null,
            p_booking_person_id: null,
            p_pickup_person_id: null,
            p_start_date: payload.p_start_date || null,
            p_end_date: payload.p_end_date || null,
            p_booking_reference_id: null
          });
          // after creation, refresh table
          await refreshTable();
        } catch (err) {
          alert('Erreur création réservation : ' + formatServerError(err));
          console.error(err);
        }
      });
    }

    // If there's a "filter apply" button, hook it to refresh with params
    const btnApply = document.getElementById('btn_apply_filters');
    if (btnApply) {
      btnApply.addEventListener('click', async () => {
        const start = document.getElementById('filter_start')?.value || null;
        const end = document.getElementById('filter_end')?.value || null;
        const orgIdRaw = document.getElementById('filter_org')?.value || null;
        const orgId = orgIdRaw ? Number(orgIdRaw) : null;

        await refreshTable({
          p_start: start,
          p_end: end,
          p_organization_id: orgId
        });
      });
    }
      
      const sidebar = document.getElementById('booking-filtersSidebar');
      const toggleBtn = document.getElementById('booking-filtersToggle');

      if (sidebar && toggleBtn) {
        toggleBtn.addEventListener('click', () => {
          sidebar.classList.toggle('booking-collapsed');
        });
      }


  } catch (err) {
    console.error('[bookings] Erreur initialisation :', formatServerError(err));
  }
}
