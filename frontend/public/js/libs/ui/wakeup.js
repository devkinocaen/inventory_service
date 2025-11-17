let wakeUpTimeout;

// Affiche l’alerte "Connexion au serveur…" après un délai
export function showWakeUpAlertDelayed(delay = 1000) {
  clearTimeout(wakeUpTimeout);
  wakeUpTimeout = setTimeout(() => {
    if (document.getElementById("service-wakeup-alert")) return;

    const alert = document.createElement("div");
    alert.id = "service-wakeup-alert";
    alert.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;">
        <span class="hourglass">⏳</span>
        <span>Connexion au serveur…</span>
      </div>
    `;
    Object.assign(alert.style, {
      position: "fixed",
      top: "20px",
      right: "20px",
      padding: "10px 15px",
      background: "#333",
      color: "#fff",
      borderRadius: "8px",
      fontFamily: "sans-serif",
      zIndex: 9999,
      boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
      fontSize: "14px"
    });

    document.body.appendChild(alert);
  }, delay);
}

// Supprime l’alerte si elle existe
export function hideWakeUpAlert() {
  clearTimeout(wakeUpTimeout);
  const alert = document.getElementById("service-wakeup-alert");
  if (alert) alert.remove();
}

// Petite utilitaire
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Boucle infinie de debug
async function infiniteLoop() {
  while (true) {
    console.log("tick");
    await sleep(1000);
  }
}

// Réveille un ou plusieurs services en parallèle
export async function wakeUpServices(urls = [], delayBy = 1000, maxWait = 60000) {
  // Filtrer les URLs vides ou nulles
  const validUrls = urls.filter(url => url && url.trim() !== "");
  if (!validUrls.length) return null;

  showWakeUpAlertDelayed(delayBy);
  const start = Date.now();
  let resolved = false; // flag pour ignorer les autres réponses

  const pingPromises = validUrls.map(url =>
    new Promise(resolve => {
      const controller = new AbortController();

      const tryPing = async () => {
        if (resolved || Date.now() - start > maxWait) return resolve(null);

        try {
          const res = await fetch(url, { method: "GET", signal: controller.signal });
          if (res.ok && !resolved) {
            resolved = true;
            console.log(`☀️ Service awake: ${url}`);
            return resolve(url);
          }
        } catch (err) {
          console.warn(`⚠️ Échec ping: ${url} (${err.message})`);
        }

        setTimeout(tryPing, 2000);
      };

      tryPing();
    })
  );

  const awakeUrl = await Promise.race(pingPromises);

  hideWakeUpAlert();

  if (!awakeUrl) throw new Error("Aucun serveur n'a répondu");

  // Annule toutes les autres requêtes encore en cours
  pingPromises.forEach(p => p.catch(() => {}));

  return awakeUrl;
}




/**
 * 🌞 Essaie d'abord le serveur principal, puis bascule sur le secours si nécessaire.
 */
export async function wakeUpFirstAvailable(urls = [], delayBy = 1000, maxWait = 60000) {
  if (!urls.length) throw new Error("Aucun serveur configuré");

  try {
    const usedUrl = await wakeUpServices(urls, delayBy, maxWait);
    console.log(`☀️ Serveur sélectionné : ${usedUrl}`);
    window.ENV.SELECTED_SERVICE = usedUrl;
    return usedUrl;
  } catch (err) {
    console.error("❌ Aucun serveur disponible :", err);
    alert("Erreur : services indisponibles. Réessayez plus tard.");
    throw err;
  }
}

/**
 * 🔁 Routine périodique pour éviter la mise en veille du service
 */
export function startWakeupRoutine(urls = [], intervalSec = 660) {
  if (window.__serviceWakeupIntervalSet) return;
  window.__serviceWakeupIntervalSet = true;

  setInterval(async () => {
    try {
      await wakeUpServices(urls);
      console.log("⏱️ Wake-up périodique service OK");
    } catch (err) {
      console.error("❌ Erreur wake-up périodique:", err);
    }
  }, intervalSec * 1000);
}
