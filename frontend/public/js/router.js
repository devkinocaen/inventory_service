console.log('✅ Script router.js chargé');

// 🔹 Objet global pour stocker les états en mémoire avant stockage local
window.__tabFormStates = window.__tabFormStates || {};


function resolvePath(path) {
  if (!path) return path;
//  console.log('path', path);
//  console.log('window.ENV.BASE_PATH', window.ENV.BASE_PATH);
  return path.replace(/\$BASE_PATH/g, window.ENV.BASE_PATH || '');
}


function saveFormState(tabIndex, contentEl) {
  if (!contentEl) return;
  const inputs = contentEl.querySelectorAll('input, select, textarea');
  const state = {};
  inputs.forEach(el => {
    if (el.type === 'checkbox' || el.type === 'radio') {
      state[el.id || el.name] = el.checked;
    } else {
      state[el.id || el.name] = el.value;
    }
  });

    // 🔹 Sauvegarde des chips sélectionnés
    const chips = contentEl.querySelectorAll('.chip');
    state.__chips = Array.from(chips).map(chip => chip.classList.contains('selected') || chip.classList.contains('active'));

    
  window.__tabFormStates[tabIndex] = state;
  localStorage.setItem('tabFormStates', JSON.stringify(window.__tabFormStates));
}

function restoreFormState(tabIndex, contentEl) {
  if (!contentEl) return;
  const stored = JSON.parse(localStorage.getItem('tabFormStates') || '{}');
  const state = stored[tabIndex];
  if (!state) return;

  const inputs = contentEl.querySelectorAll('input, select, textarea');
  inputs.forEach(el => {
    const key = el.id || el.name;
    if (!(key in state)) return;
    if (el.type === 'checkbox' || el.type === 'radio') {
      el.checked = state[key];
    } else {
      el.value = state[key];
    }
  });
    
    // 🔹 Restauration de l'état des chips
    if (Array.isArray(state.__chips)) {
      const chips = contentEl.querySelectorAll('.chip');
      chips.forEach((chip, i) => {
        const selected = state.__chips[i];
        if (selected) {
          chip.classList.add('selected', 'active');
        } else {
          chip.classList.remove('selected', 'active');
        }
      });
    }
}


function onReady(fn) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fn);
  } else {
    fn();
  }
}


onReady(() => {
        
    // 🔹 Met à jour le bandeau principal selon HEADER_IMAGE_URL
    console.log ('Mise à jour du bandeau principal selon HEADER_IMAGE_URL')
    const bandeauImg = document.getElementById("bandeau-img"); // ou "bandeau-img" selon ton id
    if (bandeauImg) {
      bandeauImg.src = window.ENV?.HEADER_IMAGE_URL || "/images/bandeau_costumerie.png";
    }
    console.log ('bandeau principal', bandeauImg.src)

  const tabsEl = document.getElementById('tabs');
  const contentEl = document.getElementById('content');

  const user = JSON.parse(localStorage.getItem("loggedUser"));
    console.log ('user', user)
    
  const db = localStorage.getItem('currentDataBase');
  const userRole = user.role || '';

  if (user && db) {
    let displayName = user.role;
    if (user.firstName || user.lastName) {
      displayName = `${user.firstName || ''} ${user.lastName || ''} (${user.role})`;
    }

    document.getElementById('user_role').textContent =
      'connecté à ' + db + ' en tant que: ' + displayName;
  }
  // 🔹 Gestion du bouton "se déconnecter"
  const signoutBtn = document.getElementById('signout');
  if (signoutBtn) {
    signoutBtn.addEventListener('click', () => {
      console.log('🔒 Déconnexion de l’utilisateur...');
      localStorage.removeItem('loggedUser');
      window.location.href = resolvePath('$BASE_PATH/index.html');
    });
  }
    
  let currentCleanupFn = null;
  window.__loadedModules = window.__loadedModules || {};

  fetch('../resources/files.json?_=' + Date.now())
  .then(response => response.json())
  .then(files => {
    // On récupère l'utilisateur courant
    const user = JSON.parse(localStorage.getItem("loggedUser")) || {};
    const userRole = user.role || '';

    // Filtre : ne garder que les fichiers dont le user correspond à l'utilisateur ou "all"
    const filteredFiles = files.filter(file => {

      if (!file.user) return false; // pas de user → pas affiché

      // file.user peut être string avec plusieurs rôles séparés par des virgules
      const users = file.user.split(',').map(u => u.trim());
      // On garde le fichier si le rôle de l'utilisateur est présent ou si users contient "all"
      return users.includes(userRole) || users.includes('all');
    });



    if (!filteredFiles.length) {
      contentEl.innerHTML = `<p style="color:red;">Aucune page pour le rôle "${userRole}".</p>`;
      return;
    }

    // Création des onglets
    filteredFiles.forEach((file, index) => {
      const tab = document.createElement('div');
      tab.className = 'tab';
      tab.textContent = file.title;
      tab.addEventListener('click', () => loadContent(file, index));
      tabsEl.appendChild(tab);
    });

    // Charge l'onglet sauvegardé, sinon le premier
    const savedIndex = Number(localStorage.getItem('currentTabIndex')) || 0;
    loadContent(filteredFiles[savedIndex] || filteredFiles[0], savedIndex);
  })
  .catch(error => {
    contentEl.innerHTML = `<p style="color:red;">Erreur de chargement des fichiers : ${error.message}</p>`;
  });


        
        
 async function loadContent(fileObj, index) {
   Array.from(tabsEl.children).forEach((tab, i) => {
     tab.classList.toggle('active', i === index);
   });

   try {
     // Sauvegarde l'état de l'onglet courant avant de changer
     const currentTab = Number(localStorage.getItem('currentTabIndex'));
     if (!isNaN(currentTab)) saveFormState(currentTab, contentEl);

     // Nettoyage précédent si nécessaire
     if (typeof currentCleanupFn === 'function') {
       console.log('🧹 Appel de la fonction de nettoyage précédente');
       currentCleanupFn();
       currentCleanupFn = null;
     }

     // Supprime les anciens scripts dynamiques
     document.querySelectorAll('script[data-dynamic-script]').forEach(el => el.remove());

     // Récupère le HTML de la page
     const res = await fetch(resolvePath(fileObj.file) + '?_=' + Date.now());
     if (!res.ok) throw new Error(`Erreur HTTP ${res.status}`);
     const html = await res.text();

     const parser = new DOMParser();
     const doc = parser.parseFromString(html, 'text/html');

     // On enlève les styles externes / liens pour éviter doublons
     doc.querySelectorAll('style, link[rel="stylesheet"]').forEach(el => el.remove());
     contentEl.innerHTML = doc.body.innerHTML;

     // Charge les scripts dynamiques
     currentCleanupFn = await loadScripts(fileObj.scripts, contentEl);

     // Restore l'état de l'onglet chargé
     restoreFormState(index, contentEl);

   } catch (error) {
     contentEl.innerHTML = `<p style="color:red;">Erreur de chargement : ${error.message}</p>`;
     console.error('Erreur dans loadContent:', error);
   }

   localStorage.setItem('currentTabIndex', index);
 }



 async function loadScripts(scripts, containerEl) {
    if (!scripts || !scripts.length) return null;

    let cleanupFn = null;

    for (const scriptSrc of scripts) {
      const resolvedSrc = resolvePath(scriptSrc);
      const fullUrl = resolvedSrc + '?_=' + Date.now();
      const cleanKey = scriptSrc.replace(/\?.*$/, '');

      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = fullUrl;
        script.type = 'module';
        script.setAttribute('data-dynamic-script', 'true');

        script.onload = async () => {
          try {
            const imported = await import(script.src);

            if (typeof imported.init === 'function') {
              console.log(`🚀 Appel init() depuis import() pour : ${cleanKey}`);
              // ⚡ On passe containerEl au init()
              await imported.init(containerEl);
              window.__loadedModules[cleanKey] = {
                initDone: true,
                cleanup: typeof imported.cleanup === 'function' ? imported.cleanup : null,
              };
            }
          } catch (err) {
            console.error(`❌ Erreur import() post-load pour ${scriptSrc}:`, err);
          }

          resolve();
        };

        script.onerror = () => reject(new Error(`Erreur chargement script ${scriptSrc}`));
        document.body.appendChild(script);
      });
    }

    return cleanupFn;
  }


  // 🔹 TNR automatique si activé
  if (window.ENV.RUN_TNR) {
    (async () => {
      try {
        const tnrModules = [
          '$BASE_PATH/tests/tnrs/tnr_event.js',
          // ajouter d'autres TNRS ici si besoin
        ];

        for (const path of tnrModules) {
          const resolvedPath = resolvePath(path);
          const mod = await import(resolvedPath + '?_=' + Date.now());
          const tnrObj = Object.values(mod).find(obj => obj?.run || obj?.runAllTests);
          if (tnrObj) {
            console.log(`🚀 Lancement des tests TNR : ${path}`);
            if (typeof tnrObj.runAllTests === 'function') await tnrObj.runAllTests();
            else if (typeof tnrObj.run === 'function') await tnrObj.run();
          } else {
            console.warn(`⚠️ Aucun objet TNR trouvé dans : ${path}`);
          }
        }

        console.log('✅ Tous les TNRS terminés');
      } catch (err) {
        console.error('❌ Erreur lors de l’exécution des TNRS :', err);
      }
    })();
  }
});


// ID du select
const helpMenu = document.getElementById("helpMenu");

// Fonction pour charger le JSON et remplir le menu
async function loadHelp() {
  try {
    const response = await fetch(resolvePath('../resources/help.json')); // résolution du chemin
    const data = await response.json();

      // Récupérer l'utilisateur courant depuis le localStorage
      const user = JSON.parse(localStorage.getItem("loggedUser")) || {};
      const currentUser = user.role || 'viewer';


    // Filtrer les éléments selon le rôle (supporte plusieurs rôles séparés par des virgules)
    const filteredData = data.filter(item => {
      if (!item.user) return false; // accessible à tous
      const users = item.user.split(',').map(u => u.trim());
      return users.includes(currentUser);
    });

    filteredData.forEach(item => {
      if (item.file && item.title) {
        const option = document.createElement("option");
        option.value = resolvePath(item.file); // utilise resolvePath pour remplacer $BASE_PATH
        option.textContent = item.title;
        helpMenu.appendChild(option);
        helpMenu.disabled = false;
      }
    });
  } catch (err) {
    console.error("Erreur lors du chargement du JSON :", err);
  }
}


// Listener pour l'ouverture du fichier
helpMenu.addEventListener("change", function() {
  const file = this.value;
  if (file) {
    window.open(file, "_blank"); // ouvre le fichier PDF ou page HTML
    this.selectedIndex = 0; // remet l'option par défaut
  }
});

// Appel initial
loadHelp();
