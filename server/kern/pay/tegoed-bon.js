/* DE BON ZELF (kern/pay/tegoed-bon.js): zijn vorm, zijn code, en de ENE
   collectietransactie waarin hij leeft. De handelingen staan in ./tegoed.js
   (de ledenkant), ./tegoed-zaak.js (de zaakkant) en ./tegoed-claim.js (geld
   uit de escrow halen); die delen alles wat hier staat.

   DE CODE IS DRAGER VAN WAARDE, en daarom staat hij hier niet. De kale code
   bestaat precies een keer: in het antwoord op de uitgifte of de rotatie. Op
   schijf staat alleen `toegang.code_hash` (../bearercode.js: 128 bits,
   SHA-256 met een vaste namespace), en zoeken vergelijkt hashes met
   timingSafeEqual over ALLE rijen in plaats van te stoppen bij de eerste.
   Het overzicht van de koper toont de code dus ook niet meer: wie hem kwijt
   is, roteert -- dan komt er een nieuwe en is de oude dood.

   EEN COLLECTIE, EEN SLOT. Elke controle en elke overgang van een bon loopt
   door `transactie()` -- in PostgreSQL een advisory lock plus FOR UPDATE op
   deze rij, in SQLite BEGIN IMMEDIATE (db/collectie-bewerken.js). Twee
   instances die tegelijk dezelfde code verzilveren, zien elkaar dus: de
   tweede leest de claim van de eerste. Zonder `bewerkCollectie` (een losse
   toets zonder opslag) werkt hij op een kopie en publiceert pas na de
   bewerking; in productie weigert hij dan hard.

   DE OUDE BONNEN. Tot 27 september 2026 stonden bonnen in `payTegoed`, als
   lijst, met een kale code van 96 bits. ./tegoed-migratie.js haalt ze hierheen
   en hasht die code op zijn plek: de houder heeft de kale code nog en die
   blijft werken, dus er gaat geen waarde verloren. */
'use strict';

const COL = 'payTegoedBon';
const REK_TEGOED = 'extern:tegoed';
const VERVAL_MS = 365 * 24 * 60 * 60 * 1000;   // een jaar; daarna haalt de koper het terug
const DOEL = 'pay-tegoedbon';
const SCOPE = ['tegoed.verzilveren'];

module.exports = ({ d, save, crypto, nu, bewerkCollectie }) => {
  const iso = () => new Date(nu()).toISOString();
  const kaal = s => String(s == null ? '' : s).toUpperCase().replace(/[^0-9A-Z]/g, '');
  // de normalisatie gaat de bearerlaag in (v2), zodat de hash niet na maak() wordt overschreven
  const bearer = require('../bearercode')({ crypto, namespace: 'pay-tegoed', nu: iso, normaal: kaal });
  /* Opmaak telt niet: een mens tikt `TG-1A2B-...` of plakt `tg1a2b...`.
     Streepjes, punten en spaties vallen weg vóór het hashen, bij de uitgifte
     en bij het zoeken hetzelfde. */
  const codeHash = code => bearer.hash(code);
  const weergave = code => {
    const k = kaal(code);
    return k.slice(0, 2) + '-' + k.slice(2).match(/.{1,4}/g).join('-');
  };

  function transactie(werk) {
    const doe = bron => {
      if (!bron || typeof bron !== 'object' || Array.isArray(bron))
        throw new Error(COL + ' hoort een kaart te zijn');
      return werk(bron);
    };
    if (typeof bewerkCollectie === 'function') return bewerkCollectie(COL, doe);
    if (process.env.NODE_ENV === 'production')
      throw new Error('Tegoedbonnen vragen in productie een collectietransactie.');
    const oud = d()[COL];
    const kopie = JSON.parse(JSON.stringify(oud && typeof oud === 'object' ? oud : {}));
    const voor = JSON.stringify(kopie);
    const r = doe(kopie);
    if (r && typeof r.then === 'function') throw new Error('Een tegoedtransactie mag niet asynchroon zijn.');
    if (JSON.stringify(kopie) !== voor) { d()[COL] = kopie; save(); }
    return r;
  }

  /* Lezen zonder slot, voor het overzicht: wie kijkt, verandert niets. */
  const kijk = () => {
    const v = d()[COL];
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  };

  /* Een nieuwe toegang: 128 bits, doel en scope vast, een keer te gebruiken.
     `vervalt` (ms) is de vervaldatum van de BON; een rotatie houdt hem gelijk. */
  function nieuweToegang(issuer, bonId, vervalt) {
    const g = bearer.maak({ prefix: 'TG', issuer, doel: DOEL, scope: SCOPE,
      onderwerp: { soort: 'tegoedbon', id: bonId }, geldigheid: { verlooptOp: new Date(vervalt).toISOString() },
      gebruik: { max: 1 }, afgeleid: 'geen' });
    return { code: weergave(g.code), toegang: g.toegang };
  }
  /* Bearercode v2: hetzelfde einde, en een v1-bon wordt hier v2. */
  function roteerToegang(oud, door) {
    const n = bearer.roteer(oud, { actor: door, prefix: 'TG', afgeleid: 'geen' });
    return { code: weergave(n.code), toegang: n.toegang };
  }

  /* Constant-time over de hele collectie: bearer.vind loopt ALLE rijen af en
     stopt niet bij de eerste treffer. Een geroteerde code staat alleen nog in
     `historie` en wordt dus niet gevonden. */
  const zoek = (bron, code) => bearer.vind(Object.values(bron), kaal(code),
    rij => rij && rij.toegang && rij.toegang.code_hash);
  const vervalt = t => Date.parse(t && t.toegang && t.toegang.expires_at);
  const verlopen = t => !(vervalt(t) > nu());

  /* Wat er naar buiten gaat: GEEN code en GEEN hash. `verlopen` wordt
     gerekend en niet bewaard. */
  const naarBuiten = t => ({
    id: t.id, centen: t.centen, oms: t.oms, status: t.status,
    van: t.van, aan: t.aan || null, at: t.at, vervalt: vervalt(t),
    verlopen: t.status === 'open' && verlopen(t),
    verzilverdDoor: t.verzilverdDoor || null, verzilverdAt: t.verzilverdAt || null,
    toegang: bearer.publiek(t.toegang), legacy96: !!t.legacy96
  });
  const kopie = t => JSON.parse(JSON.stringify(t));

  return { COL, REK_TEGOED, VERVAL_MS, DOEL, SCOPE, bearer, kaal, codeHash, roteerToegang,
    transactie, kijk, nieuweToegang, zoek, vervalt, verlopen, naarBuiten, kopie, iso };
};
