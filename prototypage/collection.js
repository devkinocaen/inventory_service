// ---- Données simulées ----
const cstmItems = Array.from({length:64}, (_,i)=>({
  id: i+1,
  name: ['Pirate','Vampire','Fée','Chevalier','Clown','Cowboy','Princesse','Robot'][Math.floor(Math.random()*8)]+' '+(i+1),
  category: ['Costume','Accessoire'][Math.floor(Math.random()*2)],
  subcategory: ['Halloween','Carnaval','Fête','Cinéma'][Math.floor(Math.random()*4)],
  style: ['Classique','Moderne','Fantaisie'][Math.floor(Math.random()*3)],
  photos: [`https://picsum.photos/seed/${i}a/150/100`,`https://picsum.photos/seed/${i}b/150/100`,`https://picsum.photos/seed/${i}c/150/100`]
}));

let cstmSelected = [];
let cstmFilters = { category:[], subcategory:[], style:[] };

// ---- Filtres Sidebar ----
const filtersSidebar = document.getElementById('cstm-filtersSidebar');
const filtersToggle = document.getElementById('cstm-filtersToggle');
filtersToggle.addEventListener('click', ()=>{
  filtersSidebar.classList.toggle('cstm-collapsed');
  filtersToggle.classList.toggle('cstm-collapsed');
});

function cstmRenderFilterChips() {
  const cats = [...new Set(cstmItems.map(i=>i.category))];
  const subs = [...new Set(cstmItems.map(i=>i.subcategory))];
  const styles = [...new Set(cstmItems.map(i=>i.style))];
  const categoryChips = document.getElementById('cstm-categoryChips');
  const subcatChips = document.getElementById('cstm-subcatChips');
  const styleChips = document.getElementById('cstm-styleChips');

  function renderChip(list, type, values) {
    list.innerHTML='';
    values.forEach(v=>{
      const chip = document.createElement('div');
      chip.textContent=v;
      chip.className='cstm-chip'+(cstmFilters[type].includes(v)?' cstm-active':'');
      chip.onclick=()=>{ cstmToggleFilter(type,v); cstmRenderFilterChips(); cstmRenderItems(); };
      list.appendChild(chip);
    });
  }

  renderChip(categoryChips, 'category', cats);
  renderChip(subcatChips, 'subcategory', subs);
  renderChip(styleChips, 'style', styles);
}
function cstmToggleFilter(type,value) {
  if(cstmFilters[type].includes(value))
    cstmFilters[type] = cstmFilters[type].filter(v=>v!==value);
  else
    cstmFilters[type].push(value);
}

// ---- Panier ----
const cartSidebar = document.getElementById('cstm-cartSidebar');
const cartToggle = document.getElementById('cstm-cartToggle');
cartToggle.addEventListener('click', ()=>{
  cartSidebar.classList.toggle('cstm-collapsed');
  cartToggle.classList.toggle('cstm-collapsed');
});
function cstmRenderCart() {
  cartSidebar.innerHTML='<h4>Panier</h4>';
  cstmSelected.forEach(id=>{
    const item = cstmItems.find(i=>i.id===id);
    const div = document.createElement('div');
    div.textContent=item.name;
    cartSidebar.appendChild(div);
  });
}

// ---- Items ----
const container = document.getElementById('cstm-main');
function cstmRenderItems() {
  container.innerHTML='';
  cstmItems.forEach(item=>{
    if(cstmFilters.category.length && !cstmFilters.category.includes(item.category)) return;
    if(cstmFilters.subcategory.length && !cstmFilters.subcategory.includes(item.subcategory)) return;
    if(cstmFilters.style.length && !cstmFilters.style.includes(item.style)) return;

    const div = document.createElement('div');
    div.className='cstm-card'+(cstmSelected.includes(item.id)?' cstm-selected':'');

    const img = document.createElement('img');
    img.src = item.photos[0];
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
      img.src=item.photos[0];
    });
    div.appendChild(img);

    const name = document.createElement('div');
    name.className='cstm-name';
    name.textContent=item.name;
    div.appendChild(name);

    div.addEventListener('click', ()=>{
      if(cstmSelected.includes(item.id))
        cstmSelected=cstmSelected.filter(i=>i!==item.id);
      else
        cstmSelected.push(item.id);
      cstmRenderItems();
      cstmRenderCart();
    });

    container.appendChild(div);
  });
}

// ---- Init ----
cstmRenderFilterChips();
cstmRenderItems();
cstmRenderCart();
