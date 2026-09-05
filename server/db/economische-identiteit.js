/* Eén definitie van de economische projectieregel. Een booking-id alleen is
   onvoldoende: herstel/drift kan onder hetzelfde id andere rekeningen,
   centen, soort of providerref hebben teruggezet. */
'use strict';

const normRef = v => v == null ? null : String(v);

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
   delta naast de gecommitte delta blijven bestaan. */
const saldoSamen = begin => ({ live, commit }) => {
  const uit = {}, huidig = live && typeof live === 'object' && !Array.isArray(live) ? live : {};
  const voor = begin && typeof begin === 'object' && !Array.isArray(begin) ? begin : {};
  const na = commit && typeof commit === 'object' && !Array.isArray(commit) ? commit : {};
  for (const rekening of new Set([...Object.keys(huidig), ...Object.keys(voor), ...Object.keys(na)])) {
    const waarde = Math.round(Number(huidig[rekening] || 0)) +
      (Math.round(Number(na[rekening] || 0)) - Math.round(Number(voor[rekening] || 0)));
    if (waarde) uit[rekening] = waarde;
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

module.exports = { gelijk, bewegingGelijk, vind, vindBeweging, saldoSamen, boekingenSamen };
