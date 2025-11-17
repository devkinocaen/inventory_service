import { initClient } from '../libs/client.js';
import { fetchReservables, fetchPlanningMatrix } from '../libs/sql/index.js';

export async function init() {
  const client = await initClient();

  // ---------- Sélecteurs ----------
  const table = document.getElementById('reservable-planning-table');
  const tbody = table.querySelector('tbody');
  const thead = table.querySelector('thead');
  const inputStart = document.getElementById('filter-start');
  const inputEnd = document.getElementById('filter-end');
  const inputSearch = document.getElementById('search-item');
  const selectGranularity = document.getElementById('slot-granularity');

  // ---------- Etat ----------
  let reservables = [];
  let planningMatrix = [];
  let startDate = new Date();
  let endDate = new Date();
  let granularity = 1440; // minutes (1 jour)

  // ---------- Helpers ----------
  const formatDateTimeLocal = date => {
    const pad = n => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };
  const addDays = (date, days) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  };

  // ---------- Création du planning ----------
  async function loadPlanning() {
    startDate = new Date(inputStart.value || new Date());
    endDate = new Date(inputEnd.value || addDays(startDate, 7));
    granularity = Number(selectGranularity.value);

    // 1️⃣ Fetch depuis la base
    reservables = await fetchReservables(client);
    planningMatrix = await fetchPlanningMatrix(client, {
      p_start: startDate.toISOString(),
      p_end: endDate.toISOString(),
      p_granularity: granularity
    });

    renderTable();
  }

// ---------- Rendu ----------
function renderTable() {
  tbody.innerHTML = '';
  thead.innerHTML = '';

  // ----- Header -----
  const headerRow = document.createElement('tr');
  const th0 = document.createElement('th');
  th0.textContent = 'Réservable';
  headerRow.appendChild(th0);

  const totalSlots = Math.ceil((endDate - startDate) / (granularity * 60 * 1000));
  for (let i = 0; i < totalSlots; i++) {
    const th = document.createElement('th');
    const slotTime = new Date(startDate.getTime() + i * granularity * 60 * 1000);
    th.textContent = slotTime.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);

  // ----- Booking index -----
  const bookingIndex = new Map();
  planningMatrix.forEach(batch => {
    batch.slots?.forEach(s => {
      s.reservables?.forEach(r => {
        if (!bookingIndex.has(r.id)) bookingIndex.set(r.id, []);
        bookingIndex.get(r.id).push(s);
      });
    });
  });

  const search = inputSearch.value.trim().toLowerCase();

  // ----- Rows -----
  reservables.forEach(res => {
    const name = (res.name || '').toLowerCase();
    if (search && !name.includes(search)) return; // filtrage local

    const tr = document.createElement('tr');
    const tdName = document.createElement('td');
    tdName.classList.add('reservable-name');
    tdName.textContent = res.name || `#${res.id}`;
    tr.appendChild(tdName);

    const bookings = bookingIndex.get(res.id) || [];
    for (let i = 0; i < totalSlots; i++) {
      const td = document.createElement('td');
      td.classList.add('empty-slot');

      const slotStart = new Date(startDate.getTime() + i * granularity * 60 * 1000);
      const slotEnd = new Date(slotStart.getTime() + granularity * 60 * 1000);

      for (const b of bookings) {
        const sS = new Date(b.start);
        const sE = new Date(b.end);
        if (slotStart < sE && slotEnd > sS) {
          td.classList.remove('empty-slot');
          td.classList.add('booking-slot');
          td.textContent = b.organization_name; // affichage correct
          break;
        }
      }

      tr.appendChild(td);
    }

    tbody.appendChild(tr);
  });
}

  // ---------- Listeners ----------
  inputStart.addEventListener('change', loadPlanning);
  inputEnd.addEventListener('change', loadPlanning);
  selectGranularity.addEventListener('change', loadPlanning);

  // Recherche locale, sans fetch
  inputSearch.addEventListener('input', () => {
    renderTable();
  });

  // ---------- Initialisation ----------
  inputStart.value = formatDateTimeLocal(new Date());
  inputEnd.value = formatDateTimeLocal(addDays(new Date(), 7));
  await loadPlanning();
}
