// js/pages/collection.js
import { fetchReservables, fetchCategories, fetchSubcategories, fetchStyles } from '../libs/sql/index.js';
import { initClient } from '../libs/client.js';
import { formatServerError } from '../libs/helpers.js';

let client;
let currentItems = [];
let selectedItems = [];
let activeFilters = { category: [], subcategory: [], style: [] };

// ---- DOM Elements ----
let filtersSidebar, filtersToggle, cartSidebar, cartToggle, container;

function toggleFilter(type, value) {
  if(activeFilters[type].includes(value)) activeFilters[type] = activeFilters[type].filter(v=>v!==value);
  else activeFilters[type].push(value);
}

function renderFilterChips(categories, subcategories, styles) {
  const categoryChips = document.getElementById('collection-categoryChips');
  const subcatChips = document.getElementById('collection-subcatChips');
  const styleChips = document.getElementById('collection-styleChips');

  categoryChips.innerHTML='';
  categories.forEach(c=>{
    const chip = document.createElement('div');
    chip.textContent=c.name;
    chip.className='chip'+(activeFilters.category.includes(c.name)?' active':'');
    chip.onclick=()=>{ toggleFilter('category', c.name); renderFilterChips(categories, subcategories, styles); renderItems(); };
    categoryChips.appendChild(chip);
  });

  subcatChips.innerHTML='';
  subcategories.forEach(s=>{
    const chip = document.createElement('div');
    chip.textContent=s.name;
    chip.className='chip'+(activeFilters.subcategory.includes(s.name)?' active':'');
    chip.onclick=()=>{ toggleFilter('subcategory', s.name); renderFilterChips(categories, subcategories, styles); renderItems(); };
    subcatChips.appendChild(chip);
  });

  styleChips.innerHTML='';
  styles.forEach(s=>{
    const chip = document.createElement('div');
    chip.textContent=s.name;
    chip.className='chip'+(activeFilters.style.includes(s.name)?' active':'');
    chip.onclick=()=>{ toggleFilter('style', s.name); renderFilterChips(categories, subcategories, styles); renderItems(); };
    styleChips.appendChild(chip);
  });
}

function renderItems() {
  container.innerHTML='';
  currentItems.forEach(item=>{
    if(activeFilters.category.length && !activeFilters.category.includes(item.category_name)) return;
    if(activeFilters.subcategory.length && !activeFilters.subcategory.includes(item.subcategory_name)) return;
    if(activeFilters.style.length && !activeFilters.style.includes(item.style_names?.[0])) return;

    const div = document.createElement('div');
    div.className='costume-card'+(selectedItems.includes(item.id)?' selected':'');

    const img = document.createElement('img');
    img.src = item.photos?.[0] || '';
    let hoverInterval, idx=0;
    div.addEventListener('mouseenter', ()=>{
      hoverInterval=setInterval(()=>{
        idx=(idx+1)%item.photos.length;
        img.src=item.photos[idx];
      },1000);
    });
    div.addEventListener('mouseleave', ()=>{
      clearInterval(hoverInterval);
      idx=0;
      img.src=item.photos?.[0] || '';
    });
    div.appendChild(img);

    const name = document.createElement('div');
    name.className='costume-name';
    name.textContent=item.name;
    div.appendChild(name);

    div.addEventListener('click', ()=>{
      if(selectedItems.includes(item.id)) selectedItems=selectedItems.filter(i=>i!==item.id);
      else selectedItems.push(item.id);
      renderItems();
      renderCart();
    });

    container.appendChild(div);
  });
}

function renderCart() {
  cartSidebar.innerHTML='<h4>Panier</h4>';
  selectedItems.forEach(id=>{
    const item = currentItems.find(i=>i.id===id);
    const div = document.createElement('div');
    div.textContent=item.name;
    cartSidebar.appendChild(div);
  });
}

async function loadData() {
  try {
    const [items, categories, subcategories, styles] = await Promise.all([
      fetchReservables(client),
      fetchCategories(client),
      fetchSubcategories(client),
      fetchStyles(client)
    ]);

    currentItems = items;
    renderFilterChips(categories, subcategories, styles);
    renderItems();
    renderCart();
  } catch (err) {
    console.error('[Collection] Erreur :', formatServerError(err.message));
  }
}

/**
 * Init function à appeler au chargement du HTML
 */
export async function init() {
  client = await initClient();

  // DOM Elements
  filtersSidebar = document.getElementById('collection-filtersSidebar');
  filtersToggle = document.getElementById('collection-filtersToggle');
  cartSidebar = document.getElementById('collection-cartSidebar');
  cartToggle = document.getElementById('collection-cartToggle');
  container = document.getElementById('collection-main');

  // Toggle sidebar events
  filtersToggle.addEventListener('click', ()=>{
    filtersSidebar.classList.toggle('collapsed');
    filtersToggle.classList.toggle('collapsed');
  });
  cartToggle.addEventListener('click', ()=>{
    cartSidebar.classList.toggle('collapsed');
    cartToggle.classList.toggle('collapsed');
  });

  await loadData();
}
