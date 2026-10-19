/* Horeca (kern): HAPPY HOUR. Afgesplitst uit ../horeca.js: dat bestand rekent
   met wat er op een rekening STAAT (som, korting, openstaand), dit beslist welke
   prijs er op het moment van bestellen GELDT -- een tijdsregel van de zaak.

   Het leest de doos via Hlees (lezen zonder scheppen): een gastcheckout op een
   zaak zonder horecadoos legde hier eerder via H() een lege doos aan. */
'use strict';
const tijdzone = require('../tijdzone');

/* Happy hour: een tijdvak met een percentage op bepaalde groepen. Bewust
   berekend op het moment van BESTELLEN en niet bij het afrekenen -- anders
   verandert de prijs van een biertje nadat de gast hem heeft besteld, en dat
   is precies het soort verrassing waar mensen boos van worden. */
function happyKorting(h, groep, wanneer) {
  const lijst = Array.isArray(h.instel.happy) ? h.instel.happy : [];
  const t = wanneer ? new Date(wanneer) : new Date();
  const hier = tijdzone.huis(t); // het tijdvak staat in de tijd van de zaak, niet van de container
  const dag = hier.dag; // 0 = zondag
  const klok = hier.hhmm;
  for (const hh of lijst) {
    if (Array.isArray(hh.dagen) && hh.dagen.length && !hh.dagen.includes(dag)) continue;
    if (hh.van && klok < hh.van) continue;
    if (hh.tot && klok > hh.tot) continue;
    if (Array.isArray(hh.groepen) && hh.groepen.length && groep && !hh.groepen.includes(groep)) continue;
    if (Array.isArray(hh.groepen) && hh.groepen.length && !groep) continue;
    return { naam: hh.naam || 'Happy hour', procent: Math.max(0, Math.min(90, Number(hh.procent) || 0)) };
  }
  return null;
}

module.exports = { happyKorting };
