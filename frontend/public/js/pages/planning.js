import client from '../libs/client.js';
import {
  fetchCurrentSession,
  fetchBookedEquipments,
  fetchEquipmentBookings,
  fetchFilteredEquipments,
  fetchProjectsBySession,
  fetchEquipmentTypes,
  fetchEquipmentStatuses,
  fetchParticipantById,
  fetchProjectTeamMembers,
  fetchProjectById,
  fetchEventById
} from '../libs/sql/index.js';

import { formatDateTime, timeStringToHours, getContrastYIQ } from '../libs/helpers.js';
import { populateSelect } from '../libs/ui/populateSelect.js';
import { MAG_DAY_START, MAG_DAY_DURATION, MAG_INTERVAL_MINUTES } from '../libs/constants.js';

import { openEditProjectModal } from '../modals/modal_edit_project_mag.js';

let currentSession = null;
let equipments = [];
let bookings = [];
let projects = [];
let gestionnairesSkillIds = [];
let renderToken = 0;
let nowIntervalId = null;

let INTERVAL_MINUTES = MAG_INTERVAL_MINUTES;
let CURRENT_MAG_DAY_START = MAG_DAY_START;
let CURRENT_MAG_DAY_DURATION = MAG_DAY_DURATION;

export async function init() {
  currentSession = await fetchCurrentSession(client);
  if (!currentSession) {
    alert('⚠️ Session non trouvée.');
    return;
  }

    const currentEvent = await fetchEventById(client, currentSession.event_id);

   if (currentEvent) {
       if (currentEvent.mag_opening_time && currentEvent.mag_closing_time) {
           const opening = timeStringToHours(currentEvent.mag_opening_time);
           const closing = timeStringToHours(currentEvent.mag_closing_time);
           if (opening != null && closing != null) {
               CURRENT_MAG_DAY_START = opening;
               CURRENT_MAG_DAY_DURATION = closing >= opening ? closing - opening : closing + 24 - opening;
           }
       }
   }
    
  document.getElementById('title').textContent = "Planning d'emprunts pour la session " + currentSession.name;


  await loadEquipmentsAndBookings();
  await loadEquipmentStatuses();
  await loadEquipmentTypes();
  await loadProjects(currentSession);
  setupFilters();
  setupTimeSlotSelect();

  await renderPlanning();
}

// ---- Récupération et filtrage des équipements ----
async function loadEquipmentsAndBookings(filters = {}) {
    // Récupérer toutes les réservations pour la session
    const allBookings = await fetchEquipmentBookings(
        client,
        new Date(currentSession.start_date),
        new Date(currentSession.end_date)
    );

    // Transformer les dates en objets Date
    allBookings.forEach(b => {
        b.startDateObj = new Date(b.start_date);
        b.endDateObj = new Date(b.end_date);
    });
    // Récupérer tous les équipements filtrés par session et critères initiaux
    const allEquipments = await fetchFilteredEquipments(client, currentSession.id, filters);
 
    // Ne garder que les équipements qui ont au moins une réservation
    const bookedEquipmentIds = new Set(allBookings.map(b => b.equipment_id));
    let equipments = allEquipments.filter(eq => bookedEquipmentIds.has(eq.id));

    // Appliquer les filtres supplémentaires : type et statut
    equipments = equipments.filter(eq =>
        (!filters.type || eq.type_id === Number(filters.type)) &&
        (!filters.status || eq.status_id === Number(filters.status))
    );

    return { equipments, allBookings };
}

async function loadEquipmentTypes() {
  let equipmentTypes = await fetchEquipmentTypes(client);

  const select = document.getElementById('filter_equipment_type');
  if (select) {
    populateSelect(select, equipmentTypes, null, {
      valueField: 'id',
      labelField: 'name',
      placeholder: 'Tous les types'
    });
  }
}

async function loadEquipmentStatuses() {
  let equipmentStatuses = await fetchEquipmentStatuses(client);

  const select = document.getElementById('filter_equipment_status');
  if (select) {
    populateSelect(select, equipmentStatuses, null, {
      valueField: 'id',
      labelField: 'name',
      placeholder: 'Tous les statuts'
    });
  }
}

async function loadProjects(session) {
  projects = await fetchProjectsBySession(client, session.id, true);
  const select = document.getElementById('filter_project_status');
  if (select) {
    populateSelect(select, projects, null, {
      valueField: 'id',
      labelField: 'short_title',
      placeholder: 'Tous les projets'
    });
  }
}



function setupFilters() {
  const btn = document.getElementById('btn-recalculer');
  if (btn) btn.addEventListener('click', renderPlanning);
}

function setupTimeSlotSelect() {
  const select = document.getElementById('filter-time-slot');
  if (!select) return;

  select.value = INTERVAL_MINUTES;
  select.addEventListener('change', async () => {
    INTERVAL_MINUTES = parseInt(select.value, 10);
    await renderPlanning();
  });
}

// Génération des créneaux horaires
function generateTimeSlots() {
  const start = new Date(currentSession.start_date);
  const end = new Date(currentSession.end_date); // Date de fin exacte
  const slots = [];

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    let dayStartMinutes = CURRENT_MAG_DAY_START * 60;
    let dayEndMinutes = dayStartMinutes + CURRENT_MAG_DAY_DURATION * 60;
    const maxMinutes = 24 * 60;
    if (dayEndMinutes > maxMinutes) dayEndMinutes = maxMinutes;

    // Premier créneau du jour
    let slotDate = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(dayStartMinutes / 60), dayStartMinutes % 60);
    if (slotDate <= end) slots.push(slotDate);

    let nextSlotMinutes = Math.ceil((dayStartMinutes + 1) / INTERVAL_MINUTES) * INTERVAL_MINUTES;
    while (nextSlotMinutes < dayEndMinutes) {
      slotDate = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(nextSlotMinutes / 60), nextSlotMinutes % 60);
      if (slotDate > end) break;
      slots.push(slotDate);
      nextSlotMinutes += INTERVAL_MINUTES;
    }

    // Dernier créneau du jour
    slotDate = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(dayEndMinutes / 60), dayEndMinutes % 60);
    if (slotDate <= end) slots.push(slotDate);
  }

  return slots;
}
 
//     const now = new Date(2026, 6, 1, 13, 30, 0); // debug

function updateNowIndicator() {
   const now = new Date(); 
  const hourCells = document.querySelectorAll('#planning-table thead tr:nth-child(2) th'); // on prend toutes les th de la 2e ligne
    if (!hourCells.length) {
      console.log ("hourCells vide")
      return;
    }
  const wrapper = document.querySelector('.planning-wrapper');
  const firstCol = document.querySelector('#planning-table th:first-child');
  if (!wrapper || !firstCol)  {
       console.log ("wrapper ou firstColvide")
       return;
   }

  const firstColWidth = firstCol.offsetWidth;
  let left = firstColWidth;

  for (let i = 0; i < hourCells.length; i++) {
    const th = hourCells[i];
    const slotTime = parseInt(th.dataset.time, 10);
    if (now.getTime() < slotTime) {
      if (i === 0) {
        left = firstColWidth;
      } else {
        const prevTh = hourCells[i - 1];
        const prevTime = parseInt(prevTh.dataset.time, 10);
        const slotWidth = th.offsetLeft - prevTh.offsetLeft;
        const fraction = (now.getTime() - prevTime) / (slotTime - prevTime);
        left = prevTh.offsetLeft + fraction * slotWidth;
      }
      break;
    } else if (i === hourCells.length - 1) {
      left = th.offsetLeft + th.offsetWidth;
    }
  }

  const indicator = document.querySelector('.planning-now-indicator'); // note la classe ici
  if (indicator) {
    indicator.style.position = 'absolute';
    indicator.style.top = '0';
    indicator.style.height = '100%';
    indicator.style.width = '2px';
    indicator.style.backgroundColor = 'red';
    indicator.style.left = left + 'px';
    indicator.style.zIndex = '100';
  }

  // Scroll uniquement si le trait sort du visible
  const visibleLeft = wrapper.scrollLeft;
  const visibleRight = visibleLeft + wrapper.clientWidth;
  if (left < visibleLeft || left > visibleRight) {
    wrapper.scrollLeft = left - wrapper.clientWidth / 2;
  }
}


// --- Header
function generateHeader(slots) {
  const thead = document.querySelector('thead');
  thead.innerHTML = '';

  const trDay = document.createElement('tr');
  const thEmpty = document.createElement('th');
  thEmpty.textContent = '';
  trDay.appendChild(thEmpty);

  const dayMap = {};
  for (const slot of slots) {
    const dayKey = slot.toDateString();
    dayMap[dayKey] = (dayMap[dayKey] || 0) + 1;
  }

  for (const dayKey of Object.keys(dayMap)) {
    const th = document.createElement('th');
    th.colSpan = dayMap[dayKey];
    const date = new Date(dayKey);
    th.textContent = date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'numeric' });
    trDay.appendChild(th);
  }
  thead.appendChild(trDay);

  const trHours = document.createElement('tr');
  const thLabel = document.createElement('th');
  thLabel.textContent = '';
  trHours.appendChild(thLabel);

  for (const slot of slots) {
    const th = document.createElement('th');
    th.className = 'time-slot';
    th.dataset.time = slot.getTime();
    const div = document.createElement('div');
    div.textContent = `${slot.getHours().toString().padStart(2,'0')}:${slot.getMinutes().toString().padStart(2,'0')}`;
    th.appendChild(div);
    trHours.appendChild(th);
  }

  thead.appendChild(trHours);
}
                                                                               
 // --- Render
 export async function renderPlanning() {
   const myToken = ++renderToken;

   // Stoppe l'ancien intervalle "now"
   if (nowIntervalId) clearInterval(nowIntervalId);

   // Récupérer les filtres actuels
   const filters = {
     type: document.getElementById('filter_equipment_type')?.value || '',
     status: document.getElementById('filter_equipment_status')?.value || ''
   };
                                 
   // Recharge équipements et bookings avec les filtres
   const result = await loadEquipmentsAndBookings(filters);
   equipments = result.equipments;
   bookings = result.allBookings;

   const tbody = document.querySelector('#planning-table tbody');
   tbody.innerHTML = '';

   // Appliquer filtres sélection projet / uniquement réservés
   const selectedType = document.getElementById('filter_type')?.value || '';
   let filteredEquipments = selectedType ? equipments.filter(e => e.type_id === Number(selectedType)) : equipments;

   const projectId = document.getElementById('filter_project_status')?.value || '';
   const onlyBooked = document.getElementById('filter-booked-only')?.checked;
   let bookingsScoped = bookings.filter(b => !projectId || String(b.project_id) === String(projectId));

   if (projectId) {
     const ids = new Set(bookingsScoped.map(b => b.equipment_id));
     filteredEquipments = filteredEquipments.filter(e => ids.has(e.id));
   } else if (onlyBooked) {
     const ids = new Set(bookings.map(b => b.equipment_id));
     filteredEquipments = filteredEquipments.filter(e => ids.has(e.id));
   }

   // Évite doublons
   const seen = new Set();
   filteredEquipments = filteredEquipments.filter(e => {
     if (seen.has(e.id)) return false;
     seen.add(e.id);
     return true;
   });

   const slots = generateTimeSlots();
   generateHeader(slots);

   for (const eq of filteredEquipments) {
     if (myToken !== renderToken) return;
     const tr = document.createElement('tr');

     const tdName = document.createElement('td');
     tdName.textContent = eq.name;
                                                                               
       // 🔴 Mettre en rouge si SORTI et pas de réservation active
       const now = new Date();
       const hasActiveBooking = bookingsScoped.some(b =>
         b.equipment_id === eq.id &&
         new Date(b.start_date) <= now &&
         new Date(b.end_date) > now
       );
       if (eq.status_name === 'SORTI' && !hasActiveBooking) {
         tdName.style.color = '#d32f2f'; // rouge
       }

       tr.appendChild(tdName);

                                                                               
     tr.appendChild(tdName);

     let slotIndex = 0;
     while (slotIndex < slots.length) {
       if (myToken !== renderToken) return;
       const slot = slots[slotIndex];

       const booking = bookingsScoped.find(b =>
         b.equipment_id === eq.id &&
         new Date(b.start_date) <= slot &&
         new Date(b.end_date) > slot
       );

       if (booking) {
         let span = 1;
         while (slotIndex + span < slots.length) {
           const nextSlot = slots[slotIndex + span];
           const nextBooking = bookingsScoped.find(b2 =>
             b2.equipment_id === eq.id &&
             new Date(b2.start_date) <= nextSlot &&
             new Date(b2.end_date) > nextSlot &&
             b2.id === booking.id
           );
           if (nextBooking) span++;
           else break;
         }

         const projectData = projects.find(p => String(p.id) === String(booking.project_id)) || null;

         const td = document.createElement('td');
         td.className = 'booking';
         td.colSpan = span;
         td.textContent = projectData ? `${projectData.short_title} (Fiche n° ${projectData.id_file})` : booking.project_id;
         td.title = projectData ? `Projet : ${projectData.short_title}` : booking.project_id;
         td.style.textAlign = 'center';
         td.style.verticalAlign = 'middle';
         if (projectData?.mag_color) {
           td.style.backgroundColor = projectData.mag_color;
           td.style.color = getContrastYIQ(projectData.mag_color);
         }

         if (projectData) {
            const referent = projectData.referent_name ?? 'N/A';
            const phone = projectData.referent_mobile_phone ?? 'N/A';
            const startTime = new Date(booking.start_date).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            const endTime = new Date(booking.end_date).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            const status = eq.status_name ?? 'N/A';
            const equipmentOwner = eq.status_name ?? 'N/A';

            td.title = `${projectData.title}
            Référent: ${referent} (${phone})
            Réservation: ${startTime} → ${endTime}
            Statut matériel: ${status}`;
            td.dataset.project_id = projectData.project_id;
                                                                               
           td.addEventListener('click', async () => {
             if (!td.dataset.project_id) return;
             const proj = await fetchProjectById(client, td.dataset.project_id, true);
             if (proj) {
               openEditProjectModal(proj, {
                 client,
                 sessions: [currentSession],
                 projects,
                 refreshLeftTable: renderPlanning
               });
             }
           });
         }

         tr.appendChild(td);
         slotIndex += span;
       } else {
         const td = document.createElement('td');
         td.className = 'available';
         tr.appendChild(td);
         slotIndex++;
       }
     }

     tbody.appendChild(tr);
   }
                                                                               
   // Fonction utilitaire pour normaliser et enlever accents
   function normalizeText(text) {
     return text
       .toLowerCase()
       .normalize('NFD')        // décompose les lettres accentuées
       .replace(/[\u0300-\u036f]/g, ''); // supprime les diacritiques
   }
                                                                               
   // --- Filtrage dynamique par input ---
   const lookupInput = document.getElementById('lookup_equipment_name');
   if (lookupInput) {
     const filterText = normalizeText(lookupInput.value);
     Array.from(tbody.rows).forEach(row => {
       const firstColText = normalizeText(row.cells[0]?.textContent || '');
       row.style.display = firstColText.includes(filterText) ? '' : 'none';
     });

     lookupInput.oninput = () => {
       const txt = normalizeText(lookupInput.value);
       Array.from(tbody.rows).forEach(row => {
         const firstCol = normalizeText(row.cells[0]?.textContent || '');
         row.style.display = firstCol.includes(txt) ? '' : 'none';
       });
     };
   }

   // Affiche le trait rouge "maintenant"
   updateNowIndicator();
   nowIntervalId = setInterval(updateNowIndicator, 15 * 60000);
 }

