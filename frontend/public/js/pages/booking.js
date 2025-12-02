// booking.js
import {
  fetchBookings,
  createBooking,
  updateBooking,
  deleteBooking,
  isBatchInStock,
  setBatchInStock,
  fetchBatchStatuses
} from '../libs/sql/index.js';

import { formatServerError, formatDateTime } from '../libs/helpers.js';
import { initClient } from '../libs/client.js';
import { openBatchModal } from '../modals/batch_modal.js';

// -----------------------------
// Client & état
// -----------------------------
let client; // initialisé dans init()
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
    return formatDateTime ? formatDateTime(d) : new Date(d).toLocaleString();
  } catch (e) {
    return String(d);
  }
}

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
// Rendu du tableau des réservations
// -----------------------------
async function renderBookingTable(bookings) {
  const tbody = document.querySelector('#bookings_table tbody');
  if (!tbody) return;

  tbody.innerHTML = '';
  currentBookings = bookings || [];

  for (const b of bookings) {
    const tr = document.createElement('tr');

    const lotName = b.batch_description && b.batch_description.trim()
      ? b.batch_description
      : `Lot #${b.reservable_batch_id ?? b.booking_id ?? 'N/A'}`;

    const orgName = b.renter_name || '—';
    const startDate = formatDateForCell(b.start_date);
    const endDate = formatDateForCell(b.end_date);

    const itemsList = (Array.isArray(b.reservables) && b.reservables.length)
      ? b.reservables.map(r => r.name || r.label || '').filter(Boolean).join(', ')
      : '';

    // --- Colonnes fixes ---
    tr.innerHTML = `
      <td class="lot" data-id="${b.reservable_batch_id}">${escapeHtml(lotName)}</td>
      <td class="org" data-id="${b.renter_organization_id ?? ''}">${escapeHtml(orgName)}</td>
      <td class="start" data-id="${b.booking_id}">
        <input type="datetime-local" value="${b.start_date ? b.start_date.substring(0,16) : ''}" />
      </td>
      <td class="end" data-id="${b.booking_id}">
        <input type="datetime-local" value="${b.end_date ? b.end_date.substring(0,16) : ''}" />
      </td>
      <td class="items" data-id="${b.booking_id}">${escapeHtml(itemsList)}</td>
    `;

    // --- Bouton check-in / check-out ---
    const tdBtn = document.createElement('td');
    const btnCheck = document.createElement('button');
    btnCheck.className = 'btn-check-stock';
    btnCheck.dataset.batchId = b.reservable_batch_id;

    try {
      const stockStatus = await isBatchInStock(client, b.reservable_batch_id);
      if (stockStatus === true) {
        btnCheck.textContent = 'Sortir';
        btnCheck.disabled = false;
      } else if (stockStatus === false) {
        btnCheck.textContent = 'Rentrer';
        btnCheck.disabled = false;
      } else {
        btnCheck.textContent = 'Indéterminé';
        btnCheck.disabled = true;
      }
    } catch (err) {
      console.error('Erreur récupération stock batch:', err);
      btnCheck.textContent = 'Erreur';
      btnCheck.disabled = true;
    }

    btnCheck.addEventListener('click', onCheckStockClick);
    tdBtn.appendChild(btnCheck);
    tr.appendChild(tdBtn);

    // --- Boutons edit/delete ---
    const tdEdit = document.createElement('td');
    const btnEdit = document.createElement('button');
    btnEdit.className = 'btn-edit booking-btn';
    btnEdit.dataset.id = b.booking_id;
    btnEdit.textContent = 'Éditer';
    btnEdit.addEventListener('click', onEditClick);
    tdEdit.appendChild(btnEdit);
    tr.appendChild(tdEdit);

    const tdDelete = document.createElement('td');
    const btnDelete = document.createElement('button');
    btnDelete.className = 'btn-delete booking-btn';
    btnDelete.dataset.id = b.booking_id;
    btnDelete.textContent = 'Supprimer';
    btnDelete.addEventListener('click', onDeleteClick);
    tdDelete.appendChild(btnDelete);
    tr.appendChild(tdDelete);

    // --- Inputs start / end ---
    tr.querySelector('.start input')?.addEventListener('change', async (e) => {
      const newVal = e.target.value;
      try {
        await updateBooking(client, { id: b.booking_id, start_date: newVal });
        b.start_date = newVal;
      } catch (err) {
        alert('Erreur mise à jour date de début : ' + formatServerError(err));
        e.target.value = b.start_date ? b.start_date.substring(0,16) : '';
      }
    });

    tr.querySelector('.end input')?.addEventListener('change', async (e) => {
      const newVal = e.target.value;
      try {
        await updateBooking(client, { id: b.booking_id, end_date: newVal });
        b.end_date = newVal;
      } catch (err) {
        alert('Erreur mise à jour date de fin : ' + formatServerError(err));
        e.target.value = b.end_date ? b.end_date.substring(0,16) : '';
      }
    });

    tbody.appendChild(tr);
  }

  initSortableColumns('#bookings_table');
  setupBookingLookupFilter();
}


// -----------------------------
// Filtrage (lookup)
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
      row.style.display = !q || lot.includes(q) || org.includes(q) || items.includes(q) ? '' : 'none';
    });
  });
}

// -----------------------------
// Boutons ligne
// -----------------------------
function initBookingRowButtons() {
  const tbody = document.querySelector('#bookings_table tbody');
  if (!tbody) return;

  tbody.querySelectorAll('.btn-edit').forEach(btn => {
    btn.removeEventListener('click', onEditClick);
    btn.addEventListener('click', onEditClick);
  });

  tbody.querySelectorAll('.btn-delete').forEach(btn => {
    btn.removeEventListener('click', onDeleteClick);
    btn.addEventListener('click', onDeleteClick);
  });

  tbody.querySelectorAll('.btn-check-stock').forEach(btn => {
    btn.removeEventListener('click', onCheckStockClick);
    btn.addEventListener('click', onCheckStockClick);
  });
}

// -----------------------------
// Edit / Delete
// -----------------------------
async function onEditClick(e) {
  const bookingId = Number(e.currentTarget.dataset.id);
  if (!bookingId) return console.warn('booking id missing for edit');

    
    
  try {
    openBatchModal(bookingId, () => {
        refreshTable();
    }, 'edit');
  } catch (err) {
    console.error('Erreur ouverture modal batch :', err);
    alert('Impossible d’ouvrir la modal batch.');
  }
}


async function onDeleteClick(e) {
  const bookingId = Number(e.currentTarget.dataset.id);
  if (!bookingId) return;
  if (!confirm(`Supprimer la réservation #${bookingId} ? Cette action est irréversible.`)) return;

  try {
    if (typeof deleteBooking !== 'function') {
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
// Refresh / fetch
// -----------------------------
async function refreshTable(filters = {}) {
  try {
    const bookings = await fetchBookings(client, filters);
    await renderBookingTable(bookings); // ← await ajouté
  } catch (err) {
    console.error('[bookings] Erreur fetchBookings:', formatServerError(err));
  }
}

// -----------------------------
// Check-in / Check-out
// -----------------------------
async function onCheckStockClick(e) {
  const batchId = Number(e.currentTarget.dataset.batchId);
  const btn = e.currentTarget;
  if (!batchId) return;

  try {
    const stockStatus = await isBatchInStock(client, batchId);

    if (stockStatus === true) {
      if (confirm("Tous les objets sont en stock. Voulez-vous les sortir ?")) {
        await setBatchInStock(client, batchId, false);
        alert('Batch sorti du stock.');
          await updateCheckButtonLabel(btn, batchId);

      }
    } else if (stockStatus === false) {
      if (confirm("Tous les objets sont sortis. Voulez-vous les rentrer ?")) {
        await setBatchInStock(client, batchId, true);
        alert('Batch rentré dans le stock.');
          await updateCheckButtonLabel(btn, batchId);
      }
    } else {
      alert('Le batch contient des objets mixtes ou indisponibles. Action impossible.');
    }

//    await refreshTable();
      await refreshAllCheckButtons();

  } catch (err) {
    console.error('Erreur check-in/check-out:', err);
    alert('Erreur lors du check-in / check-out. Consultez la console.');
  }
}

// -----------------------------
// Init
// -----------------------------
export async function init() {
  try {
    client = await initClient();
    await refreshTable();

    const btnApply = document.getElementById('btn_apply_filters');
    if (btnApply) {
      btnApply.addEventListener('click', async () => {
        const start = document.getElementById('filter_start')?.value || null;
        const end = document.getElementById('filter_end')?.value || null;
        const orgIdRaw = document.getElementById('filter_org')?.value || null;
        const orgId = orgIdRaw ? Number(orgIdRaw) : null;
        await refreshTable({ p_start: start, p_end: end, p_organization_id: orgId });
      });
    }

    const sidebar = document.getElementById('booking-filtersSidebar');
    const toggleBtn = document.getElementById('booking-filtersToggle');
    if (sidebar && toggleBtn) {
      toggleBtn.addEventListener('click', () => sidebar.classList.toggle('booking-collapsed'));
    }

  } catch (err) {
    console.error('[bookings] Erreur initialisation :', formatServerError(err));
  }
}


async function updateCheckButtonLabel(btn, batchId) {
  try {
    const stockStatus = await isBatchInStock(client, batchId);

    if (stockStatus === true) {
      btn.textContent = 'Sortir';
      btn.disabled = false;
    } else if (stockStatus === false) {
      btn.textContent = 'Rentrer';
      btn.disabled = false;
    } else {
      btn.textContent = 'Indéterminé';
      btn.disabled = true;
    }
  } catch (err) {
    console.error('Erreur récupération stock batch:', err);
    btn.textContent = 'Erreur';
    btn.disabled = true;
  }
}


// Met à jour uniquement tous les boutons Check-in/Check-out
async function refreshAllCheckButtons() {
  const buttons = document.querySelectorAll('.btn-check-stock');
  for (const btn of buttons) {
    const batchId = Number(btn.dataset.batchId);
    if (!batchId) continue;

    try {
      const stockStatus = await isBatchInStock(client, batchId);
      if (stockStatus === true) {
        btn.textContent = 'Sortir';
        btn.disabled = false;
      } else if (stockStatus === false) {
        btn.textContent = 'Rentrer';
        btn.disabled = false;
      } else {
        btn.textContent = 'Indéterminé';
        btn.disabled = true;
      }
    } catch (err) {
      console.error('Erreur récupération stock batch:', err);
      btn.textContent = 'Erreur';
      btn.disabled = true;
    }
  }
}



function getCellValue(row, index) {
  const cell = row.children[index];
  if (!cell) return '';

  // input datetime-local
  const input = cell.querySelector('input[type="datetime-local"]');
  if (input) return input.value || '';

  // texte simple
  return cell.textContent.trim();
}

function compareValues(aVal, bVal, asc = true) {
  // Dates ISO
  const aDate = new Date(aVal);
  const bDate = new Date(bVal);
  const aIsDate = !isNaN(aDate.getTime());
  const bIsDate = !isNaN(bDate.getTime());
  if (aIsDate && bIsDate) return asc ? aDate - bDate : bDate - aDate;

  // Nombres
  const aNum = parseFloat(aVal.replace(',', '.'));
  const bNum = parseFloat(bVal.replace(',', '.'));
  if (!isNaN(aNum) && !isNaN(bNum)) return asc ? aNum - bNum : bNum - aNum;

  // Texte
  return asc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
}



function initSortableColumns(selector = '#bookings_table') {
  const table = document.querySelector(selector);
  if (!table) return;
  const tbody = table.querySelector('tbody');
  if (!tbody) return;

  const headers = table.querySelectorAll('th.sortable');

  headers.forEach((th, index) => {
    if (th.dataset.sortableInit) return; // déjà attaché
    th.dataset.sortableInit = true;
    th.dataset.asc = 'true';
    th.style.cursor = 'pointer';

    th.addEventListener('click', () => {
      const asc = th.dataset.asc === 'true';
      const rows = Array.from(tbody.querySelectorAll('tr'));

      // Tri basé sur getCellValue
      rows.sort((a, b) => compareValues(getCellValue(a, index), getCellValue(b, index), asc));

      // Remet dans le DOM
      tbody.innerHTML = '';
      rows.forEach(r => tbody.appendChild(r));

      // bascule asc/desc
      th.dataset.asc = (!asc).toString();

      // flèche visuelle
      headers.forEach(h => h.classList.remove('asc', 'desc'));
      th.classList.add(asc ? 'asc' : 'desc');
    });
  });
}
