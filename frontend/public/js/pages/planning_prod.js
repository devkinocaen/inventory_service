// planning.js
import client from '../libs/client.js';
import {
  fetchCurrentSession,
  fetchProjectsBySession,
  fetchProjectGenres,
  fetchProjectTypes,
  fetchProjectStatuses,
  fetchProgressStatuses,
  fetchShootings,
  fetchShootingLocationsByIds,
  fetchSessionsByEvent
} from '../libs/sql/index.js';

import { logError } from '../libs/helpers.js';
import { PROD_INTERVAL_MINUTES } from '../libs/constants.js';
import { openEditProjectModal } from '../modals/modal_edit_project_prod.js';
import { openMapModal } from '../modals/modal_map.js';

let currentSession = null;
let projects = [];
let shootings = [];
let locations = new Map();
let sessions = [];
let statuses = [];
let progressStatuses = [];
let types = [];
let genres = [];
let CURRENT_PROD_INTERVAL_MINUTES = PROD_INTERVAL_MINUTES;
let isModalOpening = false;
let sortDirection = 1; // 1 = A→Z, -1 = Z→A

export async function init() {
  try {
    await loadSession();
    await loadProjects();
    await loadShootingsAndLocations();
      
    types = await fetchProjectTypes(client);
    genres = await fetchProjectGenres(client);
    progressStatuses = await fetchProgressStatuses(client);
    statuses = await fetchProjectStatuses(client);

    sessions = await fetchSessionsByEvent(client, currentSession.event_id);

    generatePlanning();
    bindProjectSearch();
    bindTimeSlotFilter();

  updateNowIndicator();
  setInterval(updateNowIndicator, 15 * 60000); // toutes les 15 min

  } catch (err) {
    logError('Erreur init planning:', err);
    alert('Erreur lors du chargement du planning : ' + (err?.message || err));
  }
}

/* ---------------------- */
/* LOAD DATA FUNCTIONS    */
/* ---------------------- */
async function loadSession() {
  currentSession = await fetchCurrentSession(client);
  if (!currentSession) throw new Error('Session non trouvée');
}

async function loadProjects() {
  projects = await fetchProjectsBySession(client, currentSession.id, true);
  if (!projects) projects = [];
}

async function loadShootingsAndLocations() {
  shootings = await fetchShootings(
    client,
    currentSession.event_id,
    currentSession.start_date,
    currentSession.end_date
  ) || [];

  // ⚠️ Garde les null, ne filtre que les doublons valides
  const locationIds = [...new Set(shootings
    .map(s => s.shooting_location_id)
    .filter(id => id !== undefined && id !== null))];

  if (locationIds.length) {
    const locs = await fetchShootingLocationsByIds(client, locationIds);
    locations = new Map((locs || []).map(l => [l.id, l]));
  } else {
    locations = new Map();
  }
}

/* ---------------------- */
/* UI RENDER FUNCTIONS    */
/* ---------------------- */
function generatePlanning() {
    const tbody = document.querySelector('#planning-table tbody');
    if (!tbody) {
      console.error('planning: table tbody introuvable');
      return;
    }
    tbody.innerHTML = '';

    if (!currentSession?.start_date || !currentSession?.end_date) {
      console.error('planning: dates de session invalides');
      return;
    }

    const sessionStart = new Date(currentSession.start_date);
    const sessionEnd = new Date(currentSession.end_date);

    // jours
    const jours = [];
    for (
      let d = new Date(sessionStart.getFullYear(), sessionStart.getMonth(), sessionStart.getDate());
      d.getTime() <= sessionEnd.getTime();
      d.setDate(d.getDate() + 1)
    ) {
      jours.push(new Date(d));
    }

    const totalMinutes = Math.ceil((sessionEnd.getTime() - sessionStart.getTime()) / 60000);
    const totalSlots = Math.max(1, Math.ceil(totalMinutes / CURRENT_PROD_INTERVAL_MINUTES));

    generateHeader(jours, totalSlots, sessionStart);

    for (const project of projects) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td class="project-name">${escapeHtml(project.short_title || project.title || 'Projet sans titre')}</td>`;

     // 🧠 Champs cachés (datasets) pour chaque projet
     tr.dataset.project_id = project.id;
     tr.dataset.id_file = project.id_file;
     tr.dataset.short_title = project.short_title || '';
     tr.dataset.title = project.title || '';
     tr.dataset.referent_name = project.referent_name || '';
                                             
      for (let slot = 0; slot < totalSlots; slot++) {
        const slotTime = new Date(sessionStart.getTime() + slot * CURRENT_PROD_INTERVAL_MINUTES * 60000);

        const shooting = shootings.find(s =>
          new Date(s.start_date).getTime() <= slotTime.getTime() &&
          new Date(s.end_date).getTime() > slotTime.getTime() &&
          s.project_id === project.id
        );

        if (shooting) {

          let span = 1;
          while (slot + span < totalSlots) {
            const nextSlotTime = new Date(sessionStart.getTime() + (slot + span) * CURRENT_PROD_INTERVAL_MINUTES * 60000);
            if (new Date(shooting.start_date).getTime() <= nextSlotTime.getTime() &&
                new Date(shooting.end_date).getTime() > nextSlotTime.getTime()) {
              span++;
            } else break;
          }

        const td = document.createElement('td');
        td.colSpan = span;
        td.className = 'shooting-slot';

        const loc = locations.get(shooting.shooting_location_id);
        const formatTime = d => `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
        td.textContent = loc?.name || 'N/A';
        td.title = `${loc?.name || 'N/A'}\n${loc?.address || ''}\n${formatTime(new Date(shooting.start_date))} - ${formatTime(new Date(shooting.end_date))}`;

        // Double-clic sur shooting → ouvrir modal map readonly
         if (loc) {
           td.addEventListener('dblclick', async () => {
             try {
               await openMapModal(client, loc, true); // readonly = true
             } catch (err) {
               console.error('Erreur ouverture modal map:', err);
             }
           });
         }

        tr.appendChild(td);
        slot += span - 1;
      } else {
        const td = document.createElement('td');
        td.className = 'empty-slot';
        td.textContent = '';
        tr.appendChild(td);
      }
    }

    tbody.appendChild(tr);

    // double-clic ouverture modal édition projet
    const firstCell = tr.querySelector('td.project-name');
    if (firstCell) {
      firstCell.addEventListener('dblclick', async () => {
        if (isModalOpening) return;
        isModalOpening = true;
        try {
          const existingModal = document.querySelector('#modal-edit-project_prod');
          if (existingModal) existingModal.remove();

          await openEditProjectModal(project, {
            client,
            types,
            genres,
            statuses,
            progressStatuses,
            sessions,
            projects,
            shootingLocs: Array.from(locations.values()),
            readOnly: false,
            onProjectUpdated: async () => {
              // recharger shootings au besoin
              await loadShootingsAndLocations();
              generatePlanning();
            }
          });
        } catch (err) {
          console.error("Erreur lors de l'ouverture du modal", err);
        } finally {
          isModalOpening = false;
        }
      });
    }
  }
}


function generateHeader(jours, totalSlots, sessionStart) {
  const thead = document.querySelector('#planning-table thead');
  if (!thead) return;
  thead.innerHTML = '';

  // Calculer les slots par jour
  const slotsPerDay = Math.ceil((24 * 60) / CURRENT_PROD_INTERVAL_MINUTES);

  const trDays = document.createElement('tr');

  // --- Première colonne : Projet (cliquable pour trier) ---
  const thProject = document.createElement('th');
  thProject.textContent = 'Projet';
  thProject.classList.add('sortable-header');
  thProject.title = 'Cliquer pour trier A↔Z';
  thProject.style.cursor = 'pointer';

  thProject.addEventListener('click', () => {
    sortDirection *= -1;
    projects.sort((a, b) => {
      const nameA = (a.short_title || a.title || '').toLowerCase();
      const nameB = (b.short_title || b.title || '').toLowerCase();
      return sortDirection * nameA.localeCompare(nameB, 'fr', { sensitivity: 'base' });
    });
    generatePlanning();
  });

  trDays.appendChild(thProject);

  // --- Colonnes de jours ---
  for (const j of jours) {
    const thDay = document.createElement('th');
    thDay.colSpan = slotsPerDay;
    thDay.textContent = j.toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'numeric'
    });
    trDays.appendChild(thDay);
  }

  thead.appendChild(trDays);

  // --- Ligne des heures ---
  const trSlots = document.createElement('tr');
  const thEmpty = document.createElement('th');
  trSlots.appendChild(thEmpty);

  for (const j of jours) {
    const dayStart = new Date(j);
    for (let m = 0; m < 24 * 60; m += CURRENT_PROD_INTERVAL_MINUTES) {
      const slotTime = new Date(dayStart.getTime() + m * 60000);
      const th = document.createElement('th');
      th.className = 'time-slot';
      th.dataset.time = slotTime.getTime();
      th.innerHTML = `<div>${slotTime.getHours().toString().padStart(2, '0')}:${slotTime
        .getMinutes()
        .toString()
        .padStart(2, '0')}</div>`;
      trSlots.appendChild(th);
    }
  }

  thead.appendChild(trSlots);
}


/* ---------------------- */
/* EVENT HANDLERS         */
/* ---------------------- */
function bindTimeSlotFilter() {
  const select = document.getElementById('time-slot-filter');
  if (!select) return;
  select.value = CURRENT_PROD_INTERVAL_MINUTES.toString();
  select.addEventListener('change', (e) => {
    const newValue = parseInt(e.target.value, 10);
    if (isNaN(newValue)) return;
    CURRENT_PROD_INTERVAL_MINUTES = newValue;
    generatePlanning();
  });
}

/* ---------------------- */
/* Helpers                */
/* ---------------------- */
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

  function updateNowIndicator() {
    const now = new Date();
    const hourCells = document.querySelectorAll('#planning-table thead tr:nth-child(2) th.time-slot');
    if (!hourCells.length) return;

    const wrapper = document.querySelector('.planning-wrapper');
    const firstCol = document.querySelector('#planning-table th:first-child');
    if (!wrapper || !firstCol) return;

    const firstColWidth = firstCol.offsetWidth;
    let left = firstColWidth;

    for (let i = 0; i < hourCells.length; i++) {
      const th = hourCells[i];
      const slotTime = th.dataset.time ? new Date(parseInt(th.dataset.time, 10)) : null;
      if (!slotTime) continue;

      if (now < slotTime) {
        if (i === 0) {
          left = firstColWidth;
        } else {
          const prevTh = hourCells[i - 1];
          const prevTime = prevTh.dataset.time ? new Date(parseInt(prevTh.dataset.time, 10)) : null;
          if (!prevTime) continue;

          const slotWidth = th.offsetLeft - prevTh.offsetLeft;
          const fraction = (now - prevTime) / (slotTime - prevTime);
          left = prevTh.offsetLeft + fraction * slotWidth;
        }
        break;
      } else if (i === hourCells.length - 1) {
        left = th.offsetLeft + th.offsetWidth;
      }
    }

    // ⚡ Mettre l'indicateur à sa position
    const indicator = document.querySelector('.planning-now-indicator');
    if (indicator) {
      indicator.style.left = (left - wrapper.scrollLeft) + 'px';
    }

    // ⚡ Scroll automatique pour mettre "now" à gauche avec une marge
    const margin = 20; // px de marge à gauche
    const targetScroll = left - margin;
    wrapper.scrollLeft = Math.max(0, targetScroll - firstColWidth); // ne pas scroller négatif
  }


function bindProjectSearch() {
  const input = document.getElementById('project-search');
  if (!input) return;

  // 🔤 Fonction utilitaire : supprime les accents et met en minuscules
  const normalize = str =>
    (str || '')
      .toLowerCase()
      .normalize('NFD')           // décompose les caractères accentués
      .replace(/[\u0300-\u036f]/g, ''); // retire les diacritiques

  input.addEventListener('input', (e) => {
    const term = normalize(e.target.value.trim());
    const tbody = document.querySelector('#planning-table tbody');
    if (!tbody) return;

    const rows = tbody.querySelectorAll('tr');
    rows.forEach(row => {
      const shortTitle = normalize(row.dataset.shortTitle);
      const title = normalize(row.dataset.title);
      const referent = normalize(row.dataset.referentName);

      const visible =
        !term ||
        shortTitle.includes(term) ||
        title.includes(term) ||
        referent.includes(term);

      row.style.display = visible ? '' : 'none';
    });
  });
}
