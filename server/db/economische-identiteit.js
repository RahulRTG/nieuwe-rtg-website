/* Eén definitie van de economische projectieregel. Een booking-id alleen is
   onvoldoende: herstel/drift kan onder hetzelfde id andere rekeningen,
   centen, soort of providerref hebben teruggezet. */
'use strict';

const normRef = v => v == null ? null : String(v);
const heeft = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

/* DE VORM VAN EEN ECONOMISCHE SLEUTEL, op een plek voor alle drie de opslagen
   (sqlite, PostgreSQL, de proceslokale ontwikkelweg) EN voor de Rust-motor.
   Een gesloten lijst soorten en geen vrije tekst; achter de dubbele punt staat
   altijd een SHA-256, want deze sleutel wordt een permanente primaire sleutel
   en een providerref of codenaam hoort daar niet in.

     payout-terug   een teruggeboekte uitbetaling
     pay-tegoed     geld dat een tegoedbon uit de escrow haalt (kern/pay/tegoed-claim.js)
     pay-kas        een deel onder een kascode-claim (kern/pay/kas-boek.js)
     pay-oplaad     een bevestigde oplading, op het id van de betaling
     pay-vonk       een deel van een Vonk-date (kern/vonk/payment.js)
     pay-klompje    de betaling van EEN betaalverzoek, op het id van het verzoek
     pay-handeling  een boeking op een bedrijfsobject buiten een idem-handeling
                    (een OV-rit, een storingsteruggave, een verrekening)
     pay-stap       stap n binnen een idem-handeling (lib/idem.js volgendeStap)

   WAAROM DE LIJST HIER EN IN DE MOTOR LETTERLIJK GELIJK MOET ZIJN. De motor
   (motor/src/pay.rs, ECONOMISCHE_SOORTEN) weigert elke andere vorm met 400, en
   precies zo stond een bevestigde kaartbetaling voor altijd onbijgeschreven: de
   JS-kant stuurde `pay-oplaad:BW-...` en de motor kende alleen drie soorten.
   test/geld-motorsleutel.test.js legt beide lijsten tegen de ECHTE binary. */
const SOORTEN = Object.freeze(['payout-terug', 'pay-tegoed', 'pay-kas', 'pay-oplaad',
  'pay-vonk', 'pay-klompje', 'pay-handeling', 'pay-stap']);
const SLEUTEL = new RegExp('^(?:' + SOORTEN.join('|') + '):[a-f0-9]{64}$');

/* Maakt een sleutel uit een soort en de delen van een BEDRIJFSidentiteit (een
   betaling-id, een verzoek-id, een idem-sleutel met stapnummer). De delen gaan
   met een scheidingsteken dat in geen van hen voorkomt door SHA-256, zodat
   ('a:b','c') en ('a','b:c') nooit dezelfde sleutel geven. Een onbekende soort
   of een leeg deel is een programmeerfout en gooit: liever luid dan een sleutel
   die de motor straks weigert terwijl het geld al van de kaart is. */
function maakSleutel(soort, delen) {
  if (!SOORTEN.includes(soort)) throw new Error('Onbekende soort economische sleutel: ' + soort);
  const lijst = Array.isArray(delen) ? delen : [delen];
  if (!lijst.length || lijst.some(x => x == null || String(x) === ''))
    throw new Error('Een economische sleutel vraagt een volledige bedrijfsidentiteit.');
  const h = require('crypto').createHash('sha256')
    .update(['v1', soort, ...lijst.map(String)].join('\u001f')).digest('hex');
  return soort + ':' + h;
}

function gelijk(a, b) {
  return !!a && !!b && typeof a.id === 'string' && a.id.length > 0 &&
    a.id === b.id && a.van === b.van && a.naar === b.naar &&
    Number.isSafeInteger(a.centen) && a.centen === b.centen &&
    a.soort === b.soort && normRef(a.ref) === normRef(b.ref);
}

function bewegingGelijk(a, b) {
  return !!a && !!b && a.van === b.van && a.naar === b.naar &&
    Number.isSafeInteger(a.centen) && a.centen === b.centen &&
    a.soort === b.soort && normRef(a.ref) === normRef(b.ref);
}

function vind(data, collecties, antwoord) {
  const verwacht = antwoord && antwoord.boeking;
  if (!verwacht) return false;
  return collecties.filter(k => /Boekingen$/.test(k)).some(k =>
    Array.isArray(data[k]) && data[k].some(rij => gelijk(verwacht, rij)));
}

function vindBeweging(data, collecties, identiteit) {
  return collecties.filter(k => /Boekingen$/.test(k)).some(k =>
    Array.isArray(data[k]) && data[k].some(rij => bewegingGelijk(identiteit, rij)));
}

/* Saldi zijn geen gewone objectvelden maar de som van boekingsdelta's. Als een
   normale mutatie tijdens database-I/O dezelfde rekening raakte, moet haar
   delta naast de gecommitte delta blijven bestaan.

   EEN SALDO VAN NUL IS EEN SALDO, GEEN AFWEZIGE REKENING. Hier stond
   `if (waarde)`, en dat liet een rekening die door de commit op precies nul
   uitkwam uit de levende kopie vallen terwijl de database hem met 0 bewaarde.
   Het volgende verzoek dat die rekening raakte zag dan als basis "geen
   rekening", als database "0" en als eigen stand het nieuwe bedrag -- en de
   conflictvaste requestmerge (pg/verzoekmerge.js) weigerde terecht met 409.
   Gevonden met de tegoedbon: de escrow `extern:tegoed` staat na een
   verzilvering vaak op exact nul (test/tegoedbon-routes.test.js tegen
   PostgreSQL). Alleen een rekening die in geen van de drie standen voorkomt,
   blijft weg. */
const saldoSamen = begin => ({ live, commit }) => {
  const uit = {}, huidig = live && typeof live === 'object' && !Array.isArray(live) ? live : {};
  const voor = begin && typeof begin === 'object' && !Array.isArray(begin) ? begin : {};
  const na = commit && typeof commit === 'object' && !Array.isArray(commit) ? commit : {};
  for (const rekening of new Set([...Object.keys(huidig), ...Object.keys(voor), ...Object.keys(na)])) {
    const waarde = Math.round(Number(huidig[rekening] || 0)) +
      (Math.round(Number(na[rekening] || 0)) - Math.round(Number(voor[rekening] || 0)));
    if (waarde || heeft(huidig, rekening) || heeft(na, rekening)) uit[rekening] = waarde;
  }
  return uit;
};

const boekingenSamen = ({ live, commit }) => {
  const uit = [], gezien = new Set();
  for (const rij of [...(Array.isArray(commit) ? commit : []), ...(Array.isArray(live) ? live : [])]) {
    const sleutel = rij && rij.id;
    if (!sleutel || gezien.has(sleutel)) continue;
    gezien.add(sleutel); uit.push(rij);
  }
  return uit;
};

module.exports = { SOORTEN, SLEUTEL, maakSleutel, gelijk, bewegingGelijk, vind, vindBeweging, saldoSamen, boekingenSamen };
