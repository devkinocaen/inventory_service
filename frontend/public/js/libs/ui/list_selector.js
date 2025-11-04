// libs/ui/list_selector.js
export function openListSelector(templates) {
  return new Promise((resolve) => {
    const modal = document.getElementById('templateModal');
    const table = document.getElementById('templateTable');

    if (!modal || !table) return resolve(null);

    // Vider la table avant de remplir
    table.innerHTML = '';

    // Créer un input file réutilisable
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.html';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    // Ajouter les lignes dans la table
    templates.forEach((t) => {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.textContent = t.title;
      tr.appendChild(td);
      table.appendChild(tr);

      tr.addEventListener('click', async () => {
        if (!t.file) {
          // Fichier local
          fileInput.value = '';
          fileInput.click();
          await new Promise(r => fileInput.onchange = r);
          if (!fileInput.files.length) return alert("Aucun fichier sélectionné.");
          t.file = fileInput.files[0]; // on remplace file par l'objet File
        }

        modal.style.display = 'none';
        resolve(t); // on retourne le template choisi
      });
    });

    // Annuler
    const cancelBtn = document.getElementById('modalCancel');
    if (cancelBtn) {
      cancelBtn.onclick = () => {
        modal.style.display = 'none';
        resolve(null); // utilisateur annule
      };
    }

    // Afficher le modal
    modal.style.display = 'flex';
  });
}
