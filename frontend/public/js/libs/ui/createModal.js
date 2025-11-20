export function createModal(title, fields, onSave) {
  const overlay = document.createElement('div');
  overlay.className = 'generic-modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'generic-modal-container';

  const h2 = document.createElement('h2');
  h2.className = 'generic-modal-title';
  h2.textContent = title;
  modal.appendChild(h2);

  const scrollContainer = document.createElement('div');
  scrollContainer.className = 'generic-modal-scroll';

  const form = document.createElement('form');
  form.className = 'generic-modal-form';

  const inputRefs = {};
  let lastChecked = null;

  fields.forEach(f => {
     if (!f.key) {
       alert(`⚠️ Le champ "${f.label}" n'a pas de key définie !`);
     }
                 
    const label = document.createElement('label');
    label.className = 'generic-modal-label';
    label.textContent = f.label;

    let input;

    if (f.type === 'textarea') {
      input = document.createElement('textarea');
      input.value = f.value || '';
      input.rows = 3;

    } else if (f.type === 'select') {
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

    input.className = f.type === 'checkbox' ? 'generic-modal-checkbox' : 'generic-modal-input';

    // Shift+click checkboxes
    if (f.type === 'checkbox') {
      if (!form._checkboxes) form._checkboxes = [];
      const checkboxes = form._checkboxes;

      input.addEventListener('click', (e) => {
        const currentIndex = checkboxes.indexOf(input);
        if (e.shiftKey && lastChecked !== null) {
          const lastIndex = checkboxes.indexOf(lastChecked);
          const [from, to] = lastIndex < currentIndex
            ? [lastIndex, currentIndex]
            : [currentIndex, lastIndex];
          checkboxes.slice(from, to + 1).forEach(cb => cb.checked = input.checked);
        }
        lastChecked = input;
      });

      checkboxes.push(input);
    }

    label.appendChild(input);
    form.appendChild(label);
    inputRefs[f.key] = input;
  });

  const btnContainer = document.createElement('div');
  btnContainer.className = 'generic-modal-buttons';

  const btnCancel = document.createElement('button');
  btnCancel.type = 'button';
  btnCancel.textContent = 'Annuler';
  btnCancel.className = 'generic-modal-btn generic-modal-btn-cancel';
  btnCancel.onclick = () => document.body.removeChild(overlay);

  const btnReset = document.createElement('button');
  btnReset.type = 'button';
  btnReset.textContent = 'Vider les champs';
  btnReset.className = 'generic-modal-btn generic-modal-btn-reset';
  btnReset.onclick = () => {
    Object.values(inputRefs).forEach(inp => {
      if (inp.type === 'checkbox') inp.checked = false;
      else if (inp.tagName === 'SELECT') inp.selectedIndex = 0;
      else inp.value = '';
    });
  };

  const btnSave = document.createElement('button');
  btnSave.type = 'submit';
  btnSave.textContent = 'Enregistrer';
  btnSave.className = 'generic-modal-btn generic-modal-btn-save';

  btnContainer.append(btnCancel, btnReset, btnSave);
  form.appendChild(btnContainer);

  scrollContainer.appendChild(form);
  modal.appendChild(scrollContainer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  form.onsubmit = async e => {
    e.preventDefault();

    const updatedFields = {};

    try {
      for (const k in inputRefs) {
        const inp = inputRefs[k];
        if (!inp) {
          alert(`⚠️ Champ "${k}" introuvable.`);
          return;
        }

        if (inp.type === 'checkbox') {
          updatedFields[k] = inp.checked;
        } else {
          if (inp.value === undefined) {
            alert(`⚠️ Champ "${k}" n'a pas de valeur définie.`);
            return;
          }
          updatedFields[k] = inp.value.trim();
        }
      }

      if (typeof onSave !== 'function') {
        alert('⚠️ onSave n’est pas une fonction valide.');
        return;
      }

      await onSave(updatedFields);

    } catch (err) {
      alert('❌ Erreur : ' + err.message);
    } finally {
      document.body.removeChild(overlay);
    }
  };

}
