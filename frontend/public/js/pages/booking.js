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
import { showToast } from '../libs/ui/toastMessage.js';

// -----------------------------
// Client & état
// -----------------------------
let client; // initialisé dans init()
let currentBookings = []; // liste locale des bookings affichés
let batchStatusesMap = new Map(); // batch_id → 'in_stock' | 'out' | 'mixed'

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

    // Lot
    const tdLot = document.createElement('td');
    tdLot.className = 'lot';
    tdLot.dataset.id = b.reservable_batch_id ?? '';
    tdLot.textContent = b.batch_description?.trim() || `Lot #${b.reservable_batch_id ?? 'N/A'}`;
    tr.appendChild(tdLot);

    // Organisation
    const tdOrg = document.createElement('td');
    tdOrg.className = 'org';
    tdOrg.dataset.id = b.renter_organization_id ?? '';
    tdOrg.textContent = b.renter_name || '—';
    tr.appendChild(tdOrg);

    // Start date
    const tdStart = document.createElement('td');
    tdStart.className = 'start';
    tdStart.dataset.id = b.booking_id;
    const inputStart = document.createElement('input');
    inputStart.type = 'datetime-local';
    inputStart.id = `start_${b.booking_id}`;
    inputStart.dataset.bookingId = b.booking_id;
    inputStart.value = b.start_date ? b.start_date.substring(0,16) : '';
    tdStart.appendChild(inputStart);
    tr.appendChild(tdStart);

    // End date
    const tdEnd = document.createElement('td');
    tdEnd.className = 'end';
    tdEnd.dataset.id = b.booking_id;
    const inputEnd = document.createElement('input');
    inputEnd.type = 'datetime-local';
    inputEnd.id = `end_${b.booking_id}`;
    inputEnd.dataset.bookingId = b.booking_id;
    inputEnd.value = b.end_date ? b.end_date.substring(0,16) : '';
    tdEnd.appendChild(inputEnd);
    tr.appendChild(tdEnd);

    // Items
    const tdItems = document.createElement('td');
    tdItems.className = 'items';
    tdItems.textContent = (b.reservables || [])
      .map(r => r.name || r.label || '')
      .filter(Boolean)
      .join(', ');
    tr.appendChild(tdItems);

    // Nouvelle colonne : statut
    const tdStatus = document.createElement('td');
    tdStatus.className = 'status';
    tdStatus.textContent = b.status || '—';

    // Double clic pour activer édition
    tdStatus.addEventListener('dblclick', () => {
      // Si un select est déjà présent, ne rien faire
      if (tdStatus.querySelector('select')) return;

      const select = document.createElement('select');
      select.dataset.bookingId = b.booking_id;

      const options = ['à valider', 'validé', 'annulé'];
      options.forEach(opt => {
        const o = document.createElement('option');
        o.value = opt;
        o.textContent = opt;
        if (opt === b.status) o.selected = true;
        select.appendChild(o);
      });

      // Remplacer le texte par le select
      tdStatus.textContent = '';
      tdStatus.appendChild(select);

      // Focus sur le select
      select.focus();

      // Quand le select change, updateBooking et revenir au texte
      select.addEventListener('change', async () => {
        const newStatus = select.value;
        const bookingId = Number(select.dataset.bookingId);
        try {
          await updateBooking(client, { id: bookingId, status: newStatus });
          // Mettre à jour la cellule
          tdStatus.textContent = newStatus;
          // mettre à jour localement dans currentBookings
          const bk = currentBookings.find(bk => bk.booking_id === bookingId);
          if (bk) bk.status = newStatus;

          // 🔹 Met à jour le bouton Check‑in/Check‑out en fonction du nouveau statut
          const row = tdStatus.closest('tr');
          const btnCheck = row.querySelector('.btn-check-stock');
          const batchId = Number(btnCheck.dataset.batchId);
          const stockStatus = batchStatusesMap.get(batchId);
          updateCheckButtonLabel(btnCheck, stockStatus, newStatus);

                              
        } catch (err) {
          console.error('Erreur updateBooking statut :', err);
          alert('Impossible de mettre à jour le statut. Consultez la console.');
          tdStatus.textContent = b.status || '—';
        }
      });

      // Si focus perdu sans changement, revenir au texte
      select.addEventListener('blur', () => {
        tdStatus.textContent = b.status || '—';
      });
    });

    tr.appendChild(tdStatus);


    // Bouton check stock
    const tdBtn = document.createElement('td');
    const btnCheck = document.createElement('button');
    btnCheck.className = 'btn-check-stock';
    btnCheck.dataset.batchId = b.reservable_batch_id;

    // 🔹 Activation seulement si statut = 'validé'
    const stockStatus = batchStatusesMap.get(Number(b.reservable_batch_id));
    if (b.status === 'validé') {
      if (stockStatus === 'in_stock') {
        btnCheck.textContent = 'Sortir';
        btnCheck.disabled = false;
      } else if (stockStatus === 'out') {
        btnCheck.textContent = 'Rentrer';
        btnCheck.disabled = false;
      } else if (stockStatus === 'mixed') {
        btnCheck.textContent = 'Indéterminé';
        btnCheck.disabled = true;
      } else {
        btnCheck.textContent = 'inactif';
        btnCheck.disabled = true;
      }
    } else {
      btnCheck.textContent = 'inactif';
      btnCheck.disabled = true;
    }

    btnCheck.addEventListener('click', onCheckStockClick);
    tdBtn.appendChild(btnCheck);
    tr.appendChild(tdBtn);
    // Bouton éditer
    const tdEdit = document.createElement('td');
    const btnEdit = document.createElement('button');
    btnEdit.className = 'btn-edit booking-btn';
    btnEdit.dataset.id = b.booking_id;
    btnEdit.textContent = 'Éditer';
    btnEdit.addEventListener('click', onEditClick);
    tdEdit.appendChild(btnEdit);
    tr.appendChild(tdEdit);

    // Bouton supprimer
    const tdDelete = document.createElement('td');
    const btnDelete = document.createElement('button');
    btnDelete.className = 'btn-delete booking-btn';
    btnDelete.dataset.id = b.booking_id;
    btnDelete.textContent = 'Supprimer';
    btnDelete.addEventListener('click', onDeleteClick);
    tdDelete.appendChild(btnDelete);
    tr.appendChild(tdDelete);

    // Ajout ligne au tableau
    tbody.appendChild(tr);
  }

  initSortableColumns('#bookings_table');
  setupBookingLookupFilter();
  bindBookingDateInputs();
}


// -----------------------------
// Écouteurs pour inputs start/end
// -----------------------------
function bindBookingDateInputs() {

  const tbody = document.querySelector('#bookings_table tbody');
  if (!tbody) return;

  // Start date
  tbody.querySelectorAll('td.start input[type="datetime-local"]').forEach(input => {
    input.removeEventListener('change', onBookingDateChange);
    input.addEventListener('change', onBookingDateChange);
  });

  // End date
  tbody.querySelectorAll('td.end input[type="datetime-local"]').forEach(input => {
    input.removeEventListener('change', onBookingDateChange);
    input.addEventListener('change', onBookingDateChange);
  });
}

// -----------------------------
// Handler date change
// -----------------------------
async function onBookingDateChange(e) {
  const input = e.currentTarget;
  const cell = input.closest('td');
  if (!cell) return;

  const row = cell.closest('tr');

  const bookingId = Number(cell.dataset.id);
  if (!bookingId) return console.warn('Booking ID manquant pour update');

  const startInput = row.querySelector('td.start input[type="datetime-local"]');
  const endInput   = row.querySelector('td.end input[type="datetime-local"]');

  const startDate = startInput ? startInput.value : null;
  const endDate   = endInput ? endInput.value : null;

  try {
    await updateBooking(client, {
      id: bookingId,
      start_date: startDate,
      end_date: endDate
    });
    console.log(`[Booking ${bookingId}] Dates mises à jour : ${startDate} → ${endDate}`);
  } catch (err) {
    console.error('[onBookingDateChange] Erreur updateBooking :', err);
    alert('Erreur lors de la mise à jour des dates. Consultez la console.');
  }
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
    openBatchModal(bookingId, async () => {
        // on refait un fetch complet des bookings pour récupérer les nouvelles dates
        await refreshTable();
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

    // 🔥 Nouveau : récupération d’un seul coup
    const statuses = await fetchBatchStatuses(client);
    batchStatusesMap = new Map(statuses.map(s => [Number(s.batch_id), s.status]));

    await renderBookingTable(bookings);
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
    let stockStatus = batchStatusesMap.get(batchId);

    // Récupérer le booking associé
    const row = btn.closest('tr');
    const bookingId = Number(row.querySelector('td.start')?.dataset.id);
    const booking = currentBookings.find(b => b.booking_id === bookingId);
    const bookingStatus = booking?.status || '';

    if (stockStatus === 'in_stock') {
      if (confirm("Tous les objets sont en stock. Voulez-vous les sortir ?")) {
        await setBatchInStock(client, batchId, false);
        //alert('Batch sorti du stock.');
        showToast('✅ `Lot sorti du stock`', 'success');

      }
    } else if (stockStatus === 'out') {
      if (confirm("Tous les objets sont sortis. Voulez-vous les rentrer ?")) {
        await setBatchInStock(client, batchId, true);
      //  alert('Batch rentré dans le stock.');
          showToast('✅ `Lot rentré du stock`', 'success');

      }
    } else {
      alert('Le batch contient des objets mixtes ou indisponibles. Action impossible.');
      return;
    }

    // Mettre à jour le statut du batch
    const statuses = await fetchBatchStatuses(client);
    batchStatusesMap = new Map(statuses.map(s => [Number(s.batch_id), s.status]));
    stockStatus = batchStatusesMap.get(batchId);

    // Met à jour uniquement ce bouton
    updateCheckButtonLabel(btn, stockStatus, bookingStatus);

    // Met à jour tous les autres boutons
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


function updateCheckButtonLabel(btn, stockStatus, bookingStatus) {
  if (bookingStatus !== 'validé') {
    btn.textContent = '—';
    btn.disabled = true;
    return;
  }

  if (stockStatus === 'in_stock') {
    btn.textContent = 'Sortir';
    btn.disabled = false;
  } else if (stockStatus === 'out') {
    btn.textContent = 'Rentrer';
    btn.disabled = false;
  } else if (stockStatus === 'mixed') {
    btn.textContent = 'Indéterminé';
    btn.disabled = true;
  } else {
    btn.textContent = '—';
    btn.disabled = true;
  }
}

// Met à jour uniquement tous les boutons Check-in/Check-out
async function refreshAllCheckButtons() {
  const buttons = document.querySelectorAll('.btn-check-stock');

  for (const btn of buttons) {
    const batchId = Number(btn.dataset.batchId);
    if (!batchId) continue;

    const stockStatus = batchStatusesMap.get(batchId);

    // Récupérer la ligne correspondante et le booking
    const row = btn.closest('tr');
    const bookingId = Number(row.querySelector('td.start')?.dataset.id);
    const booking = currentBookings.find(b => b.booking_id === bookingId);
    const bookingStatus = booking?.status || '';

    // Met à jour le bouton en fonction du stock et du statut du booking
    updateCheckButtonLabel(btn, stockStatus, bookingStatus);
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



