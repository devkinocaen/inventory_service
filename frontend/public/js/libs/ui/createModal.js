export function createModal(title, fields, onSave) {
  const overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  });

  const modal = document.createElement('div');
  Object.assign(modal.style, {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '8px',
    minWidth: '300px',
    maxWidth: '90%',
    maxHeight: '80vh',
    overflow: 'hidden',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box',
  });

  const h2 = document.createElement('h2');
  h2.textContent = title;
  modal.appendChild(h2);

  const scrollContainer = document.createElement('div');
  Object.assign(scrollContainer.style, {
    overflowY: 'auto',
    flexGrow: 1,
    marginBottom: '20px',
    paddingRight: '10px',
    boxSizing: 'border-box',
  });

  const form = document.createElement('form');
  Object.assign(form.style, {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  });

  const inputRefs = {};
  let lastChecked = null; // pour mémoriser la dernière checkbox cochée

  fields.forEach(f => {
    const label = document.createElement('label');
    label.textContent = f.label;

    let input;
    if (f.type === 'textarea') input = document.createElement('textarea');
    else if (f.type === 'select') {
      input = document.createElement('select');
      (f.options || []).forEach(opt => {
        const optionEl = document.createElement('option');
        optionEl.value = opt.value;
        optionEl.textContent = opt.label;
        input.appendChild(optionEl);
      });
      input.value = f.value || '';
    } else {
      input = document.createElement('input');
      input.type = f.type || 'text';
      if (f.type === 'checkbox') input.checked = f.checked ?? false;
      else input.value = f.value || '';
    }

      // ===== Gestion shift+clic pour checkbox =====
      if (f.type === 'checkbox') {
        // on crée un tableau global pour garder l'ordre réel dans le DOM
        if (!form._checkboxes) form._checkboxes = [];
        const checkboxes = form._checkboxes;

        input.addEventListener('click', (e) => {
          const currentIndex = checkboxes.indexOf(input);

          if (e.shiftKey && lastChecked !== null) {
            const lastIndex = checkboxes.indexOf(lastChecked);
            const [from, to] = lastIndex < currentIndex ? [lastIndex, currentIndex] : [currentIndex, lastIndex];
            checkboxes.slice(from, to + 1).forEach(cb => cb.checked = input.checked);
          }

          lastChecked = input;
        });

        checkboxes.push(input); // on garde l'ordre DOM réel
      }

    // ============================================

    Object.assign(input.style, { width: '100%', boxSizing: 'border-box' });
    label.appendChild(input);
    form.appendChild(label);
    inputRefs[f.key] = input;
  });

  // Conteneur boutons
  const btnContainer = document.createElement('div');
  Object.assign(btnContainer.style, {
    display: 'flex',
    gap: '10px',
    marginTop: '10px',
  });

  const btnCancel = document.createElement('button');
  btnCancel.type = 'button';
  btnCancel.textContent = 'Annuler';
  Object.assign(btnCancel.style, { flex: '1 1 0', minWidth: '0' });
  btnCancel.addEventListener('click', () => document.body.removeChild(overlay));

  const btnReset = document.createElement('button');
  btnReset.type = 'button';
  btnReset.textContent = 'Vider les champs';
  Object.assign(btnReset.style, { flex: '1 1 0', minWidth: '0' });
  btnReset.addEventListener('click', () => {
    Object.values(inputRefs).forEach(inp => {
      if (inp.type === 'checkbox') inp.checked = false;
      else if (inp.tagName === 'SELECT') inp.selectedIndex = 0;
      else inp.value = '';
    });
  });

  const btnSave = document.createElement('button');
  btnSave.type = 'submit';
  btnSave.textContent = 'Enregistrer';
  Object.assign(btnSave.style, { flex: '1 1 0', minWidth: '0' });

  btnContainer.appendChild(btnCancel);
  btnContainer.appendChild(btnReset);
  btnContainer.appendChild(btnSave);

  form.appendChild(btnContainer);
  scrollContainer.appendChild(form);
  modal.appendChild(scrollContainer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Gestion submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const updatedFields = {};
    Object.keys(inputRefs).forEach(k => {
      const inp = inputRefs[k];
      updatedFields[k] = inp.type === 'checkbox' ? inp.checked : inp.value;
    });

    try {
      await onSave(updatedFields);
     //alert('✅ Mise à jour effectuée');
    } catch (err) {
      console.error(err);
      alert('❌ Erreur lors de la mise à jour : ' + err.message);
    } finally {
      if (overlay.parentElement) document.body.removeChild(overlay);
    }
  });
}
