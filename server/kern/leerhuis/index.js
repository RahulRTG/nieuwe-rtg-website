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
const { herbouw } = require('./projectie');
const { Weigering, PERSOON, ID } = require('./hulp');
const zicht = require('./zicht');
const uitleg = require('./uitleg');
const gereedheid = require('./gereedheid');
const { geschiktheid } = require('./brug');
const { certStand } = require('./oordeel');

const ACTIES = Object.assign({}, require('./acties-bouw'), require('./acties-kennis'), require('./acties-mens'),
  require('./acties-oordeel'), require('./acties-simulatie'), require('./acties-cert'), require('./acties-evc'));

function maakLeerhuis({ db, save, nu }) {
  const klok = nu || Date.now;
  const eigen = require('../eigencollectie')({ db, domein: 'kern/leerhuis', bezit: { leerhuis: 'kaart' } });
  const nieuwId = () => crypto.randomBytes(6).toString('hex');

  const spoorLees = (org) => (eigen.kijk('leerhuis')[org] || []);
  const stand = (org) => herbouw(org, spoorLees(org));

  function doe(org, actie, invoer, door, opties) {
    const o = opties || {};
    try {
      if (typeof org !== 'string' || !ID.test(org)) throw new Weigering('organisatie ontbreekt of is ongeldig', 400);
      if (!Object.prototype.hasOwnProperty.call(ACTIES, actie)) throw new Weigering('onbekende handeling ' + actie, 400);
      if (typeof door !== 'string' || !PERSOON.test(door)) throw new Weigering('de actor komt uit de sessie en is een geldige sleutel', 401);
      const st = stand(org);
      if (o.sleutel) {
        const eerder = st.sleutels[o.sleutel];
        if (eerder) {
          if (eerder.actie !== actie || eerder.door !== door) throw new Weigering('deze sleutel hoort bij een andere handeling', 409);
          return { ok: true, herhaald: true, id: (eerder.data || {}).id || null, nr: eerder.nr };
        }
      }
      const ctx = { nu: klok, id: nieuwId };
      const r = ACTIES[actie](st, invoer || {}, door, ctx);
      const gebeurtenissen = Array.isArray(r) ? r : r.gebeurtenissen;
      if (!gebeurtenissen.length) return { ok: true, geschreven: 0, uit: r.uit || null };
      const regels = eigen.bak('leerhuis')[org] || (eigen.bak('leerhuis')[org] = []);
      const at = new Date(klok()).toISOString();
      let eerste = null;
      for (const g of gebeurtenissen) {
        const regel = { soort: g.soort, data: g.data, door: g.door || door, at, actie };
        if (!eerste && o.sleutel) regel.sleutel = o.sleutel;
        const w = keten.noteerIn(regels, regel, 0);
        if (!eerste) eerste = w;
      }
      save();
      return { ok: true, geschreven: gebeurtenissen.length, id: (eerste.data || {}).id || null, nr: eerste.nr, uit: r.uit || null };
    } catch (e) {
      if (e instanceof Weigering || e.status) return { ok: false, status: e.status || 403, reden: e.message, hoe: e.hoe || null, opbouw: e.opbouw || null };
      throw e;
    }
  }

  /* Wat is er met deze sleutel gebeurd? Voor een aanroeper die geen antwoord
     kreeg: eerst navragen, dan pas opnieuw (reconcile voor blind retry). */
  function uitkomst(org, sleutel) {
    const r = stand(org).sleutels[sleutel];
    return r ? { bekend: true, actie: r.actie, id: (r.data || {}).id || null, nr: r.nr, at: r.at } : { bekend: false };
  }

  const spoorKlopt = (org) => keten.verifieer(spoorLees(org));
  const organisaties = () => Object.keys(eigen.kijk('leerhuis')).sort();

  /* De leeskant: elke vraag rekent op een verse projectie van EEN organisatie. */
  const t = () => klok();
  const lees = {
    mijn: (org, p) => zicht.mijn(stand(org), p, t()),
    vakstaat: (org, p) => zicht.vakstaat(stand(org), p, t()),
    trainerCockpit: (org, p) => zicht.trainerCockpit(stand(org), p),
    managerCockpit: (org, p) => zicht.managerCockpit(stand(org), p, t()),
    geschiktheid: (org, p, h) => geschiktheid(stand(org), p, h, t()),
    gereedheid: (org, eisen) => gereedheid.teamGereed(stand(org), eisen, t()),
    eenheid: (org) => gereedheid.eenheid(stand(org), t()),
    loopbaan: (org, p, rol) => gereedheid.loopbaan(stand(org), p, rol, t()),
    waaromLeren: (org, p, c) => uitleg.waaromLeren(stand(org), p, c),
    waaromNietGereed: (org, p, rol) => uitleg.waaromNietGereed(stand(org), p, rol, t()),
    waaromVerversen: (org, p) => uitleg.waaromVerversen(stand(org), p, t()),
    waaromTrainer: (org, p, c) => uitleg.waaromTrainer(stand(org), p, c),
    wieGeraakt: (org, k, klasse) => uitleg.wieGeraakt(stand(org), k, klasse),
    reconstrueer: (org, c) => uitleg.reconstrueer(stand(org), c, t()),
    grond: (org, vraag) => uitleg.grond(stand(org), vraag),
    certStand: (org, c) => { const st = stand(org); return st.certificaten[c] ? certStand(st, st.certificaten[c], t()) : null; }
  };

  return { doe, stand, uitkomst, verifieer: spoorKlopt, organisaties, spoor: spoorLees, lees, ACTIES: Object.keys(ACTIES).sort() };
}

module.exports = { maakLeerhuis };
