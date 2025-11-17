import { initClient } from '../libs/client.js';
import { fetchPlanningMatrix } from '../libs/sql/index.js';

const roundDateToGranularity = (date, gran) => {
  const d = new Date(date);
  const minutes = Math.floor(d.getMinutes() / gran) * gran;
  d.setMinutes(minutes, 0, 0);
  return d;
};

const ceilDateToGranularity = (date, gran) => {
  const d = new Date(date);
  const minutes = Math.ceil(d.getMinutes() / gran) * gran;
  d.setMinutes(minutes, 0, 0);
  return d;
};

const formatDateTimeLocal = date => {
  const pad = n => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

const GENDER_MAP = { male: 'Homme', female: 'Femme', unisex: 'Unisexe' };

export async function init() {
  const client = await initClient();

  const table = document.getElementById('reservable-planning-table');
  const tbody = table.querySelector('tbody');
  const thead = table.querySelector('thead');
  const inputStart = document.getElementById('filter-start');
  const inputEnd = document.getElementById('filter-end');
  const inputSearch = document.getElementById('search-item');
  const selectGranularity = document.getElementById('slot-granularity');

  let planningMatrixRaw = [];
  let startDate = new Date();
  let endDate = new Date();
  let granularity = 1440;

  async function loadPlanning() {
    granularity = Number(selectGranularity.value);
    startDate = roundDateToGranularity(new Date(inputStart.value || new Date()), granularity);
    endDate = ceilDateToGranularity(new Date(inputEnd.value || addDays(startDate, 7)), granularity);

    planningMatrixRaw = await fetchPlanningMatrix(client, {
      p_start: startDate.toISOString(),
      p_end: endDate.toISOString(),
      p_granularity: granularity
    });

    renderTable();
  }

  function renderTable() {
    tbody.innerHTML = '';
    thead.innerHTML = '';

    // --- Reconstituer la liste des réservable à partir des batches ---
    const reservableMap = new Map();
    planningMatrixRaw.forEach(batch => {
      batch.reservables?.forEach(r => {
        if (!reservableMap.has(r.id)) reservableMap.set(r.id, r);
      });
    });
    const reservables = Array.from(reservableMap.values());

      // --- Header à 2 lignes avec classes ---
      const totalSlots = Math.ceil((endDate - startDate) / (granularity * 60 * 1000));
      const slotTimes = [];
      for (let i = 0; i < totalSlots; i++) {
        slotTimes.push(new Date(startDate.getTime() + i * granularity * 60 * 1000));
      }

      const headerDays = document.createElement('tr');
      headerDays.classList.add('header-days');
      const headerHours = document.createElement('tr');
      headerHours.classList.add('header-hours');

      // Colonne fixe "Réservable"
      const th0 = document.createElement('th');
      th0.rowSpan = 2;
      th0.textContent = 'Réservable';
      th0.classList.add('header-reservable');
      headerDays.appendChild(th0);

      // Grouper les créneaux par jour pour le 1er header
      let currentDay = null;
      let dayCount = 0;
      for (let i = 0; i < totalSlots; i++) {
        const slotDay = slotTimes[i].toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });

        if (currentDay === null) currentDay = slotDay;

        if (slotDay !== currentDay) {
          const thDay = document.createElement('th');
          thDay.colSpan = dayCount;
          thDay.textContent = currentDay;
          thDay.classList.add('header-day');
          headerDays.appendChild(thDay);

          currentDay = slotDay;
          dayCount = 1;
        } else {
          dayCount++;
        }

        // ajouter le dernier jour
        if (i === totalSlots - 1) {
          const thDay = document.createElement('th');
          thDay.colSpan = dayCount;
          thDay.textContent = currentDay;
          thDay.classList.add('header-day');
          headerDays.appendChild(thDay);
        }
      }

      // Ligne des heures
      slotTimes.forEach(slot => {
        const th = document.createElement('th');
        th.textContent = slot.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        th.classList.add('header-hour');
        headerHours.appendChild(th);
      });

      thead.appendChild(headerDays);
      thead.appendChild(headerHours);


    // --- Booking index complet ---
    const bookingIndex = new Map();
    reservables.forEach(r => bookingIndex.set(r.id, Array(totalSlots).fill(null)));

    planningMatrixRaw.forEach(batch => {
      batch.slots?.forEach(slot => {
        const slotStart = new Date(slot.start);
        const slotEnd = new Date(slot.end);

          batch.reservables?.forEach(r => {
          const arr = bookingIndex.get(r.id);
          const startIdx = Math.max(0, Math.floor((slotStart - startDate) / (granularity * 60 * 1000)));
          const endIdx = Math.min(totalSlots, Math.ceil((slotEnd - startDate) / (granularity * 60 * 1000)));

          for (let i = startIdx; i < endIdx; i++) {
            arr[i] = {
              batch_id: batch.reservable_batch_id,
              organization_name: batch.organization_name,
              referent_first_name: batch.referent_first_name,
              referent_last_name: batch.referent_last_name,
              referent_phone: batch.referent_mobile,
              start: slotStart,
              end: slotEnd,
              reservable: r
            };
          }
        });
      });
    });

    const search = inputSearch.value.trim().toLowerCase();

    // --- Render rows ---
    reservables.forEach(res => {
      if (search && !(res.name || '').toLowerCase().includes(search)) return;

      const tr = document.createElement('tr');
      const tdName = document.createElement('td');
      tdName.textContent = res.name || `#${res.id}`;
      tdName.classList.add('reservable-name');
      tr.appendChild(tdName);

      const slotCells = bookingIndex.get(res.id);

      let i = 0;
      while (i < totalSlots) {
        const bk = slotCells[i];
        if (bk) {
          let span = 1;
          while (i + span < totalSlots && slotCells[i + span]?.batch_id === bk.batch_id) span++;

          const td = document.createElement('td');
          td.classList.add('booking-slot');
          td.colSpan = span;
          td.textContent = `${bk.organization_name} (Lot ${bk.batch_id})`;
          td.title = `Réservable: ${res.name}
Taille: ${res.size}
Genre: ${GENDER_MAP[res.gender] || '-'}
Début: ${bk.start.toLocaleString('fr-FR')}
Fin: ${bk.end.toLocaleString('fr-FR')}
Référent: ${bk.referent_first_name || ''} ${bk.referent_last_name || ''}
Mobile: ${bk.referent_phone || ''}`;
          tr.appendChild(td);
          i += span;
        } else {
          const td = document.createElement('td');
          td.classList.add('empty-slot');
          tr.appendChild(td);
          i++;
        }
      }

      tbody.appendChild(tr);
    });
  }

  inputStart.addEventListener('change', loadPlanning);
  inputEnd.addEventListener('change', loadPlanning);
  selectGranularity.addEventListener('change', loadPlanning);
  inputSearch.addEventListener('input', () => renderTable());

  const now = new Date();
  inputStart.value = formatDateTimeLocal(roundDateToGranularity(now, 60));
  inputEnd.value = formatDateTimeLocal(addDays(roundDateToGranularity(now, 60), 7));
  await loadPlanning();
}
