/* ============================================================================
   HET LEERHUIS (RTG Academy) -- de opslag en de ene deur waardoor alles gaat.

   Zie ACADEMY.md voor het waarom. Hier staat HOE:

   1. EEN SPOOR PER ORGANISATIE, GEKETTEND. db.data.leerhuis[org] is een lijst
      gebeurtenissen, nieuwste vooraan, elk met de hash van zijn voorganger
      (lib/keten.js). Er is geen tabel met standen: die worden uit het spoor
      gerekend (./projectie.js). Een wijziging achteraf breekt de keten op een
      aanwijsbaar punt; `verifieer()` laat dat zien.

   2. ALLES OF NIETS. Een handeling rekent eerst al haar gebeurtenissen uit
      tegen de huidige stand, en pas als er geen weigering is, gaan ze allemaal
      tegelijk het spoor in. Een halve certificering bestaat niet.

   3. IDEMPOTENT OP DE SLEUTEL. Een handeling met een sleutel die al eens
      slaagde, geeft hetzelfde antwoord terug en schrijft niets (`herhaald`).
      Dezelfde sleutel voor een andere handeling of een andere actor is een
      fout en geen herhaling. Bij een onbekende uitkomst vraagt de aanroeper
      `uitkomst(org, sleutel)` voordat hij blind opnieuw probeert.

   4. DE ACTOR KOMT VAN DE AANROEPER, UIT DE SESSIE. Deze module kent geen
      verzoek en vertrouwt geen veld `door` uit een body; de route geeft hem mee
      (AUTHORITY.md grens 1). `systeem:` kan niet van buiten komen.
   ========================================================================== */
'use strict';

const crypto = require('crypto');
const keten = require('../../lib/keten');
const { standUitSpoor } = require('./projectie');
const { Weigering, PERSOON, ID } = require('./hulp');

const ACTIES = Object.assign({}, require('./acties-bouw'), require('./acties-kennis'), require('./acties-mens'),
  require('./acties-oordeel'), require('./acties-simulatie'), require('./acties-cert'), require('./acties-evc'));

/* Besluit B4 (ACADEMY.md par. 5): deze drie handelingen zijn een verklaring
   over een mens, en die mag nooit bevestigd zijn terwijl de opslag hem nog niet
   heeft. Ze gaan via lib/duurzaam.js (check.js regel 47); de rest blijft
   write-behind, want een relatie of een oefening is geen verklaring. */
const DUURZAAM = new Set(['certificaatUitgeven', 'certificaatStand', 'beoordelingAfronden']);

function maakLeerhuis({ db, save, nu, bijeen, inBundel, bronToets }) {
  const klok = nu || Date.now;
  const eigen = require('../eigencollectie')({ db, domein: 'kern/leerhuis', bezit: { leerhuis: 'kaart' } });
  const nieuwId = () => crypto.randomBytes(6).toString('hex');
  /* Alleen met een echte opslagbundel; de proefwereld heeft er geen en schrijft
     dan gewoon. Waar hij er WEL is, weigert doe() de drie handelingen: die gaan
     uitsluitend via doeVast(), anders glipt er een bevestiging langs de opslag. */
  const vastleggen = typeof bijeen === 'function'
    ? require('../../lib/duurzaam')({ bijeen, save, inBundel, bron: 'leerhuis' }) : null;

  const spoorLees = (org) => (eigen.kijk('leerhuis')[org] || []);
  /* De bron wordt per vraag geraadpleegd en nergens gekopieerd: een kopie van
     een dienstverband is binnen een dag een tweede waarheid. */
  const stand = (org) => {
    const st = standUitSpoor(org, spoorLees(org));
    if (st.org && st.org.bron && typeof bronToets === 'function') st.bronToets = (p) => bronToets(st.org.bron, p);
    return st;
  };
  const weigering = (e) => ({ ok: false, status: e.status || 403, reden: e.message, hoe: e.hoe || null, opbouw: e.opbouw || null });

  /* Stap 1: alles uitrekenen tegen de huidige stand, niets schrijven. Geeft een
     antwoord (herhaald, niets te doen) of een plan met de regels. */
  function plan(org, actie, invoer, door, o) {
    if (typeof org !== 'string' || !ID.test(org)) throw new Weigering('organisatie ontbreekt of is ongeldig', 400);
    if (!Object.prototype.hasOwnProperty.call(ACTIES, actie)) throw new Weigering('onbekende handeling ' + actie, 400);
    if (typeof door !== 'string' || !PERSOON.test(door)) throw new Weigering('de actor komt uit de sessie en is een geldige sleutel', 401);
    const st = stand(org);
    if (o.sleutel) {
      const eerder = st.sleutels[o.sleutel];
      if (eerder) {
        if (eerder.actie !== actie || eerder.door !== door) throw new Weigering('deze sleutel hoort bij een andere handeling', 409);
        return { antwoord: { ok: true, herhaald: true, id: (eerder.data || {}).id || null, nr: eerder.nr } };
      }
    }
    const r = ACTIES[actie](st, invoer || {}, door, { nu: klok, id: nieuwId, sleutel: o.sleutel || null, org });
    const gebeurtenissen = Array.isArray(r) ? r : r.gebeurtenissen;
    if (!gebeurtenissen.length) return { antwoord: { ok: true, geschreven: 0, uit: r.uit || null } };
    return { gebeurtenissen, uit: r.uit || null };
  }

  /* Stap 2: het plan in een keer het spoor in. Synchroon, zonder await ertussen,
     zodat geen ander verzoek een halve handeling kan zien. */
  function schrijf(org, actie, door, o, p) {
    const regels = eigen.bak('leerhuis')[org] || (eigen.bak('leerhuis')[org] = []);
    const at = new Date(klok()).toISOString();
    let eerste = null;
    for (const g of p.gebeurtenissen) {
      const regel = { soort: g.soort, data: g.data, door: g.door || door, at, actie };
      if (!eerste && o.sleutel) regel.sleutel = o.sleutel;
      const w = keten.noteerIn(regels, regel, 0);
      if (!eerste) eerste = w;
    }
    return { ok: true, geschreven: p.gebeurtenissen.length, id: (eerste.data || {}).id || null, nr: eerste.nr, uit: p.uit };
  }

  function doe(org, actie, invoer, door, opties) {
    const o = opties || {};
    try {
      if (vastleggen && DUURZAAM.has(actie)) throw new Weigering(actie + ' gaat alleen duurzaam (doeVast)', 500);
      const p = plan(org, actie, invoer, door, o);
      if (p.antwoord) return p.antwoord;
      const uit = schrijf(org, actie, door, o, p);
      save();
      return uit;
    } catch (e) {
      if (e instanceof Weigering || e.status) return weigering(e);
      throw e;
    }
  }

  /* De deur voor een route: dezelfde handeling, maar de drie verklaringen
     antwoorden pas als de opslag ze heeft bevestigd.

     EEN MISLUKTE COMMIT IS EEN ONBEKENDE UITKOMST, GEEN MISLUKTE HANDELING.
     db/bijeen.js draait het geheugen niet terug: de regels staan in het spoor
     en een volgende save() kan ze alsnog wegschrijven. Het antwoord zegt dus
     niet "mislukt" maar "onbekend", en de weg is die van de opdracht (par. 23):
     eerst uitkomst(sleutel) navragen, dan pas opnieuw -- met DEZELFDE sleutel,
     zodat een herhaling nooit een tweede certificaat wordt. De regels er weer
     uit halen zou de keten breken zodra een ander verzoek er in de tussentijd
     een regel achter hing. */
  async function doeVast(org, actie, invoer, door, opties) {
    const o = opties || {};
    if (!DUURZAAM.has(actie)) return doe(org, actie, invoer, door, o);
    let p;
    try { p = plan(org, actie, invoer, door, o); } catch (e) {
      if (e instanceof Weigering || e.status) return weigering(e);
      throw e;
    }
    if (p.antwoord) return p.antwoord;
    if (!vastleggen) { const uit = schrijf(org, actie, door, o, p); save(); return uit; }
    let uit = null;
    const fout = await vastleggen(() => { uit = schrijf(org, actie, door, o, p); });
    if (fout) return { ok: false, status: fout.status || 503, onbekend: true,
      reden: 'de opslag heeft dit niet bevestigd; of het is vastgelegd, is onbekend',
      hoe: 'vraag eerst de uitkomst van deze sleutel na, en probeer het dan opnieuw met dezelfde sleutel' };
    return uit;
  }

  /* Wat is er met deze sleutel gebeurd? Voor een aanroeper die geen antwoord
     kreeg: eerst navragen, dan pas opnieuw (reconcile voor blind retry). */
  function uitkomst(org, sleutel) {
    const r = stand(org).sleutels[sleutel];
    return r ? { bekend: true, actie: r.actie, id: (r.data || {}).id || null, nr: r.nr, at: r.at } : { bekend: false };
  }

  const spoorKlopt = (org) => keten.verifieer(spoorLees(org));
  const organisaties = () => Object.keys(eigen.kijk('leerhuis')).sort();

  /* De leeskant staat in ./lees.js: elke vraag rekent op een verse projectie. */
  const lees = require('./lees')(stand, klok);

  /* Besluit B7: een startpakket loopt langs doe() zelf, elk stuk met een eigen
     sleutel; zie startpakket.js. */
  const startpakketLaden = (org, door) => require('./startpakket').laad({ doe, stand }, org, door);

  return { doe, doeVast, startpakketLaden, stand, uitkomst, verifieer: spoorKlopt, organisaties, spoor: spoorLees, lees, ACTIES: Object.keys(ACTIES).sort() };
}

module.exports = { maakLeerhuis, DUURZAAM };
