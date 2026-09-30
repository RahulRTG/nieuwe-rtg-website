/* DE KENNISINDEX DOORZOEKEN -- wat de documenten zeggen, en waar de waarheid staat.

   KENNISINDEX.json (scripts/kennisindex.js) draagt de documenten van dit huis,
   opgeknipt per kop. Dit bestand zoekt erin met een woordindex (BM25): geen
   embeddings, want 150 documenten vragen daar niet om, en een woordindex is uit
   te leggen en te beproeven. Een code als MONEY-012 of CODE-AI-001 blijft een
   heel woord, en een kop weegt zwaarder dan een zin.

   WAT EEN VONDST ZEGT, EN WAT NIET. Een document is een BEWERING: een besluit,
   een voornemen, een meting van een dag. Elke vondst draagt daarom de graad
   `vermoed`, de datum waarop het document voor het laatst veranderde, en de
   registers, bestanden en commando's die het stuk NOEMT -- want daar staat de
   huidige werkelijkheid. Rahul hoort een bewering uit een document te toetsen
   aan een register voordat hij hem als stand van zaken brengt.

   Leest alleen via ./bronnen.js, dus alleen een register bij naam. */
'use strict';
const { leesRegister, leeftijd } = require('./bronnen');

const K1 = 1.2;
const B = 0.75;
const TREFFERS = 3;
const UITSNEDE = 900;
const STOP = new Set(('de het een en van in op te dat die is zijn voor met als aan er niet om ook bij of '
  + 'maar dan wat wie hoe waarom waar wordt worden door naar uit over nog al kan we je hij zij ze dit deze '
  + 'the a an of to and is are for on in it this that').split(' '));

function woorden(tekst) {
  const uit = [];
  const ruw = String(tekst || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  for (const m of ruw.matchAll(/[a-z0-9]+(?:[-_.][a-z0-9]+)*/g)) {
    const w = m[0];
    if (w.length > 1 && !STOP.has(w)) uit.push(w);
    /* Een samengesteld woord telt ook in delen: money-012 vindt money en 012. */
    if (/[-_.]/.test(w)) for (const d of w.split(/[-_.]/)) if (d.length > 1 && !STOP.has(d)) uit.push(d);
  }
  return uit;
}

let index = null;
function bouwIndex(inhoud) {
  const docs = inhoud.docs || [];
  const stukken = inhoud.stukken || [];
  const df = new Map();
  const tf = stukken.map((s) => {
    const d = docs[s.d] || {};
    /* De kop drie keer en de naam van het document twee keer: waar het OVER gaat
       weegt zwaarder dan wat er terloops in staat. */
    const telling = new Map();
    for (const w of woorden([s.k, s.k, s.k, d.pad, d.pad, d.titel, s.t].join(' '))) telling.set(w, (telling.get(w) || 0) + 1);
    for (const w of telling.keys()) df.set(w, (df.get(w) || 0) + 1);
    let lengte = 0; for (const n of telling.values()) lengte += n;
    return { telling, lengte };
  });
  const gem = tf.reduce((s, x) => s + x.lengte, 0) / Math.max(1, tf.length);
  return { docs, stukken, tf, df, gem, n: stukken.length };
}

function laad() {
  const r = leesRegister('kennisindex');
  if (!r.ok) return { r, idx: null };
  if (!index || index.bron !== r.inhoud) index = Object.assign(bouwIndex(r.inhoud), { bron: r.inhoud });
  return { r, idx: index };
}

function score(idx, i, termen) {
  const { telling, lengte } = idx.tf[i];
  let s = 0;
  for (const w of termen) {
    const f = telling.get(w);
    if (!f) continue;
    const idf = Math.log(1 + (idx.n - idx.df.get(w) + 0.5) / (idx.df.get(w) + 0.5));
    s += idf * (f * (K1 + 1)) / (f + K1 * (1 - B + B * lengte / idx.gem));
  }
  return s;
}

/* De alinea met de meeste treffers, en wat erna komt tot de uitsnede vol is. */
function uitsnede(tekst, termen) {
  const alineas = String(tekst).split(/\n{2,}/);
  let beste = 0, top = -1;
  alineas.forEach((a, i) => { const n = woorden(a).filter(w => termen.includes(w)).length; if (n > top) { top = n; beste = i; } });
  let uit = '';
  for (let i = beste; i < alineas.length && uit.length < UITSNEDE; i++) uit += (uit ? '\n\n' : '') + alineas[i];
  return uit.length > UITSNEDE ? uit.slice(0, UITSNEDE) + ' ...' : uit;
}

const uniek = (lijst, max) => [...new Set(lijst)].slice(0, max);
function noemt(tekst) {
  const t = String(tekst);
  return {
    registers: uniek([...t.matchAll(/\b[A-Z][A-Z0-9_-]+\.json\b/g)].map(m => m[0]), 6),
    bestanden: uniek([...t.matchAll(/\b(?:server\/|scripts\/|test\/)?(?:kern|routes|lib|scripts|test)\/[\w./-]+\.js\b/g)].map(m => m[0]), 6),
    commandos: uniek([...t.matchAll(/npm run [\w:-]+/g)].map(m => m[0]), 4),
    datums: uniek([...t.matchAll(/\b\d{1,2} (?:januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december) 20\d\d\b/g)].map(m => m[0]), 4)
  };
}

function zoekKennis({ vraag } = {}) {
  const termen = uniek(woorden(vraag), 24);
  if (!termen.length) return { reden: 'geef een vraag of een paar woorden om op te zoeken' };
  const { r, idx } = laad();
  if (!idx) return { stand: 'niet vast te stellen', register: r.register, reden: r.reden, hoe: 'npm run kennisindex bouwt de index uit de documenten' };
  const l = leeftijd(r.inhoud.kop || {});
  const scores = [];
  for (let i = 0; i < idx.n; i++) { const s = score(idx, i, termen); if (s > 0) scores.push([s, i]); }
  scores.sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  const vondsten = scores.slice(0, TREFFERS).map(([s, i]) => {
    const st = idx.stukken[i];
    const d = idx.docs[st.d] || {};
    return { document: d.pad, kop: st.k || d.titel, regel: st.r, documentGewijzigd: d.gewijzigd || null,
      tekst: uitsnede(st.t, termen), noemt: noemt(st.t) };
  });
  return {
    vondsten, graad: 'vermoed',
    let: 'een document is een bewering en geen meting; toets wat het zegt aan de registers die het noemt voordat je het als stand van zaken brengt',
    bron: { register: r.register, gemetenOp: l.gemetenOp, dagenOud: l.dagenOud, commit: l.commit || null },
    ...(vondsten.length ? {} : { reden: 'geen document noemt deze woorden' })
  };
}

module.exports = { zoekKennis, woorden, noemt };
