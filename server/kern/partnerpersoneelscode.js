/* DE PERSONEELSCODE VAN HET PARTNERKANAAL, PER MEDEWERKER (besluit B14, 29
   september 2026; deur partnerkanaal.personeels_en_partnercode).

   Het kanaal is gesplitst. De PARTNERCODE is een openbare attributielink die
   niets opent. De PERSONEELSCODE geeft het personeelstarief en het bedrijfsbeeld
   van de partner, en is dus een credential via ./bearercode.js: PK.<32 hex>
   (128 bits), alleen de hash in de opslag, kaal alleen bij uitgeven of roteren,
   issuer/doel/scope/onderwerp (partner + medewerkerplek), verval, een maximum
   aantal boekingen, intrekken en roteren aan de serverkant, en zoeken over ALLE
   rijen met timingSafeEqual. Een boeking verbruikt een gebruik in EEN
   collectietransactie (PostgreSQL: advisory lock + FOR UPDATE).

   Een medewerker is een PLEK (`pm_<hex>`) met hooguit een interne verwijzing als
   label, nooit een naam. De oude, door mensen gekozen `partner.staff.code` wordt
   nergens meer gelezen, opent niets en wordt bij de opslagstart gewist (B21,
   ./partnerpersoneelscode-migratie.js). */
'use strict';

const VORM = /^PK\.[0-9A-F]{32}$/i;
const PARTNER = /^[A-Z0-9][A-Z0-9_-]{1,39}$/;
const PLEK = /^pm_[0-9a-f]{16}$/;
const DOEL = 'partnerkanaal-personeelstarief';
const ISSUER = 'rtg.partnerkanaal';
const SCOPE = Object.freeze(['partnerkanaal.personeelstarief', 'partnerkanaal.boeken']);
const STANDAARD_DAGEN = 365, MAX_DAGEN = 365, STANDAARD_BOEKINGEN = 12, MAX_BOEKINGEN = 100, MAX_PER_PARTNER = 500;
const DAG = 86400000;
const COLLECTIE = 'partnerPersoneelscodes';

const partnerVan = x => String(x || '').trim().toUpperCase();

function maakPersoneelscodes({ db, crypto, bewerkCollectie, zoekPartner, nu }) {
  if (typeof bewerkCollectie !== 'function') throw new Error('De personeelscodes vereisen een collectietransactie.');
  if (typeof zoekPartner !== 'function') throw new Error('De personeelscodes vereisen een partnerzoeker.');
  const tijd = nu || Date.now;
  const iso = () => new Date(tijd()).toISOString();
  const bearer = require('./bearercode')({ crypto, namespace: 'partnerkanaal.personeelscode', nu: iso });
  const eigen = require('./eigencollectie')({ db, domein: 'kern/partnerpersoneelscode', bezit: { [COLLECTIE]: 'kaart' } });
  const transactie = werk => bewerkCollectie(COLLECTIE, bron => {
    if (!bron || typeof bron !== 'object' || Array.isArray(bron)) throw new Error(COLLECTIE + ' hoort een kaart te zijn');
    return werk(bron);
  });
  // personeelskanaal = een eigen tarief
  const kanaal = code => {
    const p = zoekPartner(partnerVan(code));
    return p && p.staff && Number.isFinite(p.staff.serviceRate) ? p : null;
  };
  const vindRij = (bron, code) => bearer.vind(Object.values(bron || {}), code, r => r && r.toegang && r.toegang.code_hash);
  const klopt = r => !!r && !!r.toegang && !!r.toegang.onderwerp &&
    r.toegang.onderwerp.partner === r.partner && r.toegang.onderwerp.medewerker === r.id;
  const duur = dagen => {
    const d = dagen == null || dagen === '' ? STANDAARD_DAGEN : Number(dagen);
    return Number.isInteger(d) && d >= 1 && d <= MAX_DAGEN ? d : null;
  };

  async function geef({ partner, label, dagen, maxGebruik, door }) {
    const z = partnerVan(partner);
    if (!PARTNER.test(z) || !zoekPartner(z)) return { status: 404, error: 'Deze partner kennen we niet.' };
    if (!kanaal(z)) return { status: 409, error: 'Deze partner heeft geen personeelskanaal (geen eigen personeelstarief).' };
    const d = duur(dagen);
    if (!d) return { status: 400, error: 'Een personeelscode leeft 1 tot ' + MAX_DAGEN + ' dagen.' };
    const m = maxGebruik == null || maxGebruik === '' ? STANDAARD_BOEKINGEN : Number(maxGebruik);
    if (!Number.isInteger(m) || m < 1 || m > MAX_BOEKINGEN)
      return { status: 400, error: 'Een personeelscode geldt voor 1 tot ' + MAX_BOEKINGEN + ' boekingen.' };
    const wie = String(door || '').slice(0, 100);
    if (!wie) return { status: 403, error: 'Een personeelscode wordt uitgegeven door een mens op naam.' };
    const l = String(label || '').replace(/\s+/g, ' ').trim().slice(0, 60) || null;
    return transactie(bron => {
      const actief = Object.values(bron).filter(r => r && r.partner === z && r.toegang &&
        !bearer.reden(r.toegang, { doel: DOEL, negeerGebruik: true })).length;
      if (actief >= MAX_PER_PARTNER)
        return { status: 409, error: 'Deze partner heeft al ' + MAX_PER_PARTNER + ' geldige personeelscodes. Trek er eerst een in.' };
      let id;
      do id = 'pm_' + crypto.randomBytes(8).toString('hex'); while (bron[id]);
      const g = bearer.maak({ prefix: 'PK', issuer: ISSUER, doel: DOEL, scope: SCOPE.slice(),
        onderwerp: { partner: z, medewerker: id }, geldigMs: d * DAG, maxGebruik: m });
      bron[id] = { id, partner: z, label: l, toegang: g.toegang, uitgegeven_door: wie, historie: [] };
      return uitgifte(bron[id], g.code);
    });
  }

  function uitgifte(r, code) {
    return { ok: true, id: r.id, partner: r.partner, code, expires_at: r.toegang.expires_at,
      max_gebruik: r.toegang.max_gebruik, rotatie: r.toegang.rotatie,
      let: 'Deze code wordt maar een keer getoond. Geef hem alleen aan deze medewerker; hij vervalt op ' +
        r.toegang.expires_at.slice(0, 10) + '. Kwijt of gedeeld: roteer hem.' };
  }

  // Roteren: dezelfde plek, een nieuwe code; de vorige is daarna niets meer waard.
  async function roteer({ id, dagen, door }) {
    const plek = String(id || '');
    const wie = String(door || '').slice(0, 100);
    if (!wie) return { status: 403, error: 'Een personeelscode wordt geroteerd door een mens op naam.' };
    const d = duur(dagen);
    if (!d) return { status: 400, error: 'Een personeelscode leeft 1 tot ' + MAX_DAGEN + ' dagen.' };
    return transactie(bron => {
      const r = PLEK.test(plek) ? bron[plek] : null;
      if (!klopt(r)) return { status: 404, error: 'Deze personeelscode kennen we niet.' };
      const oud = r.toegang;
      if (!oud.ingetrokken_at) bearer.intrekken(oud, wie, 'geroteerd');
      const g = bearer.maak({ prefix: 'PK', issuer: ISSUER, doel: DOEL, scope: SCOPE.slice(),
        onderwerp: { partner: r.partner, medewerker: r.id }, geldigMs: d * DAG, maxGebruik: oud.max_gebruik });
      g.toegang.rotatie = (Number(oud.rotatie) || 0) + 1;
      r.historie = (Array.isArray(r.historie) ? r.historie : []).concat([oud]).slice(-3);
      r.toegang = g.toegang;
      r.uitgegeven_door = wie;
      return uitgifte(r, g.code);
    });
  }

  async function trekIn({ id, door, reden }) {
    const plek = String(id || '');
    return transactie(bron => {
      const r = PLEK.test(plek) ? bron[plek] : null;
      if (!klopt(r)) return { status: 404, error: 'Deze personeelscode kennen we niet.' };
      if (r.toegang.ingetrokken_at) return { ok: true, ingetrokken: false, id: r.id };
      bearer.intrekken(r.toegang, String(door || 'onbekend'), String(reden || 'ingetrokken').slice(0, 200));
      return { ok: true, ingetrokken: true, id: r.id, partner: r.partner };
    });
  }

  // wat opent deze code zonder hem te verbruiken? null zegt niet waarom
  function welke(code) {
    const c = String(code || '').trim();
    if (!VORM.test(c)) return null;
    const r = vindRij(eigen.kijk(COLLECTIE), c);
    if (!klopt(r) || bearer.reden(r.toegang, { doel: DOEL, scope: [SCOPE[0]] })) return null;
    const partner = kanaal(r.partner);
    if (!partner) return null;
    return { partner, id: r.id, expires_at: r.toegang.expires_at,
      resterend: r.toegang.max_gebruik - r.toegang.gebruik };
  }

  /* Een boeking: EEN gebruik, atomair. { partner, id } of null. */
  async function claim(code) {
    const c = String(code || '').trim();
    if (!VORM.test(c)) return null;
    const uit = await transactie(bron => {
      const r = vindRij(bron, c);
      if (!klopt(r) || bearer.reden(r.toegang, { doel: DOEL, scope: SCOPE.slice() })) return null;
      if (!kanaal(r.partner)) return null;
      bearer.gebruik(r.toegang);
      return { partnerCode: r.partner, id: r.id };
    });
    if (!uit) return null;
    return { partner: kanaal(uit.partnerCode), id: uit.id };
  }

  // metadata voor het kantoor: nooit een code of een hash
  function lijst(partner) {
    const z = partner == null ? null : partnerVan(partner);
    const bron = eigen.kijk(COLLECTIE) || {};
    return Object.keys(bron).sort().map(k => bron[k]).filter(r => klopt(r) && (z == null || r.partner === z)).map(r => {
      const reden = bearer.reden(r.toegang, { doel: DOEL });
      const p = bearer.publiek(r.toegang);
      return { id: r.id, partner: r.partner, label: r.label || null, issued_at: p.issued_at, expires_at: p.expires_at,
        max_gebruik: p.max_gebruik, gebruik: p.gebruik, laatst_gebruikt_at: p.laatst_gebruikt_at,
        ingetrokken_at: p.ingetrokken_at, rotatie: p.rotatie, stand: reden || 'geldig', geldig: !reden,
        uitgegeven_door: r.uitgegeven_door || null };
    });
  }

  return { geef, roteer, trekIn, welke, claim, lijst };
}

// EEN instantie per database, gedeeld door ledenkanaal, personeelsdeur en kantoor
const cache = new WeakMap();
function personeelscodesVan(deps) {
  if (!cache.has(deps.db)) cache.set(deps.db, maakPersoneelscodes(deps));
  return cache.get(deps.db);
}

module.exports = { maakPersoneelscodes, personeelscodesVan, VORM, DOEL, ISSUER, SCOPE, COLLECTIE,
  STANDAARD_DAGEN, MAX_DAGEN, STANDAARD_BOEKINGEN, MAX_BOEKINGEN, MAX_PER_PARTNER };
