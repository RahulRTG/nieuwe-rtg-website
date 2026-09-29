/* DE STAVING -- staat wat Rahul zegt ook in wat hij heeft opgezocht?

   Een klein model dat zes registers leest, kan een getal overschrijven, twee
   tellingen verwisselen of een route noemen die hij nergens zag. Deze toets
   legt het antwoord naast de uitkomsten van de gereedschappen die in DEZE
   beurt zijn gebruikt, en zegt per bewering waar hij vandaan komt.

   WAT HIJ TOETST, EN WAT NIET. Alleen wat deterministisch terug te vinden is:
   getallen, API-routes en registernamen -- de ANKERS van een zin. Een anker
   dat in een uitkomst staat, krijgt de graad van die uitkomst (de zachtste
   graad die erin voorkomt: een conclusie is nooit harder dan haar zachtste
   premisse). Een anker dat nergens staat, krijgt `onbekend`. Een zin zonder
   ankers wordt niet beoordeeld en wordt ook niet goedgekeurd: hij telt als
   ongetoetst. Een getal dat het model zelf uitrekende (een percentage, een
   som) staat nergens en heet dus ook `onbekend` -- dat is geen fout van het
   model maar een bewering die geen register draagt.

   GEEN NIEUWE WOORDEN. De graden zijn de vier van het huis
   (./gevolgcontract/woorden.js); er is geen `ondersteund` of
   `tegengesproken`. Deze toets beslist niets en houdt niets tegen: hij
   verklaart, en het scherm laat zien wat niet is teruggevonden. De regel
   erboven: AI mag betekenis voorstellen, alleen een deterministisch systeem
   stelt waarheid vast. */
'use strict';
const { GRADEN } = require('./gevolgcontract/woorden');

const MAX_ANKERS = 40;
const RX_ROUTE = /\/api\/[\w/:.-]*[\w:]/g;
const RX_REGISTER = /\b[A-Z][A-Z0-9_-]+\.json\b/g;
const RX_GETAL = /\d+(?:[.,]\d+)*/g;

const laagste = (a, b) => (GRADEN.indexOf(a) <= GRADEN.indexOf(b) ? a : b);

/* 4.180 is vierduizend honderdtachtig (Nederlands), 4,5 is vier en een half. */
function getal(ruw) {
  const s = String(ruw);
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) return Number(s.replace(/\./g, ''));
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/* Wat een uitkomst bevat: alle teksten, alle getallen en de zachtste graad. */
function inhoudVan(uit) {
  const teksten = [];
  const getallen = new Set();
  let graad = null;
  (function loop(x, sleutel) {
    if (x == null) return;
    if (typeof x === 'number') { getallen.add(x); return; }
    if (typeof x === 'string') {
      teksten.push(x);
      if (sleutel === 'graad' && GRADEN.includes(x)) graad = graad ? laagste(graad, x) : x;
      for (const m of x.match(RX_GETAL) || []) { const n = getal(m); if (n != null) getallen.add(n); }
      return;
    }
    if (Array.isArray(x)) { for (const y of x) loop(y); return; }
    if (typeof x === 'object') for (const [k, v] of Object.entries(x)) { if (typeof k === 'string' && k.startsWith('/api/')) teksten.push(k); loop(v, k); }
  })(uit);
  return { teksten, getallen, graad };
}

function zinnen(tekst) {
  return String(tekst || '').split(/(?<=[^\d\s][.!?])\s+|\n+/).map(z => z.trim()).filter(Boolean);
}

/* De ankers van een zin, in volgorde: eerst routes en registers (en die worden
   uit de zin geknipt, zodat hun cijfers geen losse getallen worden), dan de
   getallen -- zonder het nummer van een opsomming. */
function ankersVan(zin) {
  const uit = [];
  let rest = zin.replace(/^\s*(?:[-*•]\s*)?\d+[.)]\s+/, ' ');
  for (const m of rest.match(RX_ROUTE) || []) uit.push({ soort: 'route', waarde: m });
  for (const m of rest.match(RX_REGISTER) || []) uit.push({ soort: 'register', waarde: m });
  rest = rest.replace(RX_ROUTE, ' ').replace(RX_REGISTER, ' ');
  for (const m of rest.match(RX_GETAL) || []) {
    const n = getal(m);
    if (n != null) uit.push({ soort: 'getal', waarde: m, getal: n });
  }
  return uit;
}

function gevonden(anker, bron) {
  if (anker.soort === 'getal') return bron.getallen.has(anker.getal);
  if (anker.soort === 'register') return bron.teksten.some(t => t.includes(anker.waarde));
  return bron.teksten.some(t => t === anker.waarde || new RegExp('(^|[^\\w/])' +
    anker.waarde.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^\\w/])').test(t));
}

/* `uitkomsten` zijn wat de gereedschappen in deze beurt teruggaven:
   [{ gereedschap, invoer, uit }]. */
function staaf(tekst, uitkomsten) {
  /* Een uitkomst mag haar eigen graad meegeven (`u.graad`: de stuurlus weet dat
     een geslaagde aanroep een live antwoord was); een graad IN de uitkomst kan
     die alleen verlagen, nooit ophogen. */
  const bronnen = (uitkomsten || []).map((u) => {
    const inh = inhoudVan(u.uit);
    const graad = u.graad ? (inh.graad ? laagste(u.graad, inh.graad) : u.graad) : (inh.graad || 'onbekend');
    return Object.assign({ gereedschap: u.gereedschap, register: registerVan(u.uit) }, inh, { graad });
  });
  const ankers = [];
  let ongetoetst = 0;
  for (const zin of zinnen(tekst)) {
    const eigen = ankersVan(zin);
    if (!eigen.length) { ongetoetst++; continue; }
    for (const a of eigen) {
      if (ankers.length >= MAX_ANKERS) break;
      const treffers = bronnen.filter(b => gevonden(a, b));
      /* Staat hij in meer dan een uitkomst, dan telt de hardste: een getal dat
         in een gemeten register staat, is niet zwakker omdat een document hem
         ook noemt. */
      const beste = treffers.sort((x, y) => GRADEN.indexOf(y.graad) - GRADEN.indexOf(x.graad))[0];
      ankers.push({ soort: a.soort, waarde: a.waarde, zin: zin.slice(0, 160),
        graad: beste ? beste.graad : 'onbekend',
        bron: beste ? (beste.register || beste.gereedschap) : null });
    }
  }
  const nietGevonden = [...new Set(ankers.filter(a => !a.bron).map(a => a.waarde))];
  const graad = ankers.length ? ankers.map(a => a.graad).reduce(laagste) : 'onbekend';
  return {
    graad, ankers, nietGevonden, ongetoetst,
    ...(ankers.length ? {} : { reden: 'het antwoord noemt geen getal, route of register om terug te vinden' }),
    grens: 'getoetst zijn getallen, routes en registernamen tegen wat in deze beurt is opgezocht; ' +
      'of een zin zonder zo\'n anker klopt, en of een gevonden getal in de JUISTE betekenis is gebruikt, zegt deze toets niet'
  };
}

function registerVan(uit) {
  if (!uit || typeof uit !== 'object') return null;
  if (uit.bron && uit.bron.register) return uit.bron.register;
  if (uit.register) return uit.register;
  if (Array.isArray(uit.bronnen) && uit.bronnen[0]) return uit.bronnen.map(b => b.register).join(', ');
  return null;
}

/* De uitkomst van een stap van de stuurlus, met de graad die de lus kent: een
   geslaagde `doe` is een live antwoord van een route in deze beurt (gemeten); een
   kaart is de lijst die het beleid nu geeft (gemeten); een weigering, een
   voorstel of een plan draagt geen stand van zaken (vermoed). */
function uitStuur(t, uit) {
  const st = uit && typeof uit.status === 'number' ? uit.status : null;
  const live = t.name === 'kaart' || (t.name === 'doe' && st >= 200 && st < 300 && !uit.bevestigNodig);
  return { gereedschap: t.name, invoer: t.input || {}, uit, graad: live ? 'gemeten' : 'vermoed' };
}

/* De zin die onder een antwoord komt als er iets niet is teruggevonden. */
function voetnoot(s) {
  if (!s || !s.nietGevonden || !s.nietGevonden.length) return '';
  return 'Niet teruggevonden in wat hiervoor is opgezocht: ' + s.nietGevonden.slice(0, 8).join(', ') +
    ' -- lees dat als onbekend tot een register het bevestigt.';
}

module.exports = { staaf, voetnoot, uitStuur, ankersVan, getal };
