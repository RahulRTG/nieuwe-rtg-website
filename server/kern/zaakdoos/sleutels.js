/* EEN SLEUTEL PER ZAAKDOOS, GEBONDEN AAN ZIJN ZAAK (devices.zaakdoos_sleutel,
   besluit B12 van de eigenaar, 27 september 2026).

   Een doos is een kastje in EEN zaak. Zijn sleutel is daarom een credential met
   een onderwerp (doos + zaak), een doel, een scope per eindpuntfamilie en een
   vervaldatum -- via ../bearercode.js, zoals de andere gemigreerde deuren:
     ZD.<32 hex>, 128 bits; in de opslag alleen de hash; kaal alleen in het
     antwoord op uitgeven of roteren; intrekken en roteren aan de serverkant;
     de vergelijking met timingSafeEqual over twee hashes van gelijke lengte.
   Wat de sleutel NIET begrenst is het aantal aanroepen: een doos meldt zich elke
   minuut, en max_gebruik staat daarom op 0 (niet geteld). Wat hem wel begrenst:
   de vervaldatum (standaard STANDAARD_DAGEN, nooit meer dan MAX_DAGEN), EEN
   geldige sleutel per doos, hooguit MAX_DOZEN_PER_ZAAK dozen per zaak, de scope,
   de IP-rem op verkeerde sleutels (routes/doos-wacht.js) en intrekken.

   Uitgeven, roteren en intrekken lopen in EEN collectietransactie (PostgreSQL:
   advisory lock + FOR UPDATE), zodat een intrekking op de ene instance niet door
   een gelijktijdige uitgifte op de andere wordt overschreven en het plafond per
   zaak niet door twee gelijktijdige uitgiftes wordt gepasseerd.

   Een oude sleutel (48 hex, zonder zaak of vervaldatum) opent niets meer en staat
   als `legacy` in het overzicht. De schaduw van de gedeelde sleutel: ./sleutels-schaduw.js. */
'use strict';

const NAAM = /^[a-z0-9][a-z0-9-]{1,39}$/;
const ZAAK = /^[A-Z0-9][A-Z0-9_-]{1,39}$/;
const VORM = /^ZD\.[0-9A-F]{32}$/i;
const DOEL = 'zaakdoos-apparaat';
const ISSUER = 'rtg.zaakdoos';
const FAMILIES = Object.freeze(['meting', 'rapport', 'update', 'buurmelding', 'kloon']);
const STANDAARD_DAGEN = 180, MAX_DAGEN = 365, MAX_DOZEN_PER_ZAAK = 8;
const DAG = 86400000;

const naamVan = x => String(x || '').trim().toLowerCase();
const zaakVan = x => String(x || '').trim().toUpperCase();

function maakDoosSleutels({ db, save, crypto, bewerkCollectie, nu }) {
  if (typeof bewerkCollectie !== 'function') throw new Error('De doossleutels vereisen een collectietransactie.');
  const tijd = nu || Date.now;
  const iso = () => new Date(tijd()).toISOString();
  const bearer = require('../bearercode')({ crypto, namespace: 'devices.zaakdoos_sleutel', nu: iso });
  const eigen = require('../eigencollectie')({ db, domein: 'kern/zaakdoos/sleutels',
    bezit: { doosSleutels: 'kaart', doosSleutelGebruik: 'kaart' } });
  const schaduw = require('./sleutels-schaduw')({ db, save, nu: tijd,
    heeftEigen: n => !!(eigen.kijk('doosSleutels') || {})[n] });
  const transactie = werk => bewerkCollectie('doosSleutels', bron => {
    if (!bron || typeof bron !== 'object' || Array.isArray(bron)) throw new Error('doosSleutels hoort een kaart te zijn');
    return werk(bron);
  });
  const actief = t => !!t && !bearer.reden(t, { doel: DOEL, negeerGebruik: true });

  /* Uitgeven of roteren: een tweede uitgifte voor dezelfde doos trekt de vorige
     sleutel in. Een doos die bij een ANDERE zaak hoort en nog een geldige sleutel
     heeft, wordt niet overgenomen -- trek hem daar eerst in. */
  async function geef({ doos, zaak, scope, dagen, door }) {
    const n = naamVan(doos), z = zaakVan(zaak);
    if (!NAAM.test(n)) return { status: 400, error: 'Een doosnaam is 2 tot 40 tekens: kleine letters, cijfers en streepjes.' };
    if (!ZAAK.test(z)) return { status: 400, error: 'Noem de zaak waar deze doos staat.' };
    const scopes = scope == null ? FAMILIES.slice() : [...new Set([].concat(scope).map(String))];
    if (!scopes.length || scopes.some(s => !FAMILIES.includes(s)))
      return { status: 400, error: 'De scope is een deel van: ' + FAMILIES.join(', ') + '.' };
    const d = dagen == null ? STANDAARD_DAGEN : Number(dagen);
    if (!Number.isInteger(d) || d < 1 || d > MAX_DAGEN)
      return { status: 400, error: 'Een doossleutel leeft 1 tot ' + MAX_DAGEN + ' dagen.' };
    const wie = String(door || '').slice(0, 100);
    if (!wie) return { status: 403, error: 'Een doossleutel wordt uitgegeven door een mens op naam.' };
    return transactie(bron => {
      const oud = bron[n];
      if (oud && oud.zaak && oud.zaak !== z && actief(oud.toegang))
        return { status: 409, error: 'Deze doos hoort bij een andere zaak. Trek zijn sleutel daar eerst in.' };
      const binnen = Object.values(bron).filter(r => r && r.doos !== n && r.zaak === z && actief(r.toegang)).length;
      if (binnen >= MAX_DOZEN_PER_ZAAK)
        return { status: 409, error: 'Deze zaak heeft al ' + MAX_DOZEN_PER_ZAAK + ' dozen met een geldige sleutel. Trek er eerst een in.' };
      const g = bearer.maak({ prefix: 'ZD', issuer: ISSUER, doel: DOEL, scope: scopes.map(s => 'zaakdoos.' + s),
        onderwerp: { doos: n, zaak: z }, geldigheid: { duurMs: d * DAG }, gebruik: 'sessie', afgeleid: 'perAanroep' });
      const historie = oud && Array.isArray(oud.historie) ? oud.historie.slice(-2) : [];
      if (oud && oud.toegang && oud.zaak === z) {
        if (!oud.toegang.ingetrokken_at) bearer.intrekken(oud.toegang, wie, 'geroteerd');
        historie.push(oud.toegang);
        g.toegang.rotatie = (Number(oud.toegang.rotatie) || 0) + 1;
      }
      bron[n] = { doos: n, zaak: z, toegang: g.toegang, uitgegeven_door: wie, historie };
      return { ok: true, doos: n, zaak: z, sleutel: g.code, scope: scopes, expires_at: g.toegang.expires_at,
        rotatie: g.toegang.rotatie,
        let: 'Deze sleutel wordt maar een keer getoond. Zet hem op de doos als RTG_DOOS_EIGEN_SLEUTEL, met RTG_DOOS_ID=' + n +
          '. Hij vervalt op ' + g.toegang.expires_at.slice(0, 10) + '; roteer hem daarvoor.' };
    });
  }

  /* Intrekken. Met `zaak` (de manager) alleen een doos van die zaak; een andere bestaat voor hem niet. */
  async function trekIn({ doos, zaak, door, reden }) {
    const n = naamVan(doos);
    return transactie(bron => {
      const r = bron[n];
      if (!r || (zaak != null && r.zaak !== zaakVan(zaak))) return zaak != null
        ? { status: 404, error: 'Deze zaak heeft geen doos met die naam.' } : { ok: true, ingetrokken: false };
      if (!r.toegang) { delete bron[n]; return { ok: true, ingetrokken: true, doos: n }; } // een oude 48-hex-sleutel
      if (r.toegang.ingetrokken_at) return { ok: true, ingetrokken: false, doos: n };
      bearer.intrekken(r.toegang, String(door || 'onbekend'), String(reden || 'ingetrokken'));
      return { ok: true, ingetrokken: true, doos: n, zaak: r.zaak };
    });
  }

  /* Welke doos is dit, en mag hij deze familie? Alleen als id EN sleutel kloppen
     (de hash in constante tijd) en de sleutel geldig is. `fout` komt alleen terug
     als de sleutel zelf klopte: dan mag de doos horen waarom (verlopen, scope). */
  function welke(id, sleutel, familie) {
    const n = naamVan(id), s = String(sleutel || '').trim();
    if (!NAAM.test(n) || !VORM.test(s) || !FAMILIES.includes(familie)) return null;
    const r = (eigen.kijk('doosSleutels') || {})[n];
    const t = r && r.toegang;
    if (!t || !bearer.zelfdeHash(t.code_hash, bearer.hash(s))) return null;
    if (!t.onderwerp || t.onderwerp.doos !== n || t.onderwerp.zaak !== r.zaak) return null;
    const reden = bearer.reden(t, { doel: DOEL, scope: ['zaakdoos.' + familie], negeerGebruik: true });
    if (reden) return { fout: reden };
    return { doos: n, zaak: r.zaak, expires_at: t.expires_at };
  }

  // gebruik: een teller in een EIGEN collectie, buiten de transactie (geen besluit)
  function telGebruik(doos) {
    const k = eigen.bak('doosSleutelGebruik');
    const g = k[doos] || (k[doos] = { gebruik: 0, laatst: null });
    g.gebruik += 1; g.laatst = iso();
  }

  function dozen(zaak) {
    const k = eigen.kijk('doosSleutels') || {}, g = eigen.kijk('doosSleutelGebruik') || {};
    return Object.keys(k).sort().map(n => k[n]).filter(r => zaak == null || r.zaak === zaakVan(zaak)).map(r => {
      const t = r.toegang;
      if (!t) return { doos: r.doos || null, legacy: true, geldig: false, uitleg: 'oude sleutel zonder zaak en vervaldatum: opnieuw uitgeven' };
      const reden = bearer.reden(t, { doel: DOEL, negeerGebruik: true });
      return { doos: r.doos, zaak: r.zaak, scope: t.scope.map(s => s.replace(/^zaakdoos\./, '')), issued_at: t.issued_at,
        expires_at: t.expires_at, verlooptBinnenDagen: Math.max(0, Math.floor((Date.parse(t.expires_at) - tijd()) / DAG)),
        geldig: !reden, stand: reden || 'geldig', rotatie: t.rotatie, uitgegeven_door: r.uitgegeven_door || null,
        gebruik: (g[r.doos] || {}).gebruik || 0, laatst: (g[r.doos] || {}).laatst || null };
    });
  }

  function overzicht() { return Object.assign({ dozen: dozen() }, schaduw.overzicht()); }

  return { geef, trekIn, welke, telGebruik, dozen, overzicht, telWeg: schaduw.telWeg,
    gedeeldeSleutel: schaduw.gedeeldeSleutel, gedeeldZet: schaduw.gedeeldZet };
}

/* EEN INSTANTIE PER DATABASE (kern.doosSleutels): vloot, kantoor en manager
   delen hem, en twee instanties zouden elk een eigen greep op de collectie hebben. */
const cache = new WeakMap();
function doosSleutelsVan(deps) {
  if (!cache.has(deps.db)) cache.set(deps.db, maakDoosSleutels(deps));
  return cache.get(deps.db);
}

module.exports = { maakDoosSleutels, doosSleutelsVan, FAMILIES, DOEL, ISSUER, STANDAARD_DAGEN, MAX_DAGEN, MAX_DOZEN_PER_ZAAK };
