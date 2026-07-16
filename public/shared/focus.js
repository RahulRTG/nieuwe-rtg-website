/* FocusUI: rust in elke app. Elke kaart wordt inklapbaar; de laag telt wat
   je gebruikt en klapt standaard alleen open wat jouw ogen nodig hebben: je
   meest gebruikte kaarten. Eigen keuzes (open of dicht) winnen altijd en
   worden onthouden. Zonder geschiedenis staan per scherm de eerste twee
   kaarten open, zodat niets verstopt raakt.

   Activeren via de script-tag, per app:
   <script src="/shared/focus.js" data-app="pda" data-kaart=".card" data-kop=".k"></script>

   Privacy: alleen tellers per kaartnaam, nooit inhoud. De leden-app deelt de
   tellers (met toestemming van de sessie) met Fluister, zodat de assistent
   leert waar je het meest mee werkt. */
(function () {
  'use strict';
  const script = document.currentScript;
  if (!script) return;
  const APP = script.dataset.app || 'app';
  const KAART = script.dataset.kaart || '.card';
  const KOP = script.dataset.kop || '.k';
  const KEY = 'rtg_focus_' + APP;
  const TOP_N = 3;          // met geschiedenis: zoveel kaarten standaard open
  const LEER_DREMPEL = 10;  // vanaf zoveel interacties gaat de geschiedenis sturen

  let mem = { score: {}, open: {}, dicht: {} };
  try { mem = Object.assign(mem, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}
  const bewaar = () => { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) {} };
  const totaal = () => Object.values(mem.score).reduce((a, b) => a + b, 0);
  const top = () => Object.entries(mem.score).sort((a, b) => b[1] - a[1]).slice(0, TOP_N).map(x => x[0]);

  function stijl() {
    if (document.getElementById('fxStijl')) return;
    const s = document.createElement('style');
    s.id = 'fxStijl';
    s.textContent = '.fx-kaart.fx-dicht > *:not(.fx-kop){display:none !important;}' +
      '.fx-kaart.fx-dicht{padding-bottom:0.55rem;}' +
      '.fx-kop{cursor:pointer;user-select:none;}' +
      '.fx-kop:focus-visible{outline:2px solid currentColor;outline-offset:2px;border-radius:6px;}' +
      '.fx-pijl{float:right;margin-left:0.5rem;opacity:0.55;font-size:0.8em;transition:transform 0.15s;}' +
      '.fx-dicht .fx-pijl{transform:rotate(-90deg);}';
    document.head.appendChild(s);
  }
  // de naam van een kaart: de koptekst zonder tellers en tijden, zodat hij
  // stabiel blijft over her-renders heen
  function naamVan(kaart) {
    const kop = kaart.querySelector(KOP);
    if (!kop || kop.closest(KAART) !== kaart) return null;
    const t = (kop.textContent || '').replace(/[0-9]+/g, '').replace(/[·().:/]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
    return t || null;
  }
  function zet(kaart, open) {
    kaart.classList.toggle('fx-dicht', !open);
    const kop = kaart.querySelector('.fx-kop');
    if (kop) kop.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  function toggle(kaart) {
    const n = kaart.dataset.fx;
    const open = kaart.classList.contains('fx-dicht');
    zet(kaart, open);
    if (open) { mem.open[n] = 1; delete mem.dicht[n]; }
    else { mem.dicht[n] = 1; delete mem.open[n]; }
    bewaar();
  }
  function pas(kaart, volgnr) {
    if (kaart.dataset.fx != null) return;
    const n = naamVan(kaart);
    if (!n) return;
    kaart.dataset.fx = n;
    kaart.classList.add('fx-kaart');
    const kop = kaart.querySelector(KOP);
    kop.classList.add('fx-kop');
    if (!kop.querySelector('.fx-pijl')) {
      const pijl = document.createElement('span');
      pijl.className = 'fx-pijl';
      pijl.textContent = '▾';
      pijl.setAttribute('aria-hidden', 'true');
      kop.appendChild(pijl);
    }
    kop.setAttribute('role', 'button');
    kop.setAttribute('tabindex', '0');
    // open of dicht: eigen keuze wint; daarna de geschiedenis; daarna de
    // eerste twee kaarten van het scherm
    let open;
    if (mem.open[n]) open = true;
    else if (mem.dicht[n]) open = false;
    else if (totaal() >= LEER_DREMPEL) open = top().includes(n);
    else open = volgnr < 2;
    zet(kaart, open);
    kop.addEventListener('click', e => {
      // knoppen in de kop (oproepen, teamcall...) blijven gewoon knoppen
      if (e.target.closest('button, a, input, select, textarea')) return;
      toggle(kaart);
    });
    kop.addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target === kop) { e.preventDefault(); toggle(kaart); }
    });
    // leren: elke interactie in de kaart telt (alleen een teller, geen inhoud)
    kaart.addEventListener('click', e => {
      if (e.target.closest('.fx-kop') && !e.target.closest('button, a, input, select')) return;
      mem.score[n] = (mem.score[n] || 0) + 1;
      bewaar();
    }, true);
  }

  let bezig = false;
  function loop() {
    if (bezig) return;
    bezig = true;
    requestAnimationFrame(() => {
      bezig = false;
      stijl();
      // per ouder-container telt het volgnummer, zodat "eerste twee open"
      // per scherm geldt en niet app-breed
      const perOuder = new Map();
      document.querySelectorAll(KAART).forEach(k => {
        if (k.dataset.fx != null) return;
        const ouder = k.parentElement || document.body;
        const i = perOuder.get(ouder) || 0;
        perOuder.set(ouder, i + 1);
        pas(k, i);
      });
    });
  }
  const obs = new MutationObserver(loop);
  if (document.body) { obs.observe(document.body, { childList: true, subtree: true }); loop(); }
  else document.addEventListener('DOMContentLoaded', () => { obs.observe(document.body, { childList: true, subtree: true }); loop(); });

  // voor Fluister: de tellers (en niets anders) zijn deelbaar
  window.FocusUI = {
    scores: () => Object.assign({}, mem.score),
    reset: () => { mem = { score: {}, open: {}, dicht: {} }; bewaar(); }
  };
})();
