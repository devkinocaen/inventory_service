/**
 * Remplit un <select> avec des options
 * @param {HTMLSelectElement} selectElement - l'élément select à remplir
 * @param {Array} items - liste d'items à mettre dans le select
 * @param {string|number|null} selectItemId - id de l'item à sélectionner par défaut
 * @param {Object} options - options supplémentaires
 *        {string} valueField - champ utilisé comme valeur (default 'id')
 *        {string} labelField - champ utilisé comme label (default 'name')
 *        {string} placeholder - texte du placeholder (default '-- Choisir --')
 *        {boolean} disablePlaceholder - si true, le placeholder est grisé (default false)
 */

export function populateSelect(
  selectElement,
  items,
  selectItemId = null,
  {
    valueField = 'id',
    labelField = 'name', // peut être string ou fonction
    placeholder = '-- Choisir --',
    disablePlaceholder = false
  } = {}
) {
  if (!selectElement) return;

  selectElement.innerHTML = '';
 let placeholderOption =  null;
  if (placeholder) {
    const placeholderOption = document.createElement('option');
    placeholderOption.value = '';
    placeholderOption.textContent = placeholder;
    if (disablePlaceholder) placeholderOption.disabled = true;
    selectElement.appendChild(placeholderOption);
  }

  const selectIdStr = selectItemId != null ? String(selectItemId) : null;
  let matched = false;
  const seenValues = new Set();

  items.forEach(item => {
    let value = item?.[valueField];
    if (value == null || value === '' || value === 'undefined' || value === 'null') return;
    value = String(value);

    if (seenValues.has(value)) return;
    seenValues.add(value);

    // Label = soit un champ, soit une fonction
    let label;
    if (typeof labelField === 'function') {
      label = labelField(item);
    } else {
      label = item?.[labelField];
    }

    const option = document.createElement('option');
    option.value = value;
    option.textContent = String(label ?? value);

    if (selectIdStr !== null && option.value === selectIdStr) {
      option.selected = true;
      matched = true;
    }

    selectElement.appendChild(option);
  });

  if (!matched && placeholderOption) placeholderOption.selected = true;
  selectElement.disabled = false;
}
