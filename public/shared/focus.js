/* FocusUI: rust in elke app. Elke kaart wordt inklapbaar; de laag telt wat
   je gebruikt en klapt standaard alleen open wat jouw ogen nodig hebben: je
   meest gebruikte kaarten. Eigen keuzes (open of dicht) winnen altijd en
   worden onthouden. Zonder geschiedenis staan per scherm de eerste twee
   kaarten open, zodat niets verstopt raakt.

   Activeren via de script-tag, per app:
   <script src="/shared/focus.js" data-app="pda" data-kaart=".card" data-kop=".k"></script>

   Dichtgeklapt betekent niet doof: heeft een dichte kaart meldingen in zich
   (badge-elementen zoals [data-dmbadge]), dan kleurt de balk en staat het
   aantal erop. Extra badge-selectors per app via data-melding.

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
  const MELDING = '[data-dmbadge], [data-fxtel]' + (script.dataset.melding ? ', ' + script.dataset.melding : '');
  const KEY = 'rtg_focus_' + APP;
  const TOP_N = 3;          // met geschiedenis: zoveel kaarten standaard open
  const LEER_DREMPEL = 10;  // vanaf zoveel interacties gaat de geschiedenis sturen

  let mem = { score: {}, open: {}, dicht: {}, laatst: {}, gezien: {} };
  try { mem = Object.assign(mem, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}
  if (!mem.laatst) mem.laatst = {};
  if (!mem.gezien) mem.gezien = {};
  const bewaar = () => { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) {} };
  const totaal = () => Object.values(mem.score).reduce((a, b) => a + b, 0);
  // oude gewoontes vervagen: een score telt half per maand zonder gebruik,
  // zodat de app meegroeit met wat je nu doet in plaats van wat je ooit deed
  const gewicht = n => (mem.score[n] || 0) * Math.pow(0.5, (Date.now() - (mem.laatst[n] || Date.now())) / (30 * 86400000));
  const top = () => Object.keys(mem.score).sort((a, b) => gewicht(b) - gewicht(a)).slice(0, TOP_N);

  function stijl() {
    if (document.getElementById('fxStijl')) return;
    const s = document.createElement('style');
    s.id = 'fxStijl';
    s.textContent = '.fx-kaart.fx-dicht > *:not(.fx-kop){display:none !important;}' +
      '.fx-kaart.fx-dicht{padding-bottom:0.55rem;}' +
      '.fx-kop{cursor:pointer;user-select:none;}' +
      '.fx-kop:focus-visible{outline:2px solid currentColor;outline-offset:2px;border-radius:6px;}' +
      '.fx-pijl{float:right;margin-left:0.5rem;opacity:0.55;font-size:0.8em;transition:transform 0.15s;}' +
      '.fx-dicht .fx-pijl{transform:rotate(-90deg);}' +
      // dicht maar niet doof: bij meldingen kleurt de balk en telt de badge
      '.fx-badge{display:none;margin-left:0.5rem;background:#C23A5E;color:#fff;border-radius:999px;min-width:1.5em;height:1.5em;line-height:1.5em;text-align:center;font-size:0.68em;font-weight:700;padding:0 0.35em;vertical-align:middle;}' +
      '.fx-kaart.fx-dicht.fx-melding > .fx-kop .fx-badge{display:inline-block;}' +
      '.fx-kaart.fx-dicht.fx-melding{background-image:linear-gradient(rgba(194,58,94,0.16),rgba(194,58,94,0.16));border-color:rgba(194,58,94,0.55);}';
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
      const badge = document.createElement('span');
      badge.className = 'fx-badge';
      kop.appendChild(badge);
      const pijl = document.createElement('span');
      pijl.className = 'fx-pijl';
      pijl.textContent = '▾';
      pijl.setAttribute('aria-hidden', 'true');
      kop.appendChild(pijl);
    }
    kop.setAttribute('role', 'button');
    kop.setAttribute('tabindex', '0');
    // een kaart die pas verscheen nadat je de app al kende (een nieuwe
    // functie) valt een dag lang op: hij staat open, ook als de
    // geschiedenis hem anders zou verstoppen
    if (!mem.gezien[n]) { mem.gezien[n] = totaal() >= LEER_DREMPEL ? Date.now() : 1; bewaar(); }
    const nieuw = mem.gezien[n] > 1 && Date.now() - mem.gezien[n] < 86400000;
    // open of dicht: eigen keuze wint; daarna de geschiedenis (plus de
    // nieuwe kaarten); daarna de eerste twee kaarten van het scherm
    let open;
    if (mem.open[n]) open = true;
    else if (mem.dicht[n]) open = false;
    else if (totaal() >= LEER_DREMPEL) open = nieuw || top().includes(n);
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
      mem.laatst[n] = Date.now();
      bewaar();
    }, true);
  }

  // dicht maar niet doof: tel de meldingen in een kaart (badge-elementen);
  // een getal telt als dat getal, elk ander gevuld badge-element als een
  function telMeldingen(kaart) {
    let n = 0;
    kaart.querySelectorAll(MELDING).forEach(el => {
      if (el.closest(KAART) !== kaart) return;
      const t = (el.textContent || '').trim();
      const v = parseInt(t, 10);
      n += Number.isFinite(v) ? Math.max(0, v) : (t ? 1 : 0);
    });
    return n;
  }
  function badges() {
    document.querySelectorAll('.fx-kaart').forEach(kaart => {
      const b = kaart.querySelector('.fx-kop .fx-badge');
      if (!b) return;
      const n = telMeldingen(kaart);
      const tekst = n ? String(n) : '';
      if (b.textContent !== tekst) {
        b.textContent = tekst;
        b.setAttribute('aria-label', n ? n + ' meldingen' : '');
      }
      if (kaart.classList.contains('fx-melding') !== (n > 0)) kaart.classList.toggle('fx-melding', n > 0);
    });
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
      badges();
    });
  }
  const obs = new MutationObserver(loop);
  const kijk = () => { obs.observe(document.body, { childList: true, subtree: true, characterData: true }); loop(); };
  if (document.body) kijk();
  else document.addEventListener('DOMContentLoaded', kijk);

  // voor Fluister: de tellers (en niets anders) zijn deelbaar
  window.FocusUI = {
    scores: () => Object.assign({}, mem.score),
    reset: () => { mem = { score: {}, open: {}, dicht: {}, laatst: {}, gezien: {} }; bewaar(); }
  };
})();
