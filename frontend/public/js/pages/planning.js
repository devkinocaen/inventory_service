import { initClient } from '../libs/client.js';
import { fetchReservables, fetchPlanningMatrix } from '../libs/sql/index.js';

// ---------- Helpers ----------
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
  let granularity = 1440; // minutes

  // ---------- Load Planning ----------
  async function loadPlanning() {
    granularity = Number(selectGranularity.value);

    // Arrondir les dates pour les inputs et le fetch
    startDate = roundDateToGranularity(new Date(inputStart.value || new Date()), granularity);
    endDate = ceilDateToGranularity(new Date(inputEnd.value || addDays(startDate, 7)), granularity);

    // Fetch depuis la base
    reservables = await fetchReservables(client);
    planningMatrix = await fetchPlanningMatrix(client, {
      p_start: startDate.toISOString(),
      p_end: endDate.toISOString(),
      p_granularity: granularity
    });

    renderTable();
  }

  // ---------- Render Table ----------
  function renderTable() {
    tbody.innerHTML = '';
    thead.innerHTML = '';

    // ----- Header -----
    const headerRow = document.createElement('tr');
    const th0 = document.createElement('th');
    th0.textContent = 'Réservable';
    headerRow.appendChild(th0);

    const totalSlots = Math.ceil((endDate - startDate) / (granularity * 60 * 1000));
    const slotTimes = [];
    for (let i = 0; i < totalSlots; i++) {
      const th = document.createElement('th');
      const slotTime = new Date(startDate.getTime() + i * granularity * 60 * 1000);
      slotTimes.push(slotTime);
      th.textContent = slotTime.toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
      headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);

      // ----- Booking index par reservable -----
      const bookingIndex = new Map();

      planningMatrix.forEach(batch => {
        batch.slots?.forEach(slot => {
          slot.reservables?.forEach(r => {
            if (!bookingIndex.has(r.id)) bookingIndex.set(r.id, []);

            // Pour chaque réservation, on crée une entrée par reservable
            (slot.bookings || []).forEach(bk => {
              bookingIndex.get(r.id).push({
                start: new Date(slot.start),
                end: new Date(slot.end),
                organization_name: bk.organization_name,
                referent_first_name: bk.referent_first_name,
                referent_last_name: bk.referent_last_name,
                referent_phone: bk.referent_phone,
                batch_id: batch.reservable_batch_id,
                reservable: r
              });
            });
          });
        });
      });


    // Arrondir start et end des bookings à la granularité
    for (const bks of bookingIndex.values()) {
      bks.forEach(bk => {
        bk.startRounded = roundDateToGranularity(bk.start, granularity);
        bk.endRounded = ceilDateToGranularity(bk.end, granularity);
      });
      bks.sort((a, b) => a.startRounded - b.startRounded);
    }

    const search = inputSearch.value.trim().toLowerCase();

    // ----- Rows -----
    reservables.forEach(res => {
      const name = (res.name || '').toLowerCase();
      if (search && !name.includes(search)) return;

      const tr = document.createElement('tr');
      const tdName = document.createElement('td');
      tdName.classList.add('reservable-name');
      tdName.textContent = res.name || `#${res.id}`;
      tr.appendChild(tdName);

      // Pré-remplir slots avec null
      const slotCells = Array(totalSlots).fill(null);
      const bookings = bookingIndex.get(res.id) || [];
      bookings.forEach(bk => {
        for (let i = 0; i < totalSlots; i++) {
          const sStart = slotTimes[i];
          const sEnd = new Date(sStart.getTime() + granularity * 60 * 1000);
          if (bk.startRounded < sEnd && bk.endRounded > sStart) {
            slotCells[i] = bk;
          }
        }
      });

        // Parcourir slotCells pour fusionner les cellules
        let i = 0;
        while (i < totalSlots) {
          const bk = slotCells[i];

          if (bk) {
            // Créer un identifiant unique pour comparer les réservations
            const bkKey = `${bk.batch_id}`;

            // compter colspan
            let span = 1;
            while (i + span < totalSlots) {
              const nextBk = slotCells[i + span];
              if (!nextBk) break;

              const nextBkKey = `${nextBk.batch_id}`;
              if (nextBkKey === bkKey) span++;
              else break;
            }

            const td = document.createElement('td');
            td.classList.add('booking-slot');
            td.colSpan = span;
            td.textContent = `${bk.organization_name} (Lot ${bk.batch_id})`;
            td.title = `Réservable: ${res.name}\nTaille: ${res.size}\nGenre: ${GENDER_MAP[res.gender] || '-'}\nDébut: ${bk.start.toLocaleString('fr-FR')}\nFin: ${bk.end.toLocaleString('fr-FR')}\nRéférent: ${bk.referent_first_name || ''} ${bk.referent_last_name || ''}\nMobile: ${bk.referent_phone || ''}`;
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

  // ---------- Listeners ----------
  inputStart.addEventListener('change', loadPlanning);
  inputEnd.addEventListener('change', loadPlanning);
  selectGranularity.addEventListener('change', loadPlanning);
  inputSearch.addEventListener('input', () => renderTable());

  // ---------- Initialisation ----------
  const now = new Date();
  inputStart.value = formatDateTimeLocal(roundDateToGranularity(now, 60));
  inputEnd.value = formatDateTimeLocal(addDays(roundDateToGranularity(now, 60), 7));
  await loadPlanning();
}
