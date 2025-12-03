// js/ui/org_modal.js
import { initClient } from '../libs/client.js';
import {
  fetchPersonByName,
  fetchOrganizations,
  upsertOrganization,
  upsertPerson,
  deletePerson,
  deleteOrganization
} from '../libs/sql/index.js';

import {
    escapeHtml,
    formatServerError
} from '../libs/helpers.js'


const orgModal = (() => {
  let client;
  let modal, dialog;
  let orgSelect, orgNameInput, orgAddressInput, orgReferentSelect;
  let personList, addPersonBtn, cancelBtn, deleteBtn, saveBtn;
  let organizations = [], selectedOrgId = null;

  // -----------------------------
  // Initialisation
  // -----------------------------
  async function init() {
    client = await initClient();
    await loadModal();
    await loadOrganizations();
  }

  async function loadModal() {
    if (!document.getElementById('org-modal')) {
      const resp = await fetch(`${window.ENV.BASE_PATH}/pages/org_modal.html`);
      if (!resp.ok) throw new Error('Impossible de charger le modal org');
      const div = document.createElement('div');
      div.innerHTML = await resp.text();
      document.body.appendChild(div);
    }

    modal = document.getElementById('org-modal');
    if (!modal) return;

    dialog = modal.querySelector('.org-modal-dialog');

    orgSelect = dialog.querySelector('#organizationSelect');
    orgNameInput = dialog.querySelector('#organizationName');
    orgAddressInput = dialog.querySelector('#organizationAddress');
    orgReferentSelect = dialog.querySelector('#organizationReferent');
    personList = dialog.querySelector('#personList');
    addPersonBtn = dialog.querySelector('.person-add-btn');
    cancelBtn = dialog.querySelector('.org-btn-cancel');
    saveBtn = dialog.querySelector('.org-btn-save');
    deleteBtn = dialog.querySelector('.org-btn-delete');

    addPersonBtn?.addEventListener('click', onAddPersonClick);
    cancelBtn?.addEventListener('click', close);
    saveBtn?.addEventListener('click', saveOrganization);
    deleteBtn?.addEventListener('click', confirmDeleteOrganization);

    orgSelect?.addEventListener('change', e => {
      const id = e.target.value;
      id ? selectOrganization(id) : reset();
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') close();
    });
  }

  // -----------------------------
  // Open / Close modal
  // -----------------------------
  async function open() {
    await init();
    if (!modal || !dialog) return;
    modal.classList.remove('hidden');
    void dialog.offsetWidth;
    dialog.classList.add('show');
  }

  function close() {
    if (!modal || !dialog) return;
    dialog.classList.remove('show');
    modal.classList.add('hidden');
  }

  // -----------------------------
  // Reset modal
  // -----------------------------
  function reset() {
    selectedOrgId = null;
    orgNameInput.value = '';
    orgAddressInput.value = '';
    personList.innerHTML = '';
    orgReferentSelect.innerHTML = '<option value="">-- Choisir un référent --</option>';
  }

    // -----------------------------
    // Add Person Row
    // -----------------------------
    function addPersonRow(person = {}) {
      const div = document.createElement('div');
      div.className = 'person-item';
      // id = dataset.personId, null/empty pour nouvelles lignes
      div.dataset.personId = person.id ? String(person.id) : '';

      div.innerHTML = `
        <input type="text" placeholder="Nom" class="person-lastname" value="${escapeHtml(person.last_name||'')}" />
        <input type="text" placeholder="Prénom" class="person-firstname" value="${escapeHtml(person.first_name||'')}" />
        <input type="email" placeholder="Email" class="person-email" value="${escapeHtml(person.email||'')}" />
        <input type="text" placeholder="Téléphone" class="person-phone" value="${escapeHtml(person.phone||'')}" />
        <input type="text" placeholder="Rôle" class="person-role" value="${escapeHtml(person.role||'')}" />
        <button type="button" class="person-remove-btn">✕</button>
      `;

      // supprimer la ligne
      div.querySelector('.person-remove-btn').addEventListener('click', () => {
        div.remove();
        updateReferentSelect();
      });

      personList.appendChild(div);
      div.querySelector('.person-firstname')?.focus();
      updateReferentSelect(); // 🔹 mise à jour du select référent à chaque ajout
    }

    // -----------------------------
    // Référent select
    // -----------------------------
    function updateReferentSelect() {
      if (!orgReferentSelect) return;
      const selVal = orgReferentSelect.value;
      orgReferentSelect.innerHTML = '<option value="">-- Choisir un référent --</option>';

      Array.from(personList.children).forEach((div, idx) => {
        const fn = div.querySelector('.person-firstname')?.value.trim();
        const ln = div.querySelector('.person-lastname')?.value.trim();
        let pid = div.dataset.personId;

        if (!pid && fn && ln) {
          // personne nouvellement ajoutée mais pas encore en base
          // générer un identifiant temporaire unique
          pid = `temp-${idx}-${Math.random().toString(36).substr(2, 5)}`;
          div.dataset.personId = pid;
        }

        if (fn && ln) {
          const opt = document.createElement('option');
          opt.value = pid;
          opt.textContent = `${fn} ${ln}`;
          orgReferentSelect.appendChild(opt);
        }
      });

      // restaurer la valeur précédente si toujours disponible
      if (selVal && Array.from(orgReferentSelect.options).some(o => o.value === selVal)) {
        orgReferentSelect.value = selVal;
      }
    }

    
    // -----------------------------
    // Add Person Row
    // -----------------------------
    function onAddPersonClick() {
      addPersonRow();
    }

  // -----------------------------
  // Load organizations
  // -----------------------------
  async function loadOrganizations() {
    if (!client) client = await initClient();
    organizations = await fetchOrganizations(client);
    if (!orgSelect) return;
    orgSelect.innerHTML = '<option value="">-- Choisir une organisation --</option>';
    organizations.forEach(o => {
      const opt = document.createElement('option');
      opt.value = o.id;
      opt.textContent = o.name;
      orgSelect.appendChild(opt);
    });
  }

  // -----------------------------
  // Select organization
  // -----------------------------
  function selectOrganization(id) {
    reset();
    selectedOrgId = id;
    const org = organizations.find(o => String(o.id) === String(id));
    if (!org) return;

    orgNameInput.value = org.name || '';
    orgAddressInput.value = org.address || '';

    if (org.referent_id) {
      addPersonRow({
        id: org.referent_id,
        first_name: org.referent_first_name || '',
        last_name: org.referent_last_name || '',
        email: org.referent_email || '',
        phone: org.referent_phone || '',
        role: 'Référent'
      });
    }

    (org.persons || []).forEach(p => {
      if (org.referent_id && String(p.id) === String(org.referent_id)) return;
      addPersonRow({
        id: p.id,
        first_name: p.first_name,
        last_name: p.last_name,
        email: p.email,
        phone: p.phone,
        role: p.role || ''
      });
    });

    if (!personList.querySelector('.person-item')) addPersonRow();
    updateReferentSelect();
    if (org.referent_id) orgReferentSelect.value = String(org.referent_id);
  }

                  
    async function saveOrganization() {
      setDisabledState(true);

      try {
        const name = orgNameInput.value.trim();
        if (!name) throw new Error('Nom obligatoire');

        const rows = Array.from(personList.querySelectorAll('.person-item'));
        const persons = [];

        for (const row of rows) {
          const fn = row.querySelector('.person-firstname')?.value.trim();
          const ln = row.querySelector('.person-lastname')?.value.trim();
          if (!fn || !ln) continue;

          let pid = row.dataset.personId || null;
          let savedPerson;
            
            const searchPerson = await fetchPersonByName(client, fn, ln);
            if (searchPerson != null) {
                pid = searchPerson.id.toString();
            }

          // INSERT
          if (!pid || pid.startsWith('temp-')) {
              console.log ('before upsertPerson / insert')

            savedPerson = await upsertPerson(client, {
              first_name: fn,
              last_name: ln,
              email: row.querySelector('.person-email')?.value.trim() || null,
              phone: row.querySelector('.person-phone')?.value.trim() || null,
              address: null
            });

            if (savedPerson?.id) {
              row.dataset.personId = String(savedPerson.id);
            }
          }
          // UPDATE
          else {
              console.log ('before upsertPerson / update')

            savedPerson = await upsertPerson(client, {
              id: Number(pid),
              first_name: fn,
              last_name: ln,
              email: row.querySelector('.person-email')?.value.trim() || null,
              phone: row.querySelector('.person-phone')?.value.trim() || null,
              address: null
            });
          }

          if (savedPerson?.id) {
            persons.push({
              id: Number(savedPerson.id),
              role: row.querySelector('.person-role')?.value.trim() || null
            });
          }
        }

        // Référent obligatoire
        let referentId = orgReferentSelect.value;
        if (!referentId) throw new Error('Référent obligatoire');

        // remplacer les pid temporaires par les vrais IDs
        if (referentId.startsWith('temp-')) {
          const refRow = personList.querySelector(`.person-item[data-person-id="${referentId}"]`);
          if (refRow?.dataset.personId && !refRow.dataset.personId.startsWith('temp-')) {
            referentId = refRow.dataset.personId;
          } else {
            // fallback : prendre le premier vrai id dans persons
            referentId = persons.length ? String(persons[0].id) : null;
          }
          if (!referentId) throw new Error('Référent obligatoire');
        }

        const orgData = {
          id: selectedOrgId || null,
          name,
          address: orgAddressInput.value.trim() || null,
          referent_id: Number(referentId),
          persons
        };
          console.log ('before upsertOrganization', orgData)
        const savedOrg = await upsertOrganization(client, orgData);

        // recharger organisations et restaurer la sélection
        await loadOrganizations();
        orgSelect.value = savedOrg.id;

        alert('✅ Organisation enregistrée');
      }

      catch (err) {
        const errMsg = formatServerError(err.message || err);
        console.error('[saveOrganization] Erreur :', errMsg);
        alert(`❌ ${errMsg}`);
      }

      finally {
        setDisabledState(false);
      }
    }


                  
  function setDisabledState(disabled) {
    // Désactive tous les inputs dans le modal
    dialog.querySelectorAll('input, select, button').forEach(el => {
      // On ne désactive pas Cancel, pour pouvoir fermer en cas d’erreur
      if (el.classList.contains('org-btn-cancel')) return;

      el.disabled = disabled;
    });

    // Change l’état du bouton Save visuellement
    if (disabled) {
      saveBtn.textContent = 'Enregistrement...';
    } else {
      saveBtn.textContent = 'Enregistrer';
    }
  }


  // -----------------------------
  // Delete organization
  // -----------------------------
  async function confirmDeleteOrganization() {
    if (!selectedOrgId) return;
    if (!window.confirm('Voulez-vous vraiment supprimer cette organisation ?')) return;
    try {
      await deleteOrganization(client, selectedOrgId);
      const opt = orgSelect.querySelector(`option[value="${selectedOrgId}"]`);
      if (opt) opt.remove();
      orgSelect.value = '';
    } catch (e) { alert('Erreur suppression'); console.error(e); }
  }


  return { open, close };
})();

export const openOrgModal = orgModal.open;
export const closeOrgModal = orgModal.close;


