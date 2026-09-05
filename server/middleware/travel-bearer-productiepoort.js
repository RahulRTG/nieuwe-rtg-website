/* Productiegrendel voor Travel-bewijzen waarvan bezit nog rechtstreeks
   toegang of verbruik autoriseert, maar waarvan de lifecycle en atomaire
   claim nog niet zijn bewezen.

   Dit is bewust geen vrijschakelbare featureflag. Development en test houden
   de bestaande flows beschikbaar om ze te kunnen migreren en beproeven; in
   productie kunnen issuer, redisclosure en consumer niet worden bereikt. Een
   deur verdwijnt pas uit deze lijst nadat haar eigen hash-only lifecycle,
   intrekking, verval, retry en multi-instance claim groen zijn.

   Hard sluiten is risicobeheersing, geen migratiebewijs. CODECREDENTIALS houdt
   deze drie groepen daarom op `remaining` en release_blocker=true. */
'use strict';

const STATUS = 503;
const CODE = 'TRAVEL_BEARER_NOT_RELEASED';
const BERICHT = 'Deze toegang is nog niet voor productie vrijgegeven. Er is niets uitgegeven of verbruikt.';

const PER_ROUTE = new Map([
  /* Activiteitenkaart: issuer, eigen redisclosure, zaakprogramma en deurclaim. */
  ['/api/ticket/koop', 'travelos.activity_ticket_entry'],
  ['/api/tickets/mijn', 'travelos.activity_ticket_entry'],
  ['/api/supplier/programma', 'travelos.activity_ticket_entry'],
  ['/api/supplier/ticket/checkin', 'travelos.activity_ticket_entry'],
  ['/api/supplier/ticket/deurverkoop', 'travelos.activity_ticket_entry'],

  /* Invisible Arrival: issuer, redisclosure/validatie, pulse en zaakkant. */
  ['/api/arrival/request', 'livingos.invisible_arrival_pass'],
  ['/api/arrival/pass', 'livingos.invisible_arrival_pass'],
  ['/api/arrival/pulse', 'livingos.invisible_arrival_pass'],
  ['/api/supplier/horeca/arrivals', 'livingos.invisible_arrival_pass'],
  ['/api/supplier/horeca/arrival/promise', 'livingos.invisible_arrival_pass'],

  /* OV-bewijs: losse kaart, abonnement, samengestelde boeking en controle. */
  ['/api/mob/kaart/koop', 'travelos.mobility_transport_ticket'],
  ['/api/mob/kaart/mijn', 'travelos.mobility_transport_ticket'],
  ['/api/mob/abo/koop', 'travelos.mobility_transport_ticket'],
  ['/api/mob/abo/mijn', 'travelos.mobility_transport_ticket'],
  ['/api/mob/reis/boek', 'travelos.mobility_transport_ticket'],
  ['/api/staff/mob/kaart/controle', 'travelos.mobility_transport_ticket']
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
