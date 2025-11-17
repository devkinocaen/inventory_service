// js/pages/planning.js
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

    // 1️⃣ Reservables
    reservables = await fetchReservables(client);

    // 2️⃣ Planning Matrix
    planningMatrix = await fetchPlanningMatrix(client, {
      p_start: startDate.toISOString(),
      p_end: endDate.toISOString(),
      p_granularity: Number(granularity)
    });

    renderTable();
  }

  // ---------- Rendu ----------
  function renderTable() {
    tbody.innerHTML = '';
    thead.innerHTML = '';

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

    const bookingIndex = new Map();
    planningMatrix.forEach(batch => {
      batch.slots?.forEach(s => {
        s.reservable_ids?.forEach(id => {
          if (!bookingIndex.has(id)) bookingIndex.set(id, []);
          bookingIndex.get(id).push(s);
        });
      });
    });

    const search = inputSearch.value.toLowerCase();

    reservables.forEach(res => {
      const name = (res.name || '').toLowerCase();
      if (search && !name.includes(search)) return;

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
          const sS = new Date(b.start_slot);
          const sE = new Date(b.end_slot);
          if (slotStart < sE && slotEnd > sS) {
            td.classList.remove('empty-slot');
            td.classList.add('booking-slot');
            td.textContent = b.renter_name;
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
  inputSearch.addEventListener('input', loadPlanning);
  selectGranularity.addEventListener('change', loadPlanning);

  // ---------- Initialisation ----------
  inputStart.value = formatDateTimeLocal(new Date());
  inputEnd.value = formatDateTimeLocal(addDays(new Date(), 7));
  await loadPlanning();
}
