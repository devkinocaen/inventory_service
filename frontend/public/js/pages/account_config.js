import { initClient } from '../libs/client.js';
import { upsertPerson, deletePerson, upsertOrganization, fetchOrganizationsByPersonId } from '../libs/sql/index.js';

let client;
await initClient().then(c => client = c);

// Données locales
let people = [];
let editingId = null;

// ====== UI ELEMENTS ======
const pLast = document.getElementById("pLast");
const pFirst = document.getElementById("pFirst");
const pEmail = document.getElementById("pEmail");
const pPhone = document.getElementById("pPhone");
const pRole = document.getElementById("pRole");
const peopleList = document.getElementById("peopleList");

const orgName = document.getElementById("orgName");
const orgAddress = document.getElementById("orgAddress");
const saveOrgBtn = document.getElementById("saveOrgBtn");

const refLastName = document.getElementById("refLastName");
const refFirstName = document.getElementById("refFirstName");
const refEmail = document.getElementById("refEmail");
const refPhone = document.getElementById("refPhone");
const saveRefBtn = document.getElementById("saveRefBtn");

const pwdCurrent = document.getElementById("pwdCurrent");
const pwdNew = document.getElementById("pwdNew");
const pwdConfirm = document.getElementById("pwdConfirm");

// ====== RENDER PEOPLE ======
function renderPeople() {
  peopleList.innerHTML = "";
  people.forEach(p => {
    const row = document.createElement("div");
    row.className = "person-row";
    row.innerHTML = `
      <span>${p.last}</span>
      <span>${p.first}</span>
      <span>${p.role || ''}</span>
      <button class="btn btn-small btn-edit" data-id="${p.id}">✎</button>
      <button class="btn btn-small btn-delete" data-id="${p.id}">✕</button>
    `;
    peopleList.appendChild(row);
  });

  peopleList.querySelectorAll(".btn-edit").forEach(btn => {
    btn.onclick = () => editPerson(Number(btn.dataset.id));
  });
  peopleList.querySelectorAll(".btn-delete").forEach(btn => {
    btn.onclick = () => removePerson(Number(btn.dataset.id));
  });
}
renderPeople();

// ====== PERSON CRUD ======
async function savePerson() {
  const last = pLast.value.trim();
  const first = pFirst.value.trim();
  const email = pEmail.value.trim() || null;
  const phone = pPhone.value.trim() || null;
  const role = pRole.value.trim() || null;

  if (!first || !last) { alert("Nom + Prénom requis"); return; }

  if (editingId) {
    const idx = people.findIndex(p => p.id === editingId);
    people[idx] = { id: editingId, last, first, email, phone, role };
    try {
      await upsertPerson(client, people[idx]);
    } catch(e) { console.error(e); alert("Erreur update"); }
    editingId = null;
  } else {
    const newPerson = { id: Date.now(), last, first, email, phone, role };
    try {
      const saved = await upsertPerson(client, newPerson);
      newPerson.id = saved.id || newPerson.id;
      people.push(newPerson);
    } catch(e) { console.error(e); alert("Erreur création"); return; }
  }

  pLast.value = pFirst.value = pEmail.value = pPhone.value = pRole.value = "";
  renderPeople();
}

function editPerson(id) {
  const p = people.find(p => p.id === id);
  if (!p) return;
  editingId = id;
  pLast.value = p.last;
  pFirst.value = p.first;
  pEmail.value = p.email || "";
  pPhone.value = p.phone || "";
  pRole.value = p.role || "";
}

async function removePerson(id) {
  if (!confirm("Supprimer cette personne ?")) return;
  try {
    const p = people.find(p => p.id === id);
    if (p) await deletePerson(client, { first_name: p.first, last_name: p.last });
    people = people.filter(p => p.id !== id);
    renderPeople();
  } catch(e) { console.error(e); alert("Erreur suppression"); }
}

// ====== ORGANISATION ======
// désactiver bouton tant que nom/adresse pas modifiés
saveOrgBtn.disabled = true;

function checkOrgEdited() {
  const edited = orgName.value.trim() !== "" || orgAddress.value.trim() !== "";
  saveOrgBtn.disabled = !edited;
}
orgName.addEventListener("input", checkOrgEdited);
orgAddress.addEventListener("input", checkOrgEdited);

saveOrgBtn.onclick = async () => {
  try {
    await upsertOrganization(client, {
      id: null,
      name: orgName.value.trim(),
      address: orgAddress.value.trim() || null,
      referent_id: null,
      persons: people
    });
    alert("Organisation enregistrée");
    saveOrgBtn.disabled = true;
  } catch(e){ console.error(e); alert("Erreur organisation"); }
};

// ====== REFERENT ======
saveRefBtn.disabled = true;

function checkRefEdited() {
  const edited = refFirstName.value.trim() !== "" || refLastName.value.trim() !== "";
  saveRefBtn.disabled = !edited;
}
refFirstName.addEventListener("input", checkRefEdited);
refLastName.addEventListener("input", checkRefEdited);

saveRefBtn.onclick = async () => {
  const first = refFirstName.value.trim();
  const last = refLastName.value.trim();
  if (!first || !last) { alert("Nom + Prénom requis"); return; }
  try {
    await upsertPerson(client, {
      first_name: first,
      last_name: last,
      email: refEmail.value.trim() || null,
      phone: refPhone.value.trim() || null
    });
    alert("Référent sauvegardé");
    saveRefBtn.disabled = true;
  } catch(e){ console.error(e); alert("Erreur référent"); }
};

// ====== PASSWORD ======
document.getElementById("changePwdBtn").onclick = () => {
  if (pwdNew.value !== pwdConfirm.value) { alert("Confirmation incorrecte"); return; }
  alert("TODO: change_password()");
};

// ====== SAVE PERSON ======
document.getElementById("savePersonBtn").onclick = savePerson;

// ====== AUTO-FILL FROM LOGGEDUSER ======
async function fillOrganizationFromLoggedUser() {
  try {
    const raw = localStorage.getItem("loggedUser");
    if (!raw) return;
    const loggedUser = JSON.parse(raw);
    const personId = loggedUser?.personId;
    if (!personId) return;

    const orgs = await fetchOrganizationsByPersonId(client, personId);
    if (!orgs || orgs.length === 0) return;
    const org = orgs[0];

    orgName.value = org.name || "";
    orgAddress.value = org.address || "";
    checkOrgEdited(); // met à jour bouton

    if (org.referent_id) {
      refFirstName.value = org.referent_first_name || "";
      refLastName.value = org.referent_last_name || "";
      refEmail.value = org.referent_email || "";
      refPhone.value = org.referent_phone || "";
      checkRefEdited();
    }

    if (Array.isArray(org.persons)) {
      people = org.persons.map(p => ({
        id: p.id,
        first: p.first_name,
        last: p.last_name,
        email: p.email,
        phone: p.phone,
        role: p.role || null
      }));
      renderPeople();
    }
  } catch(e) {
    console.error("Erreur fillOrganizationFromLoggedUser :", e);
  }
}

await fillOrganizationFromLoggedUser();
