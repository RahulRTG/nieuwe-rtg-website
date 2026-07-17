/* ============================== RTG OS-schil ==============================
   De leden-app als telefoon-besturingssysteem. De (verborgen) tabbar blijft
   het model: alle bestaande logica schakelt daar tabs, zichtbaarheid
   (gast-modus, Assets, Gezin) en badges. Deze laag SPIEGELT dat model naar
   een springboard-grid en een dock, en schakelt de app-modus (fullscreen met
   terugbalk en home-indicator) op basis van de actieve tab. Kliks op iconen
   gaan terug het model in (button.click()), zodat er een navigatiepad is en
   geen drift kan ontstaan. */
(() => {
  const $ = s => document.querySelector(s);
  const tabbar = $('#tabbar'), grid = $('#osGrid'), dock = $('#osDock'), app = $('#app');
  if (!tabbar || !grid || !dock || !app) return;
  const DOCK = ['ai', 'betalen', 'bestellen', 'salon'];

  function maakIcoon(bron, inDock) {
    const tab = bron.dataset.tab;
    const naam = (bron.querySelector('span') && bron.querySelector('span').textContent) || tab;
    const el = document.createElement('button');
    el.className = 'os-app'; el.dataset.tab = tab;
    el.setAttribute('aria-label', naam);
    const tegel = document.createElement('span'); tegel.className = 'os-tegel';
    const svg = bron.querySelector('svg'); if (svg) tegel.appendChild(svg.cloneNode(true));
    // badge-stip (bijv. gezin) reist mee vanaf het model
    const dot = bron.querySelector('span[id$="Dot"]');
    if (dot && dot.style.display !== 'none') { const b = document.createElement('span'); b.className = 'os-badge'; tegel.appendChild(b); }
    el.appendChild(tegel);
    if (!inDock) { const n = document.createElement('span'); n.className = 'os-naam'; n.textContent = naam; el.appendChild(n); }
    el.addEventListener('click', () => bron.click());
    return el;
  }

  function bouw() {
    grid.textContent = ''; dock.textContent = '';
    tabbar.querySelectorAll('button[data-tab]').forEach(b => {
      if (b.dataset.tab === 'home' || b.style.display === 'none') return;
      grid.appendChild(maakIcoon(b, false));
      if (DOCK.includes(b.dataset.tab)) dock.appendChild(maakIcoon(b, true));
    });
    sync();
  }

  function actieveTab() {
    const b = tabbar.querySelector('button.active');
    return b ? b.dataset.tab : 'home';
  }
  function sync() {
    const tab = actieveTab(), open = tab !== 'home';
    app.classList.toggle('os-open', open);
    const terug = $('#osTerug'), brand = $('#osBrand'), titel = $('#osAppTitel');
    if (terug) terug.hidden = !open;
    if (brand) brand.style.display = open ? 'none' : '';
    if (titel) {
      const bron = tabbar.querySelector('button[data-tab="' + tab + '"] span');
      titel.textContent = open && bron ? bron.textContent : '';
    }
    dock.querySelectorAll('.os-app').forEach(d => d.classList.toggle('actief', d.dataset.tab === tab));
  }

  // Het model kan op elk moment veranderen: taalwissel (labels), gast-modus
  // (display), badges en de actieve tab. Een observer houdt de OS-laag gelijk.
  let gepland = null;
  new MutationObserver(() => {
    if (gepland) return;
    gepland = requestAnimationFrame(() => { gepland = null; bouw(); });
  }).observe(tabbar, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['style', 'class'] });

  const naarHome = () => { const b = tabbar.querySelector('button[data-tab="home"]'); if (b) b.click(); };
  const terug = $('#osTerug'), pill = $('#osPill');
  if (terug) terug.addEventListener('click', naarHome);
  if (pill) pill.addEventListener('click', naarHome);

  // statusbalk-klok en de datumkop van het springboard
  const klok = $('#osKlok'), datum = $('#osDatum');
  function tik() {
    const d = new Date();
    if (klok) klok.textContent = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    if (datum) {
      const taal = (document.documentElement.lang || 'nl');
      try { datum.textContent = d.toLocaleDateString(taal, { weekday: 'long', day: 'numeric', month: 'long' }); }
      catch (e) { datum.textContent = d.toLocaleDateString(); }
    }
  }
  tik(); setInterval(tik, 15000);

  bouw();
})();
