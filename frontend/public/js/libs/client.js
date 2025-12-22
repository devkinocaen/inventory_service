import { wakeUpFirstAvailable, startWakeupRoutine } from "./ui/wakeup.js";
import { decodeUnicode } from "./helpers.js";
import { parseJwt, isTokenExpired } from "./auth/jwt.js";
import { resizeImageToMaxSize } from './image_utils.js';

export async function initClient() {
// 🌞 Premier wake-up (avec fallback éventuel)
const urls = window.ENV.API_REST_URLS || [];
if (!urls.length) throw new Error("❌ Aucun serveur configuré !");


const selectedUrl = await wakeUpFirstAvailable(urls);
console.log("☀️ Tous les services sont réveillés");
    window.ENV.SELECTED_SERVICE = selectedUrl;
    console.log("☀️ Service sélectionné :", selectedUrl);
    
// 🔁 Lancement de la routine anti-sommeil
const intervalSec = window.ENV.SERVICE_WAKEUP_INTERVAL || 660; // 11 min par défaut
startWakeupRoutine(urls, intervalSec);

const baseUrl = selectedUrl;

const client = {
baseUrl,
token: null, // JWT stocké après login

    // ==============================
    // DATABASES LIST
    // ==============================
    async listDatabases(DEBUG = false) {
      // Pas besoin de token pour cette route publique (si tu veux la protéger, ajoute this.ensureValidToken(true))
      const url = `${this.baseUrl}/databases`;

      if (DEBUG) console.log("🔹 Fetching database list:", url);

      const res = await fetch(url);

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`GET /databases failed (${res.status}): ${text}`);
      }

      const data = await res.json();

      if (DEBUG) console.log("✅ Database list received:", data);

      // On attend une structure du type: { databases: [ { basename, baseid }, ... ] }
      if (!data.databases || !Array.isArray(data.databases)) {
        throw new Error("Format de réponse inattendu pour /databases");
      }

      return data.databases;
    },
    
    
    // ==============================
    // Auth anonymous sign-in
    // ==============================
    async anonymousSignIn() {
      const idBase = localStorage.getItem("currentDataBase");
      if (!idBase) {
        alert("❌ Aucun identifiant de base défini !");
        throw new Error("Aucun identifiant de base défini");
      }

      const res = await fetch(`${this.baseUrl}/anonymous_login/${idBase}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Anonymous login failed: ${decodeUnicode(text)}`);
      }

      const data = await res.json();

      if (!data?.access_token) {
        console.error("❌ Anonymous login failed: no token returned");
        throw new Error("Anonymous login failed: no token returned");
      }

      this.token = data.access_token;

      console.log("👤 Connexion anonyme réussie");
      return this.token;
    },

    // ==============================
    // Auth sign-in
    // ==============================
    async signIn(email, password) {
        
        const idBase = localStorage.getItem("currentDataBase");
        if (!idBase) {
            alert("❌ Aucun identifiant de base défini ! Veuillez sélectionner une base avant de continuer.");
            throw new Error("Aucun identifiant de base défini");
        }
        
      const res = await fetch(`${baseUrl}/login/${idBase}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const text = await res.text();
          throw new Error(`Login failed: ${decodeUnicode(text)}`);
      }

      const data = await res.json();

      if (!data?.access_token) {
        console.error("❌ Login failed: no token returned");
        throw new Error("Login failed: no token returned");
      }

      this.token = data.access_token;
      return this.token;
    },

    async signOut() {
      this.token = null;
      console.log("⚠️ Token supprimé, utilisateur déconnecté");
    },

    async getUserRole() {
      if (!this.token) {
        console.error("❌ getUserRole failed: token is undefined");
        throw new Error("getUserRole failed: token is undefined");
      }

      const payload = parseJwt(this.token);
      if (!payload) throw new Error("Erreur décodage JWT");

      // Vérifie que le role à la racine est bien 'authenticated'
      if (payload.role !== "authenticated") {
        console.error("❌ JWT root role invalide:", payload.role);
        throw new Error("JWT root role invalide: " + payload.role);
      }

      // Récupère le rôle réel dans app_metadata
      const role = payload?.app_metadata?.role;
      if (!role) {
        console.warn("⚠️ app_metadata.role est vide dans le JWT", payload);
      }

      return role || null;
    },
    
    // ==============================
    // Auth sign-up via backend /signup
    // ==============================
    async signUp({
      firstName,
      lastName,
      email,
      password,
      phone,
      organization,
      address,
      role,
      isIndividual = false   // ✅ virgule ajoutée
    }) {
      // 1) Vérifier la base sélectionnée
      const databaseId = localStorage.getItem("currentDataBase");
      if (!databaseId) {
        alert("❌ Aucun identifiant de base sélectionné !");
        throw new Error("Aucun identifiant de base défini dans localStorage");
      }

      // 2) Vérifications simples
        if (!firstName || !lastName || (!organization && !isIndividual) || !email || !password) {
        throw new Error(
          "Prénom, nom, email, mot de passe sont obligatoires."
        );
      }

      try {
        // 3) Appel à la route backend /signup
        const res = await fetch(`${baseUrl}/signup/${databaseId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName,
            lastName,
            email,
            password,
            phone,
            organization,
            address,
            role,
            isIndividual      // ✅ enlever '= false' ici
          }),
        });

        let data;
        try {
          data = await res.json(); // essaie de parser JSON
        } catch (err) {
          data = null; // réponse non-JSON
        }

        if (!res.ok) {
          console.log("❌ Signup error response:", data || await res.text());
          throw new Error((data && data.error) || `HTTP ${res.status} ${res.statusText}`);
        }

        console.log("📦 Compte créé via backend signup:", data);
        return data;

      } catch (err) {
        let msg = "Erreur interne pendant l'appel réseau";
        if (err?.message) msg = err.message;
        else if (typeof err === "string") msg = err;
        else msg = JSON.stringify(err, null, 2);

        throw new Error(`Fetch error: ${msg}`);
      }
    }, 
    

                         
     // ==============================
     // Vérification du token avant appels
     // ==============================
    ensureValidToken(useExpirationDate = false) {
        if (!this.token) {
             const stored = JSON.parse(localStorage.getItem("loggedUser") || "{}");
             this.token = stored?.accessToken || null;
        }

        if (!this.token) {
             alert("❌ Aucun token disponible, merci de vous reconnecter.");
             throw new Error("Aucun token disponible");
        }

        if (useExpirationDate && isTokenExpired(this.token)) {
             console.warn("⚠️ Token expiré, déconnexion forcée");
             this.signOut();
             alert("⏰ Votre session a expiré. Merci de vous reconnecter.");
             throw new Error("Session expirée");
        }
     },
    // ==============================
    // RPC
    // ==============================
    async rpc(functionName, params = {}, DEBUG = false) {
      this.ensureValidToken(true);

      const idBase = localStorage.getItem("currentDataBase");
      if (!idBase) {
        alert("❌ Aucun identifiant de base défini !");
        throw new Error("Aucun identifiant de base défini");
      }

      if (DEBUG) {
        const payload = parseJwt(this.token);
        console.log("🔍 JWT payload:", payload);
        const role = payload?.app_metadata?.role;
        if (role) console.log("✅ JWT role OK:", role);
      }

      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
      };

      const options = {
        method: "POST",
        headers,
        body: JSON.stringify(params || {}),
      };

      if (DEBUG) {
        console.log("functionName ", functionName);
        console.log(" -- with options", options);
      }

      let res;
      try {
        // 🛑 Attrape absolument TOUT ce que fetch peut throw
      //  console.log(`fetching ${this.baseUrl}/rpc/${idBase}/${functionName}`);
        res = await fetch(`${this.baseUrl}/rpc/${idBase}/${functionName}`, options);
      } catch (err) {
        let msg = "Erreur interne pendant l'appel réseau";
        if (err?.message) msg = err.message;
        else if (typeof err === "string") msg = err;
        else msg = JSON.stringify(err, null, 2);

        throw new Error(`Fetch error: ${msg}`);
      }

      // ------------------- Décodage JSON ou texte -------------------
      let payload = null;
      try {
        payload = await res.json();
      } catch (_) {
        // fallback si pas JSON
        payload = { text: await res.text() };
      }

      if (DEBUG) console.log(`🔹 RPC ${functionName} response:`, res);
      if (DEBUG) console.log(`🔹 RPC ${functionName} payload:`, payload);

      // ------------------- Gestion propre des erreurs -------------------
      if (!res.ok) {
        let errMsg = `Erreur HTTP ${res.status}`;

        if (payload) {
          if (payload.error) {
            // payload.error peut être string ou objet
            if (typeof payload.error === "string") {
              errMsg = payload.error;
            } else if (typeof payload.error === "object" && payload.error.message) {
              errMsg = payload.error.message; // ✅ Extraction du vrai message
            } else {
              errMsg = JSON.stringify(payload.error);
            }
          } else if (payload.detail) {
            errMsg = payload.detail;
          } else if (payload.details) {
            errMsg = payload.details;
          } else if (payload.message) {
            errMsg = payload.message;
          } else if (payload.text) {
            errMsg = payload.text;
          }
        }

        throw new Error(errMsg);
      }
      // ------------------------------------------------------------------

      return payload;
    }
,


    // ==============================
    // GET
    // ==============================
     async get(path) {
         this.ensureValidToken();

         const headers = { Authorization: `Bearer ${this.token}` };
         const res = await fetch(`${baseUrl}${path}`, { headers });
         if (!res.ok) {
           const text = await res.text();
           throw new Error(`GET ${path} failed (${res.status}): ${text}`);
         }
         return res.json();
    },
        
    // ==============================
    // BACKUP LIST
    // ==============================
    async listBackups(DEBUG = false) {
      this.ensureValidToken(true);

      const idBase = localStorage.getItem("currentDataBase");
      if (!idBase) {
        alert("❌ Aucun identifiant de base défini !");
        throw new Error("Aucun identifiant de base défini");
      }

      const headers = {
        Authorization: `Bearer ${this.token}`,
      };

      if (DEBUG) console.log("🔹 Fetching backup list for database:", idBase);

      const res = await fetch(`${this.baseUrl}/backup-list/${idBase}`, { headers });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`GET /backup-list failed (${res.status}): ${text}`);
      }

      const data = await res.json();
      if (DEBUG) console.log("🔹 Backup list response:", data);

      // S'assure que backups est un tableau avant de le renvoyer
      const backups = Array.isArray(data.backups) ? data.backups : [];
      return backups;
    },

    // ==============================
    // BACKUP (create a new backup)
    // ==============================
    async createBackup(DEBUG = false) {
      this.ensureValidToken(true);

      const idBase = localStorage.getItem("currentDataBase");
      if (!idBase) {
        alert("❌ Aucun identifiant de base défini !");
        throw new Error("Aucun identifiant de base défini");
      }

      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
      };

      if (DEBUG) console.log("🔹 Creating backup for database:", idBase);

      const res = await fetch(`${this.baseUrl}/backup/${idBase}`, {
        method: "POST",
        headers,
        body: JSON.stringify({}), // Pas de payload nécessaire
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`POST /backup failed (${res.status}): ${text}`);
      }

      const data = await res.json();
      if (DEBUG) console.log("🔹 Backup response:", data);
      return data;
    },

    // ==============================
    // RESTORE (Neon database) avec mode strict/tolerant
    // ==============================
    async restoreFromFile(drive_file_id, strict = false, DEBUG = false) {
        this.ensureValidToken(true);

        const idBase = localStorage.getItem("currentDataBase");
        if (!idBase) {
            alert("❌ Aucun identifiant de base défini ! Veuillez sélectionner une base avant de continuer.");
            throw new Error("Aucun identifiant de base défini");
        }

        if (!drive_file_id) {
            alert("❌ Aucun drive_file_id fourni !");
            throw new Error("drive_file_id required");
        }

        const headers = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.token}`,
        };

        const body = { drive_file_id, strict };

        if (DEBUG) {
            console.log("🔹 restoreFromFile called for database:", idBase);
            console.log("🔹 Payload:", body);
        }

        const res = await fetch(`${this.baseUrl}/restore/${idBase}`, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Restore from file failed (${res.status}): ${text}`);
        }

        const data = await res.json();

        if (DEBUG) console.log("🔹 Restore from file response:", data);

        // 🔹 Retourne le mode effectif (strict/tolerant)
        const mode = data?.mode || (strict ? "strict" : "tolerant");

        return { data, mode };
    },

    // ==============================
    // GOOGLE DRIVE IMAGE
    // ==============================
    async getDriveImage(file_id, DEBUG = true) {
        this.ensureValidToken(true);

        if (!file_id) {
            alert("❌ Aucun file_id fourni !");
            throw new Error("file_id required");
        }
        
        const idBase = localStorage.getItem("currentDataBase");
        if (!idBase) {
            alert("❌ Aucun identifiant de base défini ! Veuillez sélectionner une base avant de continuer.");
            throw new Error("Aucun identifiant de base défini");
        }

        const headers = {
            Authorization: `Bearer ${this.token}`,
        };

        const url = `${this.baseUrl}/drive/photo/${idBase}/${file_id}`;
        if (DEBUG) console.log("🔹 Fetching full-resolution image from:", url);

        const res = await fetch(url, { headers });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Fetching image failed (${res.status}): ${text}`);
        }

        // 🔹 Récupérer le blob renvoyé par le serveur
        const blob = await res.blob();
        const mime = res.headers.get("Content-Type") || "application/octet-stream";
        const objectUrl = URL.createObjectURL(blob);

        // 🔹 Tenter de récupérer le filename depuis Content-Disposition ou fallback
        let filename = `${file_id}`;
        const disposition = res.headers.get("Content-Disposition");
        if (disposition && disposition.includes("filename=")) {
            filename = disposition.split("filename=")[1].replace(/"/g, "");
        }

        if (DEBUG) console.log("🔹 Full-resolution image object URL:", objectUrl, "filename:", filename, "mime:", mime);

        return { url: objectUrl, filename, mime };
    },

    // ==============================
    // UPLOAD TO GOOGLE DRIVE
    // ==============================
    async uploadToDrive(file, folderType = "BACKUP", maxSizeKB = 300, DEBUG = true) {
        this.ensureValidToken(true);

        const idBase = localStorage.getItem("currentDataBase");
        if (!idBase) throw new Error("No database selected");
        if (!file) throw new Error("No file provided");
        if (!(file instanceof File)) throw new Error("Le fichier fourni est invalide");

        const originalName = file.name;
        
        // Fonction utilitaire pour ajouter un suffixe avant l’extension
        function addSuffixToFilename(name, suffix) {
            const dotIndex = name.lastIndexOf(".");
            if (dotIndex === -1) return `${name}_${suffix}`;
            const base = name.slice(0, dotIndex);
            const ext = name.slice(dotIndex);
            return `${base}_${suffix}${ext}`;
        }
        // --------------------------
        // Redimensionner si nécessaire
        // --------------------------
        if (file.size / 1024 > maxSizeKB) {
            if (DEBUG) console.log(`🔹 Resizing file "${file.name}" to max ${maxSizeKB}KB...`);
            try {
                const resizedBlob = await resizeImageToMaxSize(file, maxSizeKB);
                if (resizedBlob && resizedBlob.size < file.size) {
                 // 🔹 Ajoute un suffixe selon le contexte
                    const suffix = "resized";
                    const newName = addSuffixToFilename(originalName, suffix);

                    file = new File([resizedBlob], newName, { type: "image/jpeg" });
                    if (DEBUG) console.log(`✅ Image resized to ${(file.size / 1024).toFixed(1)} KB`);
                }
            } catch (err) {
                console.warn("⚠️ Error resizing image, uploading original:", err);
            }
        }

        // --------------------------
        // Envoi du fichier au serveur Flask
        // --------------------------
        const formData = new FormData();
        // ✅ On précise le nom du fichier ici pour éviter le "blob"
        formData.append("file", file, file.name);
        formData.append("folder_type", folderType.toUpperCase());

        if (DEBUG) console.log("🔹 Uploading file:", file.name, "folder:", folderType);

        const res = await fetch(`${this.baseUrl}/upload_to_drive/${idBase}`, {
            method: "POST",
            body: formData,
        });

        let data;
        try {
            data = await res.json();
        } catch {
            throw new Error("No JSON response from server");
        }

        if (!res.ok || data?.status === "error") {
            throw new Error(data?.error || `HTTP ${res.status}`);
        }

        if (DEBUG) {
            console.log(`✅ Upload successful: ${data.file_name} (${(data.file_size / 1024).toFixed(1)} KB)`);
            console.log(`🔗 Drive URL: ${data.drive_url}`);
        }

        return data;
    },

    // ==============================
    // POST
    // ==============================
     async post(path, body) {
         this.ensureValidToken();

         const headers = {
           "Content-Type": "application/json",
           Authorization: `Bearer ${this.token}`,
         };

         const res = await fetch(`${baseUrl}${path}`, {
           method: "POST",
           headers,
           body: JSON.stringify(body),
         });

         if (!res.ok) {
           const text = await res.text();
           throw new Error(`POST ${path} failed (${res.status}): ${text}`);
         }
         return res.json();
   },
};

return client;
}
