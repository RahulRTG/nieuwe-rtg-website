/* Vast ticketbeleid en de kalendergrens van de RTG-huiszone. De uitgifte en
   claim blijven in ../tickettoegang.js; hier staat alleen wat iedere claim
   hetzelfde moet uitleggen. */
'use strict';
const tijdzone = require('../tijdzone');

const DOEL = 'activiteit-entree';
const SCOPE = Object.freeze(['zaak.ticket.checkin']);
const BEWAAR_MS = 30 * 86400000;
const DICHT = ['geweigerd', 'geannuleerd'];
const vandaag = nu => tijdzone.datumIn(new Date(nu));
const eindVan = datum => tijdzone.middernacht(tijdzone.plusDagen(datum, 1)).getTime() - 1;
const houder = (crypto, b) => crypto.createHash('sha256').update('rtg-ticket-houder-v1|' +
  String(b.customerKey || b.customerTier || ('deur:' + b.supplierCode))).digest('hex');

module.exports = { DOEL, SCOPE, BEWAAR_MS, DICHT, vandaag, eindVan, houder };
