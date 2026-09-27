/* Productiegrendel voor Travel-bewijzen waarvan bezit nog rechtstreeks
   toegang of verbruik autoriseert, maar waarvan de lifecycle en atomaire
   claim nog niet zijn bewezen.

   Dit is bewust geen vrijschakelbare featureflag. Development en test houden
   de bestaande flows beschikbaar om ze te kunnen migreren en beproeven; in
   productie kunnen issuer, redisclosure en consumer niet worden bereikt. Een
   deur verdwijnt pas uit deze lijst nadat haar eigen hash-only lifecycle,
   intrekking, verval, retry en multi-instance claim groen zijn.

   Hard sluiten is risicobeheersing, geen migratiebewijs. CODECREDENTIALS houdt
   de groepen hieronder daarom op `remaining` en release_blocker=true. */
'use strict';

const STATUS = 503;
const CODE = 'TRAVEL_BEARER_NOT_RELEASED';
const BERICHT = 'Deze toegang is nog niet voor productie vrijgegeven. Er is niets uitgegeven of verbruikt.';

const PER_ROUTE = new Map([
  /* Leeg sinds 27 september 2026: de activiteitenkaart
     (kern/tickettoegang.js), het OV-vervoerbewijs (kern/mobiliteit/
     kaarttoegang.js) en de Arrival Pass (kern/arrivalpas.js) zijn alle drie
     gemigreerd. De grendel blijft staan als de plek waar een NIEUW
     travel-bewijs dicht gaat tot zijn eigen lifecycle bewezen is. */
]);

function normaliseerPad(waarde) {
  let pad = String(waarde || '').split('?')[0] || '/';
  try { pad = decodeURIComponent(pad); } catch (e) {}
  pad = pad.toLowerCase();
  while (pad.length > 1 && pad.endsWith('/')) pad = pad.slice(0, -1);
  return pad;
}

function featureVoor(req) {
  if (String(req && req.method || '').toUpperCase() !== 'POST') return null;
  return PER_ROUTE.get(normaliseerPad(req && (req.path || req.url))) || null;
}

module.exports = function travelBearerProductiepoort({ productie, env } = {}) {
  const omgeving = env || process.env;
  const isProductie = productie == null
    ? String(omgeving.NODE_ENV || '') === 'production' : productie === true;
  return function travelBearerProductiepoortMiddleware(req, res, next) {
    if (!isProductie) return next();
    const feature = featureVoor(req);
    if (!feature) return next();
    res.set('Cache-Control', 'no-store');
    return res.status(STATUS).json({ error: BERICHT, code: CODE, feature });
  };
};

module.exports.STATUS = STATUS;
module.exports.CODE = CODE;
module.exports.BERICHT = BERICHT;
module.exports.PER_ROUTE = PER_ROUTE;
module.exports.normaliseerPad = normaliseerPad;
module.exports.featureVoor = featureVoor;
