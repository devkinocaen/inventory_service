import client from '../libs/client.js';
import {
    fetchEventById,
    fetchCurrentSession,
    fetchProjectsBySession,
    fetchParticipantsByRole,
    fetchFilteredEquipments,
    fetchEquipmentStatuses,
    fetchEquipmentTypes,
    fetchParticipantRoles,
    fetchParticipantsBySession,
    fetchBookedEquipments,
    fetchEquipmentBookings,
    setEquipmentStatus,
    bookEquipment,
    cancelEquipmentBookings
} from '../libs/sql/index.js';


import { populateSelect } from '../libs/ui/populateSelect.js';
import { openEquipmentPhotosModal } from '../modals/modal_equipment_photos.js';

import { logInfo, logError, formatDateTime, formatServerError } from '../libs/helpers.js';
import { STATUS_MAGASIN, STATUS_SORTI, LOG_LEVEL } from '../libs/constants.js';
import { MAG_DAY_START, MAG_DAY_DURATION } from '../libs/constants.js';

let currentSession = null;
let magasinOwner = null;
let participantRoleMap = new Map();
let ownerMap = new Map();
let statusMap = new Map();
let bookedEquipments = [];
let allBookings = null;



// -----------------------------
// Mise à jour complète de la vue
// -----------------------------
export async function updateView() {
  await Promise.all([
    updateInventoryTable(),
    updateBookingsTable()
  ]);
}


// -----------------------------
// Table d’inventaire (#liste-materiel)
// -----------------------------
export async function updateInventoryTable() {
  try {
    const selectType = document.getElementById('filter_type');
    const selectOwner = document.getElementById('filter_owner');
    const filterNature = document.getElementById('filter_nature');

    const filters = {
      type: selectType?.value || null,
      nature: filterNature?.value || '',
      owner: (filterNature && filterNature.value === 'Magasin') ||
             (selectOwner && selectOwner.disabled)
             ? null
             : selectOwner?.value || null,
    };

    if (filters.nature === 'Magasin') {
      filters.participantRole = participantRoleMap?.get('MAG') || null;
    } else if (filters.nature === 'Participant') {
      filters.participantRole = participantRoleMap?.get('festivalier') || null;
    } else {
      filters.participantRole = null;
    }

    const equipments = await fetchEquipments(filters);

    // Projet et dates
    const projectId = parseInt(document.getElementById('projet').value, 10);
    const start = document.getElementById('debut').value;
    const end = document.getElementById('fin').value;

    const statusObj = computeEquipmentStatus(equipments, projectId, start, end);
    renderEquipmentsTable(equipments, statusObj);

  } catch (error) {
    console.error('Erreur updateInventoryTable:', error);
  }
}

// -----------------------------
// Table des réservations (#liste-emprunts)
// -----------------------------
export async function updateBookingsTable() {
  try {
    const projectId = parseInt(document.getElementById('projet').value, 10);
    if (!projectId) {
      const tbody = document.querySelector('#liste-emprunts tbody');
      tbody.innerHTML = '<tr><td colspan="6">Aucun projet sélectionné.</td></tr>';
      return;
    }

    bookedEquipments = await fetchBookedEquipments(client, projectId);

    // IDs réservés par le projet courant
    const bookedByCurrentProjectIds = bookedEquipments.map(b => b.equipment_id);

    // Toutes les réservations pour calcul disponibilité
    allBookings = await fetchEquipmentBookings(client);

    renderBookingsTable(bookedEquipments);
  } catch (error) {
    console.error('Erreur updateBookingsTable:', error);
  }
}


// -----------------------------
// Bouton "Dé-réserver"
// -----------------------------
document.getElementById('btn_dereserver').addEventListener('click', async () => {
  try {
    const allCheckboxes = document.querySelectorAll('#liste-emprunts tbody input.booking-checkbox');
    const selectedBookingIds = Array.from(allCheckboxes)
      .filter(cb => cb.checked)
      .map(cb => parseInt(cb.dataset.bookingId, 10));

    if (selectedBookingIds.length === 0) {
      alert('⚠️ Veuillez sélectionner au moins une réservation à annuler.');
      return;
    }

    if (!confirm(`Voulez-vous vraiment annuler ${selectedBookingIds.length} réservation(s) ?`)) return;

    await cancelEquipmentBookings(client, selectedBookingIds);

    await updateView();
    alert('✅ Réservations annulées avec succès.');
  } catch (error) {
    console.error(error);
    alert(`❌ Échec de l'annulation : ${error.message}`);
  }
});

// -----------------------------
// Bouton "Sortir du magasin"
// -----------------------------
document.getElementById('btn_sortir').addEventListener('click', async () => {
  try {
    const allCheckboxes = document.querySelectorAll('#liste-emprunts tbody input.booking-checkbox');
                                                       
    // Transformer bookingId en equipmentId
       const selectedEquipmentIds = Array.from(allCheckboxes)
         .filter(cb => cb.checked)
         .map(cb => {
           const bookingId = parseInt(cb.dataset.bookingId, 10);
           const booking = bookedEquipments.find(b => b.id === bookingId);
           return booking ? booking.equipment_id : null;
         })
         .filter(id => Number.isInteger(id) && id > 0);

       if (selectedEquipmentIds.length === 0) {
         alert('⚠️ Veuillez sélectionner au moins un matériel à sortir.');
         return;
       }

    await setEquipmentStatus(client, selectedEquipmentIds, STATUS_SORTI);
    alert('✅ Équipements sortis avec succès.');
    await updateView();
  } catch (error) {
    console.error(error);
    alert(`❌ Échec de la mise à jour : ${formatServerError(error.message)}`);
  }
});

// -----------------------------
// Bouton "Rentrer au magasin"
// -----------------------------
document.getElementById('btn_rentrer').addEventListener('click', async () => {
  try {
    const allCheckboxes = document.querySelectorAll('#liste-emprunts tbody input.booking-checkbox');
    
    // Transformer bookingId en equipmentId
   const selectedEquipmentIds = Array.from(allCheckboxes)
     .filter(cb => cb.checked)
     .map(cb => {
       const bookingId = parseInt(cb.dataset.bookingId, 10);
       const booking = bookedEquipments.find(b => b.id === bookingId);
       return booking ? booking.equipment_id : null;
     })
     .filter(id => Number.isInteger(id) && id > 0);

   if (selectedEquipmentIds.length === 0) {
     alert('⚠️ Veuillez sélectionner au moins un matériel à sortir.');
     return;
   }

    await setEquipmentStatus(client, selectedEquipmentIds, STATUS_MAGASIN);
    alert('✅ Équipements rentrés avec succès.');
    await updateView();
  } catch (error) {
    console.error(error);
    alert(`❌ Échec de la mise à jour : ${formatServerError(error.message)}`);
  }
});

async function setDateInputsBounds(session) {
  if (!session || !session.start_date || !session.end_date) return;

  // Date de début : MAG_DAY_START
  const sessionStart = new Date(session.start_date);
  sessionStart.setHours(MAG_DAY_START, 0, 0, 0);

  // Date de fin : MAG_DAY_START + MAG_DAY_DURATION
  const sessionEnd = new Date(session.start_date);
  sessionEnd.setHours(MAG_DAY_START + MAG_DAY_DURATION, 0, 0, 0);

  // Ne jamais dépasser la vraie fin de session
  const maxSessionEnd = new Date(session.end_date);
  if (sessionEnd > maxSessionEnd) sessionEnd.setTime(maxSessionEnd.getTime());

  // Formater pour input datetime-local
  const formatForInput = d => d.toISOString().slice(0,16); // "YYYY-MM-DDTHH:mm"

  const debutInput = document.getElementById('debut');
  const finInput = document.getElementById('fin');

  debutInput.min = formatForInput(sessionStart);
  debutInput.max = formatForInput(sessionEnd);

  finInput.min = formatForInput(sessionStart);
  finInput.max = formatForInput(sessionEnd);

  // Optionnel : définir valeurs par défaut
  debutInput.value = formatForInput(sessionStart);
  finInput.value = formatForInput(sessionEnd);

}


document.getElementById('btn_reserver').addEventListener('click', async () => {
  try {
    const projectId = parseInt(document.getElementById('projet').value, 10);
    const start = document.getElementById('debut').value;
    const end = document.getElementById('fin').value;

    if (!projectId || !start || !end) {
      alert('⚠️ Veuillez sélectionner un projet et renseigner les dates.');
      return;
    }

    // Récupération des équipements cochés dans le tableau
    const selectedEquipmentIds = Array.from(document.querySelectorAll('#liste-materiel tbody input[type="checkbox"]:checked'))
      .map(cb => parseInt(cb.dataset.id, 10));

    if (selectedEquipmentIds.length === 0) {
      alert('⚠️ Veuillez sélectionner au moins un matériel à réserver.');
      return;
    }

    // Réservation multiple des équipements sélectionnés
    await Promise.all(selectedEquipmentIds.map(equipmentId =>
      bookEquipment(client, {
        equipment_id: equipmentId,
        project_id: projectId,
        start_date: start,
        end_date: end,
      })
    ));

    alert('✅ Réservation effectuée avec succès.');

    // Mise à jour complète de la vue équipements + réservations
    await updateView();

  } catch (error) {
    alert(`❌ Échec de la réservation : ${formatServerError(error.message)}`);
    console.error(error);
  }
});



// Chargement équipements avec filtres (type, nature, owner)
async function fetchEquipments(filters) {
  const params = {
    p_equipment_type_id: filters.type ? parseInt(filters.type) : null,
    p_owner_id: filters.owner ? parseInt(filters.owner) : null,
    p_participant_role_id: filters.participantRole ? parseInt(filters.participantRole) : null
  };

   if (!filters.participantRole) {
    const [equipmentsFestivalier, equipmentsMag] = await Promise.all([
      fetchFilteredEquipments(client, currentSession.id, {
        ...params,
        p_participant_role: participantRoleMap.get('festivalier')
      }),
      fetchFilteredEquipments(client, currentSession.id, {
        ...params,
        p_participant_role: participantRoleMap.get('MAG')
      }),
    ]);
    return [...equipmentsFestivalier, ...equipmentsMag];
  }

  return await fetchFilteredEquipments(client, currentSession.id, params);
}


/**
 * Détermine la disponibilité des équipements pour le projet courant et les dates sélectionnées
 * @param {Array} equipments - liste des équipements filtrés
 * @param {Number} projectId - id du projet courant
 * @param {String} start - date début réservation
 * @param {String} end - date fin réservation
 * @returns {Object} - { availableIds, bookedByCurrentProjectIds, bookedByOthersIds }
 */
function computeEquipmentStatus(equipments, projectId, start, end) {
  if (!allBookings || !start || !end || !projectId) {
    return { availableIds: [], bookedByCurrentProjectIds: [], bookedByOthersIds: [] };
  }

  const periodsOverlap = (startA, endA, startB, endB) =>
    (new Date(startA) < new Date(endB)) && (new Date(startB) < new Date(endA));

  const bookedByCurrentProjectIds = allBookings
    .filter(b => b.project_id === projectId &&
                 periodsOverlap(start, end, b.start_date, b.end_date))
    .map(b => b.equipment_id);

  const bookedByOthersIds = allBookings
    .filter(b => b.project_id !== projectId &&
                 periodsOverlap(start, end, b.start_date, b.end_date))
    .map(b => b.equipment_id);

  const availableIds = equipments
    .map(eq => eq.id)
    .filter(id => !bookedByCurrentProjectIds.includes(id) && !bookedByOthersIds.includes(id));

  return { availableIds, bookedByCurrentProjectIds, bookedByOthersIds };
}

/**
 * Rendu des équipements dans le tableau avec colorisation et activation checkbox
 * @param {Array} equipments
 * @param {Object} statusObj - output de computeEquipmentStatus
 */
function renderEquipmentsTable(equipments, statusObj = {}) {
  const { availableIds = [], bookedByCurrentProjectIds = [], bookedByOthersIds = [] } = statusObj;
  const tbody = document.querySelector('#liste-materiel tbody');
  tbody.innerHTML = '';

  const showUnavailable = document.getElementById('show_unavailable_equipments')?.checked;

  equipments.forEach(eq => {
    const isUnavailable = (bookedByOthersIds.includes(eq.id) || eq.status_name === "INDISPONIBLE");
    if (isUnavailable && !showUnavailable) return;

    const tr = document.createElement('tr');
    tr.setAttribute('data-id', eq.id);

    // Déterminer couleur
    if (bookedByCurrentProjectIds.includes(eq.id)) {
      tr.style.backgroundColor = 'lightgreen';
    } else if (bookedByOthersIds.includes(eq.id) || eq.status_name === "INDISPONIBLE") {
      tr.style.backgroundColor = '#ffcccc';
    } else if (availableIds.includes(eq.id)) {
      tr.style.backgroundColor = '#cce5ff';
    }

    const disabled = bookedByOthersIds.includes(eq.id) || bookedByCurrentProjectIds.includes(eq.id);

    tr.innerHTML = `
      <td>${eq.name}</td>
      <td>${eq.type_name || '—'}</td>
      <td>${eq.status_name || '—'}</td>
      <td>${eq.description || ''}</td>
      <td>${eq.notes || ''}</td>
      <td>
        <button class="btn-photos" data-id="${eq.id}" ${disabled ? 'disabled' : ''}>
          📷 ${eq.photos?.length || 0}
        </button>
      </td>
      <td>
        <input type="checkbox" class="equipment-checkbox"
               data-id="${eq.id}" value="${eq.id}" ${disabled ? 'disabled' : ''}>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // -----------------------------
  // Listener bouton "Photos" propre
  // -----------------------------
  tbody.querySelectorAll('.btn-photos').forEach(btn => {
    // on clone pour supprimer les anciens listeners
    const clonedBtn = btn.cloneNode(true);
    btn.replaceWith(clonedBtn);

    clonedBtn.addEventListener('click', () => {
      const equipmentId = parseInt(clonedBtn.dataset.id, 10);
      const eq = equipments.find(e => e.id === equipmentId);
      if (!eq) return;

      openEquipmentPhotosModal(
        client,
        eq,
        updatedPhotos => {
          // Mettre à jour les photos locales
          eq.photos = updatedPhotos;
          // Mettre à jour le compteur affiché sur le bouton
          clonedBtn.textContent = `📷 ${updatedPhotos.length || 0}`;
        }, true
      );
    });
  });

  // -----------------------------
  // Rendre la table sortable
  // -----------------------------
  const table = document.getElementById('liste-materiel');
  const headers = table.querySelectorAll('th');
  headers.forEach((header, index) => {
    header.style.cursor = 'pointer';
    header.onclick = () => {
      const rows = Array.from(tbody.querySelectorAll('tr'));
      const asc = !header.classList.contains('asc');

      rows.sort((a, b) => {
        const cellA = a.cells[index]?.textContent.trim().toLowerCase() || '';
        const cellB = b.cells[index]?.textContent.trim().toLowerCase() || '';

        if (!isNaN(cellA) && !isNaN(cellB)) return asc ? cellA - cellB : cellB - cellA;
        const dateA = Date.parse(cellA), dateB = Date.parse(cellB);
        if (!isNaN(dateA) && !isNaN(dateB)) return asc ? dateA - dateB : dateB - dateA;

        return asc ? cellA.localeCompare(cellB) : cellB.localeCompare(cellA);
      });

      tbody.innerHTML = '';
      rows.forEach(r => tbody.appendChild(r));

      table.querySelectorAll('th').forEach(th => th.classList.remove('asc', 'desc'));
      header.classList.add(asc ? 'asc' : 'desc');
    };
  });
}


/**
 * Affiche les réservations actuelles pour un projet.
 * @param {Array} bookedEquipments - Réservations (avec equipment et owner_id inclus)
 * @param {Map} ownerMap - Map des participants (id => "Prénom Nom")
 */
// Affiche les réservations avec bouton annuler
export function renderBookingsTable(bookedEquipments) {
  const tbody = document.querySelector('#liste-emprunts tbody');
  tbody.innerHTML = '';

  if (!Array.isArray(bookedEquipments) || bookedEquipments.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="6">Aucune réservation pour ce projet.</td>`;
    tbody.appendChild(tr);
    return;
  }

  bookedEquipments.forEach(booking => {
    const { id, name, owner_id, start_date, end_date, status_id } = booking;

    // Vérifier que l'ID existe
    if (id == null) {
      console.warn('Booking sans ID détecté, ignoré :', booking);
      return;
    }

    const ownerName = owner_id ? (ownerMap.get(owner_id) || '—') : '—';
    const statusName = status_id ? (statusMap.get(status_id) || '—') : '—';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${name || '—'}</td>
      <!-- <td>${ownerName}</td> -->
      <td>${formatDateTime(start_date)}</td>
      <td>${formatDateTime(end_date)}</td>
      <td>${statusName}</td>
      <td>
        <input type="checkbox" class="booking-checkbox"
               data-booking-id="${id}"
               value="${id}">
      </td>
    `;
    tbody.appendChild(tr);
  });
}




async function cancelBooking(bookingId) {
  await cancelEquipmentBookings(client, [bookingId]);
  await updateView();
}

// Centralise la récupération de toutes les données initiales
async function fetchAllInitialData() {
  try {
    currentSession = await fetchCurrentSession(client);
    if (!currentSession || !currentSession.id) {
      throw new Error('Session courante non trouvée ou invalide');
    }

    const [types, statuses, roles, participants, projects] = await Promise.all([
      fetchEquipmentTypes(client),
      fetchEquipmentStatuses(client),
      fetchParticipantRoles(client),
      fetchParticipantsBySession(client, currentSession.id),
      fetchProjectsBySession(client, currentSession.id),
    ]);

    const magasinOwners = await (async () => {
      const role = roles.find(r => r.name === 'MAG');
      if (!role) throw new Error('⚠️ Rôle "MAG" introuvable dans participant_role');
      return fetchParticipantsByRole(client, role.id);
    })();

    participants.push(...magasinOwners);

    if (!types || !Array.isArray(types)) throw new Error('Types d\'équipement invalides');
    if (!statuses || !Array.isArray(statuses)) throw new Error('Statuts d\'équipement invalides');
    if (!Array.isArray(roles)) throw new Error('Rôles participants invalides');
    if (!Array.isArray(participants)) throw new Error('Participants invalides');

    // Mapping rôle => id (ex: { 'MAG': 3, 'festivalier': 4 })
    participantRoleMap = new Map(roles.map(r => [r.name, r.id]));

    // Mapping id participant => "Prénom Nom"
    ownerMap.clear();

    participants.forEach(p => {
      if (p && p.id && p.first_name && p.last_name) {
        ownerMap.set(p.id, `${p.first_name} ${p.last_name}`);
      } else {
        logError('Participant malformé ignoré:', p);
      }
    });
      
      // Mapping id statut => nom du statut
      statusMap = new Map(statuses.map(s => [s.id, s.name]));


    magasinOwner = magasinOwners.length === 1 ? magasinOwners[0] : null;
    if (magasinOwners.length > 1) {
      logInfo('Plusieurs propriétaires magasin trouvés, aucun défini par défaut');
    }
   // if (magasinOwner) logInfo('Propriétaire magasin identifié:', magasinOwner);

    return { types, statuses, roles, participants, projects };
  } catch (error) {
    logError('Erreur lors de la récupération des données initiales:', error);
    throw error; // remonter erreur pour arrêt/init propre
  }
}

export async function init() {
  try {
    // 1️⃣ D’abord récupérer les données
    const initialData = await fetchAllInitialData();
    const festivalierId = participantRoleMap.get('festivalier');
    const festivaliers = initialData.participants.filter(p => Number(p.role_id) === festivalierId);

    // Initialisation filtres
    const selectType = document.getElementById('filter_type');
    const selectOwner = document.getElementById('filter_owner');
    const filterNature = document.getElementById('filter_nature');

    // 3. Remplir les select
      if (filterNature) {
          filterNature.innerHTML = '<option value="">-- Tout --</option><option value="Magasin">Magasin</option><option value="Participant">Participant</option>';
          
          filterNature.value="Magasin";
          filterNature.disabled=true;
      }
      
      // Projet : valeur = id, texte = short_title
      populateSelect(document.getElementById('projet'), initialData.projects, null, {
        valueField: 'id',
        labelField: 'short_title',
        placeholder: '-- Choisir un projet --'
      });

      // Type d’équipement : valeur = id, texte = name (par défaut)
      populateSelect(document.getElementById('filter_type'), initialData.types);

      // Propriétaire / participant : valeur = id, texte = "Prénom Nom"
      populateSelect(selectOwner, festivaliers, null, {
        valueField: 'id',
        labelField: p => `${p.first_name} ${p.last_name}`,
        placeholder: '-- Choisir un propriétaire --'
      });

    // 4. Gestion activation filtre Owner selon Nature
    function updateOwnerEnabled() {
      if (filterNature.value === '' || filterNature.value === 'Magasin') {
        selectOwner.disabled = true;
        selectOwner.value = '';
      } else {
        selectOwner.disabled = false;
      }
    }
      

      // --- Filtrage dynamique du tableau par nom ---
      const inputLookup = document.getElementById('lookup_equipment_name');
      const table = document.getElementById('liste-materiel')
      const tableBody = table?.querySelector('tbody') || null;

      inputLookup.addEventListener('input', () => {
        const filter = inputLookup.value.toLowerCase();

        Array.from(tableBody.rows).forEach(row => {
          const nameCell = row.cells[0]; // la colonne "Nom"
          if (!nameCell) return;
          const text = nameCell.textContent.toLowerCase();
          row.style.display = text.includes(filter) ? '' : 'none';
        });
      });

    document.getElementById('debut').addEventListener('change', updateView);
    document.getElementById('fin').addEventListener('change', updateView);

  if (selectType) {
    selectType.addEventListener('change', updateInventoryTable);
  }

  if (filterNature) {
    filterNature.addEventListener('change', () => {
      updateOwnerEnabled();
        updateInventoryTable();
    });
  }

  if (selectOwner) {
      selectOwner.addEventListener('change', updateInventoryTable);
      updateOwnerEnabled();
  }

      // Filtrer équipements indisponibles
      const checkboxShowUnavailable = document.getElementById('show_unavailable_equipments');
      if (checkboxShowUnavailable) {
        checkboxShowUnavailable.addEventListener('change', () => {
            updateInventoryTable(); // on re-rend la table avec le nouveau filtre
        });
      }


    const projectId = parseInt(document.getElementById('projet').value, 10);
    if (!projectId) {
      const tbody = document.querySelector('#liste-emprunts tbody');
      tbody.innerHTML = 'aucun projet sélectionné';
    }

    document.getElementById('projet').addEventListener('change', async () => {
      const projectId = parseInt(document.getElementById('projet').value, 10);
      if (!projectId) {
        const tbody = document.querySelector('#liste-emprunts tbody');
        tbody.innerHTML = '';
        return;
      }

      try {
        await updateView();
      } catch (error) {
        console.error('Erreur chargement réservations:', error);
      }
    });

    if (currentSession.id && ownerMap.size > 0) {
      await updateInventoryTable();
    } else {
      console.warn('Données incomplètes pour appel initial à updateInventoryTable');
    }

      updateView();
      
    await setDateInputsBounds(currentSession);


  } catch (error) {
    console.error('Erreur initialisation:', error);
  }
}
