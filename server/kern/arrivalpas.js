/* DE ARRIVAL PASS als credential (livingos.invisible_arrival_pass).

   De gast heeft geen account; zijn pass is een bearer. Daarom: de SERVER maakt
   hem (AR.<32 hex>, 128 bits via ./bearercode.js -- vroeger koos de browser
   hem, met randomUUID 122 bits); hij staat alleen als hash in `arrivalToegang`
   en kaal alleen in het antwoord op de aanvraag of een rotatie; hij vervalt op
   aankomst + 12 uur en een aanvraag mag hooguit HORIZON_DAGEN vooruit;
   max_gebruik telt PULSEN (lezen is geremd en vervalt met de pass); intrekken,
   roteren en gebruiken lopen in een collectietransactie; een reservering die
   niet doorgaat sluit de pass; zoeken is constant-time.

   De `requestToken` van de browser is alleen de idempotentiesleutel (hash op
   de rij). Een herhaling ROTEERT: binnen een kwartier, zolang de pass ongebruikt
   is en hooguit MAX_HERSTEL keer. De eerste pass wordt nooit opnieuw getoond. */
'use strict';

const klok = require('../lib/klok');

const DOEL = 'arrival-pass';
const SCOPE = Object.freeze(['arrival.pass.lezen', 'arrival.puls']);
const HORIZON_DAGEN = 60;
const NA_AANKOMST_MS = 12 * 3600000;
const HERSTEL_MS = 15 * 60000;
const MAX_HERSTEL = 3;
const MAX_PULSEN = 60;
const BEWAAR_MS = 30 * 86400000;
const DICHT = Object.freeze(['geweigerd', 'geannuleerd', 'no-show', 'afgerond']);
const VORM = /^AR\.[0-9A-F]{32}$/i;

module.exports = ({ db, bewerkCollectie, crypto, nu = () => klok.datum().toISOString() }) => {
  if (typeof bewerkCollectie !== 'function') throw new Error('De Arrival Pass vereist een collectietransactie.');
  const bearer = require('./bearercode')({ crypto, namespace: 'livingos.invisible_arrival_pass', nu });
  const eigen = require('./eigencollectie')({ db, domein: 'kern/arrivalpas', bezit: { arrivalToegang: 'kaart' } });
  const ms = () => Date.parse(nu());
  const iso = t => new Date(t).toISOString();
  const aanvraagHash = raw => crypto.createHash('sha256').update('rtg-arrival-aanvraag-v1|' + String(raw)).digest('hex');
  const transactie = werk => bewerkCollectie('arrivalToegang', bron => {
    if (!bron || typeof bron !== 'object' || Array.isArray(bron)) throw new Error('arrivalToegang hoort een kaart te zijn');
    return werk(bron);
  });

  const aankomst = (datum, tijd) => new Date(datum + 'T' + tijd + ':00').getTime();
  const binnenHorizon = (datum, tijd) => {
    const t = aankomst(datum, tijd);
    return Number.isFinite(t) && t <= ms() + HORIZON_DAGEN * 86400000;
  };

  // constant-time: elke rij, ook na een treffer
  function zoek(bron, raw) {
    const kale = String(raw || '').trim();
    if (!VORM.test(kale)) return null;
    const gezocht = bearer.hash(kale);
    let rij = null;
    for (const r of Object.values(bron || {}))
      if (bearer.zelfdeHash(r && r.toegang && r.toegang.code_hash, gezocht)) rij = r;
    return rij;
  }

  function nieuwePas(rij) {
    const rotatie = Math.max(0, ...[rij.toegang, ...rij.historie].filter(Boolean).map(t => Number(t.rotatie) || 0)) + 1;
    if (rij.toegang) {
      bearer.intrekken(rij.toegang, 'rotatie', 'vervangen door een nieuwe pass');
      rij.historie.push(rij.toegang);
      if (rij.historie.length > 6) rij.historie.splice(0, rij.historie.length - 6);
    }
    const g = bearer.maak({ prefix: 'AR', issuer: 'rtg.gast.arrival', doel: DOEL, scope: SCOPE,
      onderwerp: { soort: 'arrival', id: rij.id, supplierCode: rij.supplierCode, reserveringId: rij.reserveringId },
      geldigheid: { verlooptOp: rij.tot }, gebruik: { max: MAX_PULSEN }, afgeleid: 'geen' });
    g.toegang.rotatie = rotatie;
    rij.toegang = g.toegang;
    rij.bijgewerkt_at = nu();
    return g.code;
  }

  function ruim(bron) {
    const grens = ms() - BEWAAR_MS;
    for (const [id, r] of Object.entries(bron))
      if (!r || !(Date.parse(r.tot) >= grens)) delete bron[id];
  }

  // een reservering die niet meer doorgaat maakt de pass nutteloos
  function oordeel(rij, reserveringVan, { puls } = {}) {
    if (!rij) return { status: 401, error: 'Deze Arrival Pass is niet geldig.' };
    const t = rij.toegang, ow = (t && t.onderwerp) || {};
    if (ow.id !== rij.id || ow.supplierCode !== rij.supplierCode || ow.reserveringId !== rij.reserveringId)
      return { status: 401, error: 'Deze Arrival Pass is niet geldig.' };
    const reden = bearer.reden(t, { doel: DOEL, scope: puls ? ['arrival.puls'] : ['arrival.pass.lezen'], negeerGebruik: !puls });
    if (reden === 'verlopen') return { status: 410, error: 'Deze Arrival Pass is verlopen.' };
    if (reden === 'ingetrokken') return { status: 410, error: 'Deze Arrival Pass is ingetrokken.' };
    if (reden === 'opgebruikt') return { status: 429, error: 'Met deze pass is het maximale aantal statusupdates gedeeld.' };
    if (reden) return { status: 401, error: 'Deze Arrival Pass is niet geldig.' };
    const r = typeof reserveringVan === 'function' ? reserveringVan(rij.reserveringId) : null;
    if (!r || r.supplierCode !== rij.supplierCode || DICHT.includes(r.status))
      return { status: 410, error: 'Deze reservering gaat niet (meer) door; de pass is gesloten.', dicht: true };
    return null;
  }

  // de route maakt reserveringId vooraf; bij een herhaling geldt de opgeslagen
  function aanvraag({ requestToken, supplierCode, reserveringId, datum, tijd }) {
    const ah = aanvraagHash(requestToken);
    const tot = aankomst(datum, tijd) + NA_AANKOMST_MS;
    // een pass die bij uitgifte al verlopen is, is geen pass; v1 gaf hem met 200
    if (!(tot > ms() + 60000)) return { status: 400, error: 'Deze aankomst ligt al voorbij; daar hoort geen Arrival Pass meer bij.' };
    return transactie(bron => {
      let bestaand = null;
      for (const r of Object.values(bron)) if (bearer.zelfdeHash(r && r.aanvraag_hash, ah)) bestaand = r;
      if (bestaand) {
        const t = bestaand.toegang;
        if (bestaand.supplierCode !== supplierCode || ms() > Date.parse(bestaand.aanvraag_tot) ||
            (bestaand.herstel || 0) >= MAX_HERSTEL || !t || t.gebruik > 0 ||
            bearer.reden(t, { doel: DOEL, scope: SCOPE, negeerGebruik: true }))
          return { status: 409, error: 'Deze aanvraag is al verwerkt; de pass wordt maar een keer getoond.' };
        bestaand.herstel = (bestaand.herstel || 0) + 1;
        return { status: 200, herhaald: true, id: bestaand.id, reserveringId: bestaand.reserveringId, tot: bestaand.tot,
          code: nieuwePas(bestaand) };
      }
      ruim(bron);
      const id = crypto.randomBytes(16).toString('hex');
      const rij = bron[id] = { id, supplierCode, reserveringId, aanvraag_hash: ah,
        aanvraag_tot: iso(ms() + HERSTEL_MS), herstel: 0, tot: iso(tot), toegang: null, historie: [],
        prep_at: null, at: nu(), bijgewerkt_at: nu() };
      return { status: 200, nieuw: true, id, reserveringId, tot: rij.tot, code: nieuwePas(rij) };
    });
  }

  // heeft deze aanvraagcode al een rij? alleen voor de capaciteitsvraag; aanvraag() beslist
  function kent(requestToken) {
    const ah = aanvraagHash(requestToken);
    let ja = false;
    for (const r of Object.values(eigen.kijk('arrivalToegang'))) if (bearer.zelfdeHash(r && r.aanvraag_hash, ah)) ja = true;
    return ja;
  }

  // lezen uit de werkkopie; een dichte pass legt de route vast met sluitDicht()
  function lees(raw, reserveringVan) {
    const rij = zoek(eigen.kijk('arrivalToegang'), raw);
    const fout = oordeel(rij, reserveringVan);
    return fout ? Object.assign({ rij }, fout) : { status: 200, rij };
  }

  function sluitDicht(id, reden) {
    return transactie(bron => {
      const r = bron[id];
      if (r && r.toegang && !r.toegang.ingetrokken_at) {
        bearer.intrekken(r.toegang, 'systeem', reden);
        r.bijgewerkt_at = nu();
      }
      return { ok: true };
    });
  }

  /* Een puls: gebruik en de eenmalige voorbereidingsclaim in EEN transactie,
     zodat twee instances nooit allebei een missie maken. */
  function puls(raw, soort, reserveringVan) {
    return transactie(bron => {
      const rij = zoek(bron, raw);
      const fout = oordeel(rij, reserveringVan, { puls: true });
      if (fout) {
        if (fout.dicht) bearer.intrekken(rij.toegang, 'systeem', 'reservering gaat niet door');
        return fout;
      }
      bearer.gebruik(rij.toegang);
      let prep = false;
      if ((soort === 'in-de-buurt' || soort === 'gearriveerd') && !rij.prep_at) { rij.prep_at = nu(); prep = true; }
      rij.bijgewerkt_at = nu();
      return { status: 200, id: rij.id, supplierCode: rij.supplierCode, prep };
    });
  }

  function roteer(raw, reserveringVan) {
    return transactie(bron => {
      const rij = zoek(bron, raw);
      const fout = oordeel(rij, reserveringVan);
      if (fout) return fout;
      return { status: 200, id: rij.id, supplierCode: rij.supplierCode, code: nieuwePas(rij) };
    });
  }

  // de houder trekt in; een tweede keer verandert niets meer
  function intrek(raw) {
    return transactie(bron => {
      const rij = zoek(bron, raw);
      if (!rij) return { status: 401, error: 'Deze Arrival Pass is niet geldig.' };
      if (!rij.toegang.ingetrokken_at) {
        bearer.intrekken(rij.toegang, 'houder', 'door de gast ingetrokken');
        rij.bijgewerkt_at = nu();
      }
      return { status: 200, id: rij.id, supplierCode: rij.supplierCode };
    });
  }

  const publiek = rij => rij ? bearer.publiek(rij.toegang) : null;

  return { aanvraag, kent, lees, sluitDicht, puls, roteer, intrek, publiek, binnenHorizon, zoek,
    DOEL, SCOPE, HORIZON_DAGEN, MAX_PULSEN };
};

module.exports.DOEL = DOEL;
module.exports.SCOPE = SCOPE;
