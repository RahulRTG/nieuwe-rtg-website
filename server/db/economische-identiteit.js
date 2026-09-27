/* Eén definitie van de economische projectieregel. Een booking-id alleen is
   onvoldoende: herstel/drift kan onder hetzelfde id andere rekeningen,
   centen, soort of providerref hebben teruggezet. */
'use strict';

const normRef = v => v == null ? null : String(v);
const heeft = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

/* DE VORM VAN EEN ECONOMISCHE SLEUTEL, op een plek voor alle drie de opslagen
   (sqlite, PostgreSQL, de proceslokale ontwikkelweg). Twee soorten en geen
   vrije tekst: `payout-terug` voor een teruggeboekte uitbetaling en
   `pay-tegoed` voor geld dat een tegoedbon uit de escrow haalt
   (kern/pay/tegoed-claim.js). Achter de dubbele punt staat altijd een
   SHA-256, want deze sleutel wordt een permanente primaire sleutel en een
   providerref of codenaam hoort daar niet in. De Rust-motor kent dezelfde twee
   (motor/src/pay.rs, economische_sleutel_geldig). */
const SLEUTEL = /^(?:payout-terug|pay-tegoed):[a-f0-9]{64}$/;

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

module.exports = { SLEUTEL, gelijk, bewegingGelijk, vind, vindBeweging, saldoSamen, boekingenSamen };
