import { initClient } from './libs/client.js';
import { getRedirectByRole } from './libs/auth/roles.js';
import { parseJwt } from './libs/auth/jwt.js';
import { wakeUpFirstAvailable, startWakeupRoutine } from "./libs/ui/wakeup.js";


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

const loginForm = document.getElementById("login-form");
const submitBtn = loginForm?.querySelector("button[type=submit]");

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

  // 🔹 Charger dynamiquement la liste des bases depuis le serveur Flask
  (async () => {
    try {
      const databases = await client.listDatabases(true); // DEBUG = true pour log
      if (!Array.isArray(databases)) throw new Error("Format de réponse invalide");

      databases.forEach(base => {
        const option = document.createElement("option");
        option.value = base.baseid;
        option.textContent = base.basename;
        dbSelect.appendChild(option);
      });

      console.log("✅ Bases chargées depuis le serveur :", databases);
    } catch (err) {
      console.error("❌ Impossible de charger la liste des bases :", err);
      alert("Erreur : impossible de récupérer la liste des bases disponibles.");
    }
  })();

  // 🔹 Stocke la base choisie dans ENV à chaque changement
  dbSelect.addEventListener("change", (e) => {
    const selectedDb = e.target.value;
    window.ENV = window.ENV || {};
    window.ENV.SELECTED_DB = selectedDb;
    console.log("🌐 Base sélectionnée :", selectedDb);
  });

  // 🔹 Initialiser avec la valeur par défaut
  window.ENV = window.ENV || {};
  window.ENV.SELECTED_DB = dbSelect.value;
  console.log("🌐 Base initiale :", dbSelect.value);
}

   // 🌞 Réveille les services Render avant de permettre la connexion
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
//      console.log ('email',email)
//      console.log ('password', password)
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
        // ⚠️ Mode NO_AUTH pour tests
        if (window.ENV?.NO_AUTH) {
          console.warn("⚠️ NO_AUTH activé → connexion anonyme");
          const redirectUrl = getRedirectByRole('');
          window.location.href = redirectUrl;
          return;
        }

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
        // console.log ('claims?.app_metadata', claims?.app_metadata)
         const firstName = claims?.first_name || claims?.app_metadata?.first_name || '';
         const lastName  = claims?.last_name  || claims?.app_metadata?.last_name  || '';
   
         // 🔹 Stockage local isolé
        localStorage.setItem("loggedUser", JSON.stringify({
          email,
          role,
          firstName,
          lastName,
          accessToken,
          loginAt: new Date().toISOString()
        }));
                            
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
const passwordBlock = document.getElementById("password-block");
const mainSubmitBtn = document.getElementById("main-submit");

let mode = "login"; // login | create

function updateFormMode() {
  if (mode === "create") {

    // ➕ afficher les champs spécifiques
    createFields.forEach(f => f.style.display = "block");

    // ➖ masquer mot de passe
    passwordBlock.style.display = "none";

    // 🔘 adapter le bouton principal
    mainSubmitBtn.textContent = "Créer un compte";
    mainSubmitBtn.disabled = false; // création toujours autorisée

    // 🔁 afficher bouton retour
    switchToCreateBtn.style.display = "none";
    switchToLoginBtn.style.display = "inline-block";

  } else {

    // ➖ masquer champs création
    createFields.forEach(f => f.style.display = "none");

    // ➕ réafficher mot de passe
    passwordBlock.style.display = "block";

    // 🔘 revenir au mode connexion
    mainSubmitBtn.textContent = "Se connecter";

    // ⚠️ Le code original gère l’activation/désactivation du bouton
    // → on ne touche PAS à ton système
    submitBtn.disabled = false;

    switchToCreateBtn.style.display = "inline-block";
    switchToLoginBtn.style.display = "none";
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
    base: document.getElementById("database")?.value || ""
  };

  // 🔍 Vérifications obligatoires
  if (!data.prenom || !data.nom || !data.organisation || !data.base) {
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
      role: data.role
    });

    console.log("✨ Signup OK :", result);
    alert("✔ Compte créé avec succès !");
  } catch (err) {
    console.error("❌ Erreur signup:", err);

    const msg = err?.message || err?.toString() || "Impossible de créer le compte.";

    alert("❌ Erreur : " + msg);
  }
});
