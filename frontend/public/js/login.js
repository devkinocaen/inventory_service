import { initClient } from './libs/client.js';
import { getRedirectByRole } from './libs/auth/roles.js';
import { parseJwt } from './libs/auth/jwt.js';

import {
    wakeUpFirstAvailable,
    startWakeupRoutine
} from "./libs/ui/wakeup.js";
import {
    fetchPersonByName,
    fetchPersonByEmail,
    fetchOrganizationsByPersonId
} from './libs/sql/index.js'

import  {
    formatServerError
} from './libs/helpers.js'

const client = await initClient();

/**
 * Réinitialise complètement la session client et le localStorage
 */
function resetSession() {
   // console.log ("Reset session info")
    localStorage.removeItem("loggedUser");
    
    // Supprime les états des formulaires par onglet
    window.__tabFormStates = {};
    localStorage.removeItem('tabFormStates');
    localStorage.removeItem('currentTabIndex');
    localStorage.removeItem('currentDataBase');

    
  if (client && typeof client.reset === 'function') {
    client.reset();
  }
}

// 🔹 Met à jour le bandeau selon HEADER_IMAGE_URL
const bandeauImg = document.getElementById("bandeau-img");
if (bandeauImg) {
  if (window.ENV?.HEADER_IMAGE_URL) {
    bandeauImg.src = window.ENV.HEADER_IMAGE_URL;
  } else {
    // fallback si HEADER_IMAGE_URL non défini
    bandeauImg.src = "./images/bandeau_costumerie.png";
  }
}

const loginForm = document.getElementById("login-form");
const submitBtn = loginForm?.querySelector("button[type=submit]");
const anonymousLoginBtn = document.getElementById("anonymous-login");

if (!loginForm || !submitBtn) {
  console.error("❌ Formulaire ou bouton introuvable !");
} else {
  // 🔹 Désactive le bouton par défaut
  submitBtn.disabled = true;
  submitBtn.textContent = "⏳ Réveil des services…";

// stocke la base
const dbSelect = document.getElementById("database");
if (!dbSelect) {
  console.error("❌ Sélecteur de base introuvable !");
} else {
  // 🔹 Vider les options existantes (sauf l'option par défaut)
  const defaultOption = dbSelect.querySelector("option[value='']");
  dbSelect.innerHTML = "";
  if (defaultOption) dbSelect.appendChild(defaultOption);

  (async () => {
    try {
      const databases = await client.listDatabases(true); // DEBUG = true pour log
      if (!Array.isArray(databases)) throw new Error("Format de réponse invalide");

      if (window.ENV?.DB_NAME) {
        // 🔹 Vérifie que DB_NAME existe dans les bases
        const matched = databases.find(b => b.baseid === window.ENV.DB_NAME);
        if (matched) {
          const option = document.createElement("option");
          option.value = matched.baseid;
          option.textContent = matched.basename;
          dbSelect.appendChild(option);

          dbSelect.value = matched.baseid;
          dbSelect.disabled = true; // verrouille le select
          window.ENV.SELECTED_DB = matched.baseid;

          console.log(`🌐 Base forcée à ${matched.baseid} (${matched.basename})`);
        } else {
          console.warn(`⚠️ DB_NAME=${window.ENV.DB_NAME} non trouvée dans les bases disponibles`);
        }
      } else {
        // 🔹 Cas classique : liste complète
        databases.forEach(base => {
          const option = document.createElement("option");
          option.value = base.baseid;
          option.textContent = base.basename;
          dbSelect.appendChild(option);
        });

        window.ENV.SELECTED_DB = dbSelect.value;
        console.log("🌐 Bases chargées :", databases.map(b => b.baseid));
      }
    } catch (err) {
      console.error("❌ Impossible de charger la liste des bases :", err);
      alert("Erreur : impossible de récupérer la liste des bases disponibles.");
    }
  })();

  // 🔹 Stocke la base choisie dans ENV à chaque changement (si le select est actif)
  dbSelect.addEventListener("change", (e) => {
    if (!dbSelect.disabled) {
      const selectedDb = e.target.value;
      window.ENV = window.ENV || {};
      window.ENV.SELECTED_DB = selectedDb;
      console.log("🌐 Base sélectionnée :", selectedDb);
    }
  });

    if (anonymousLoginBtn) {
      anonymousLoginBtn.addEventListener("click", async (e) => {
        e.preventDefault();

      // 🔹 Vérifie si l'auth n'est pas bypassée
      if (!window.ENV?.ANON_AUTH) {
          // ANON_AUTH n'existe pas ou vaut false/0 => refuser
          alert("La connexion anonyme est désactivée.");
          return;
      }

        console.log("👤 tentative connexion anonyme");

        // 🔹 Vérifie la base
        const selectedDb = window.ENV?.SELECTED_DB || dbSelect?.value;
        if (!selectedDb) {
          alert("❌ Sélectionnez d'abord une base");
          return;
        }

        try {
          // 🔹 Reset complet (comme un vrai login)
          resetSession();

          // 🔹 Stocke la base AVANT l'appel
          localStorage.setItem("currentDataBase", selectedDb);

          // 🔹 Initialisation client si nécessaire
          const client = await initClient();

          // 🔹 Appel backend → JWT anonyme
          const accessToken = await client.anonymousSignIn();

          // 🔹 Session utilisateur cohérente
          const loggedUser = {
            email: null,
            role: "anonymous",
            firstName: "Invité",
            lastName: "",
            personId: null,
            accessToken,
            isAnonymous: true,
            loginAt: new Date().toISOString()
          };

          localStorage.setItem("loggedUser", JSON.stringify(loggedUser));

          console.log("✅ Connexion anonyme réussie", loggedUser);

          // 🔹 Redirection
          const redirectUrl = getRedirectByRole("anonymous");
          window.location.href = redirectUrl;

        } catch (err) {
          console.error("❌ Erreur connexion anonyme :", err);
          alert("Impossible de se connecter anonymement.");
        }
      });
    }

}


   // 🌞 Réveille les services python flask existant avant de permettre la connexion
   if (window.ENV.DB_CLIENT.includes('python_flask')) {
     // 🌞 Réveille les services avant de permettre la connexion
     (async () => {
       submitBtn.disabled = true;
       submitBtn.textContent = "⏳ Réveil des services…";

       try {
         const urls = window.ENV.API_REST_URLS || [];
         if (!urls.length) throw new Error("Aucun serveur configuré pour wake-up !");

         // ⚡ Wake-up avec fallback automatique
         const usedUrl = await wakeUpFirstAvailable(urls);
         console.log("☀️ Services réveillés :", usedUrl);

         // ⚡ Mettre à jour ENV pour que le client utilise ce service
         window.ENV.SELECTED_SERVICE = usedUrl;
         client.baseUrl = usedUrl; // si ton client est importé comme objet singleton

         // 🔁 Démarre la routine anti-sommeil
         const intervalSec = window.ENV.SERVICE_WAKEUP_INTERVAL || 660; // 11 min par défaut
         startWakeupRoutine([usedUrl], intervalSec);

       } catch (err) {
         console.error("❌ Aucun serveur disponible :", err);
         alert("Erreur : services indisponibles. Réessayez plus tard.");
       } finally {
         submitBtn.disabled = false;
         submitBtn.textContent = "Se connecter";
       }
     })();
   } else {
     // DB autre que flask → bouton actif directement
     submitBtn.disabled = false;
     submitBtn.textContent = "Se connecter";
   }



  loginForm.addEventListener("submit", async (e) => {
      if (mode !== "login") return;
      e.preventDefault();

      const email = document.getElementById("email")?.value.trim(); // email ou téléphone
      const password = document.getElementById("password")?.value.trim();
 
      // 🔹 Vérifie que les champs sont remplis
      if (!email || !password) {
        alert("❌ Email ou téléphone et mot de passe requis");
        return;
      }

      // 🔹 Fonction de validation email ou téléphone
      function isValidContact(value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const phoneRegex = /^\+?\d{7,15}$/; // chiffres seulement, optionnel +
        return emailRegex.test(value) || phoneRegex.test(value);
      }

      if (!isValidContact(email)) {
        alert("❌ Veuillez entrer un email ou un numéro de téléphone valide");
        return;
      }

      try {
        // ⚠️ Mode ANON_AUTH pour tests
 /*       if (window.ENV?.ANON_AUTH) {
          console.warn("⚠️ ANON_AUTH activé → connexion anonyme");
          const redirectUrl = getRedirectByRole('');
        //  window.location.href = redirectUrl;
            console.log(`➡️ Redirection ANONYME vers : ${redirectUrl}`);
          return;
        }
*/
        // 🔹 Réinitialisation complète avant nouveau login
        resetSession();

        submitBtn.disabled = true;
        submitBtn.textContent = "🔐 Connexion…";
                             
         // Stockage de la base sélectionnée dans localStorage
         if (window.ENV?.SELECTED_DB) {
             localStorage.setItem('currentDataBase', window.ENV.SELECTED_DB);
         } else {
             alert("❌ Sélectionnez d'abord une base");

         }

        // 🌐 Connexion via le client
        const accessToken = await client.signIn(email, password);

        if (!accessToken) {
          alert("❌ Email ou mot de passe incorrect");
          submitBtn.disabled = false;
          submitBtn.textContent = "Se connecter";
          return;
        }

        const claims = parseJwt(accessToken);
        const role = claims?.app_metadata?.role || 'anon';
        const userEmail = claims?.email || '';
        let firstName = ''
        let lastName = ''
        // stocke le person_id par défaut
        let personId = null;
        console.log ('claims', claims)
        console.log ('userEmail', userEmail)
                             
        if (client) {
          try {
            const person = await fetchPersonByEmail(client, userEmail);
            console.log ("fetchPersonByEmail", fetchPersonByEmail)
            if (person && !isNaN(Number(person.id))) {
              personId = person.id;
              firstName = person.first_name;
              lastName = person.last_name;

              console.log("utilisateur identifié:", firstName, lastName, person);
            } else {
              console.log("utilisateur NON identifié (aucune correspondance)");
              alert('Email non reconnu : ' + email);
              submitBtn.disabled = false;
              submitBtn.textContent = "Se connecter";
              return;
            }

          } catch (err) {
            alert('Erreur lors de la suppression : ' + formatServerError(err));
            console.error(err);
          }

        } else {
          console.log("client NON initialisé");
        }

     
          
         // 🔹 Stockage local isolé
        localStorage.setItem("loggedUser", JSON.stringify({
          email,
          role,
          firstName,
          lastName,
          personId,
          accessToken,
          loginAt: new Date().toISOString()
        }));
        const loggedUser = JSON.parse(localStorage.getItem("loggedUser") || "{}");

        // 🔹 Redirection
        const redirectUrl = getRedirectByRole(role);
        console.log(`➡️ Redirection vers : ${redirectUrl}`);
        window.location.href = redirectUrl;

      } catch (err) {
        console.error("❌ Exception lors de la connexion :", err);

        // Alert spécifique pour email/password incorrect
        if (err.message?.includes("Invalid credentials") || err.message?.includes("401")) {
          alert("❌ Email ou mot de passe incorrect");
        } else {
          alert("❌ Erreur lors de la connexion : " + (err.message || err));
        }

        submitBtn.disabled = false;
        submitBtn.textContent = "Se connecter";
      }

  });
}


// -------------------------------------------------------------
// 🔄 GESTION DU MODE CREATION DE COMPTE
// -------------------------------------------------------------

const switchToCreateBtn = document.getElementById("switch-to-create");
const switchToLoginBtn = document.getElementById("switch-to-login");
const createFields = document.querySelectorAll(".create-field");
//const passwordBlock = document.getElementById("password-block");
const mainSubmitBtn = document.getElementById("main-submit");
const isIndividualCheckbox = document.getElementById("is_individual");
const orgInput = document.getElementById("organisation");
const roleInput = document.getElementById("role");
let mode = "login"; // login | create


if (isIndividualCheckbox && orgInput && roleInput) {
  isIndividualCheckbox.addEventListener("change", (e) => {
    if (e.target.checked) {
      // particulier → vide et verrouille les champs
      orgInput.value = "";
      roleInput.value = "";
      orgInput.disabled = true;
      roleInput.disabled = true;
      roleInput.hidden = true;
      orgInput.hidden = true;
    } else {
      // sinon → réactive
      orgInput.disabled = false;
      roleInput.disabled = false;
      roleInput.hidden = false;
      orgInput.hidden = false;
    }
  });
}


function updateFormMode() {
  if (mode === "create") {
    // Affiche tous les champs de création
    createFields.forEach(f => f.style.display = "block");

    // Bouton principal
    mainSubmitBtn.textContent = "Créer un compte";
    mainSubmitBtn.disabled = false;

    // Affiche bouton retour à login, masque bouton créer
    if (switchToLoginBtn) switchToLoginBtn.style.display = "inline-block";
    if (switchToCreateBtn) switchToCreateBtn.style.display = "none";

  } else {
    // Masque tous les champs de création
    createFields.forEach(f => f.style.display = "none");

    // Bouton principal
    mainSubmitBtn.textContent = "Se connecter";
    submitBtn.disabled = false;

    // Affiche bouton créer, masque bouton retour à login
    if (switchToCreateBtn) switchToCreateBtn.style.display = "inline-block";
    if (switchToLoginBtn) switchToLoginBtn.style.display = "none";
  }
}


// 🎯 Bouton « Créer un compte »
switchToCreateBtn.addEventListener("click", (e) => {
  e.preventDefault();
  mode = "create";
  mainSubmitBtn.textContent = "Créer un compte";
  updateFormMode();
});

// 🎯 Bouton « Retour à la connexion »
switchToLoginBtn.addEventListener("click", (e) => {
                                  console.log ("ici")

  e.preventDefault();
  mode = "login";
  mainSubmitBtn.textContent = "Se connecter";
  updateFormMode();
});
// -------------------------------------------------------------
// 📨 SUBMIT MODE CREATION — récupération + client.signup
// -------------------------------------------------------------
loginForm.addEventListener("submit", async (e) => {
  if (mode !== "create") return;

  e.preventDefault();

  // 🔍 Champs
  const data = {
    prenom: document.getElementById("prenom")?.value.trim() || "",
    nom: document.getElementById("nom")?.value.trim() || "",
    organisation: document.getElementById("organisation")?.value.trim() || "",
    address: document.getElementById("adresse")?.value.trim() || "",
    telephone: document.getElementById("telephone")?.value.trim() || "",
    email: document.getElementById("email")?.value.trim() || "",
    role: document.getElementById("role")?.value.trim() || "viewer",
    password: document.getElementById("password")?.value || "",
    passwordConfirm: document.getElementById("passwordConfirm")?.value || "",
    base: document.getElementById("database")?.value || "",
    isIndividual: isIndividualCheckbox.checked


  };

  // 🔍 Vérifications obligatoires
  if (!data.prenom || !data.nom || (!data.organisation  && !data.isIndividual) || !data.base) {
    alert("❌ Merci de remplir tous les champs obligatoires.");
    return;
  }

  if (!data.password || !data.passwordConfirm) {
    alert("❌ Merci de saisir le mot de passe et sa confirmation.");
    return;
  }

  if (data.password !== data.passwordConfirm) {
    alert("❌ Les mots de passe ne correspondent pas.");
    return;
  }

  // 🗄️ Enregistre la base choisie dans le localStorage
  localStorage.setItem("currentDataBase", data.base);

  try {
    // 🌐 Création du compte via client.signup
    const result = await client.signUp({
      email: data.email,
      password: data.password,
      firstName: data.prenom,
      lastName: data.nom,
      phone: data.telephone,
      organization: data.organisation,
      address: data.address,
      isIndividual: data.isIndividual,
      role: data.role
    });

    console.log("✨ Signup OK :", result);
    alert("✔ Compte créé avec succès !");
      
      // 🔄 Après création → on repasse en mode login + on remplit email et mot de passe
      mode = "login";
      updateFormMode();

      // Remplit les champs login avec les valeurs de création
      document.getElementById("email").value = data.email;
      document.getElementById("password").value = data.password;

      // Débloque bouton connexion
      submitBtn.disabled = false;
      mainSubmitBtn.textContent = "Se connecter";

      // Force l'affichage du bon bouton
      if (switchToCreateBtn) switchToCreateBtn.style.display = "inline-block";
      if (switchToLoginBtn) switchToLoginBtn.style.display = "none";

      // Focus sur le bouton
      mainSubmitBtn.focus();

      
  } catch (err) {
    console.error("❌ Erreur signup:", err);

    const msg = err?.message || err?.toString() || "Impossible de créer le compte.";

    alert("❌ Erreur : " + msg);
  }
});
