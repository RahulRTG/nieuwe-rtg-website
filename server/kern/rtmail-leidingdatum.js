/* RTMAIL (deelmodule): de datums van de juridische hold (./rtmail-leidinghold.js).
   Een echte kalenderdag, in de toekomst, en hoogstens twaalf maanden na het
   moment van DEZE beoordeling -- niet na de vorige datum, zodat opgespaarde tijd
   niet kan worden doorgeschoven. Een hold kan langer gelden, maar alleen door hem
   opnieuw te beoordelen: zo wordt hij nooit stil permanent (besluit van de
   eigenaar; de termijn staat hier en nergens anders). */
'use strict';

const dag = (iso) => String(iso || '').slice(0, 10);
// een echte kalenderdag: 2027-02-31 rolt bij het parsen door naar maart en telt dus niet
const isDatum = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  !isNaN(Date.parse(s + 'T00:00:00Z')) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
/* Hoogstens twaalf maanden vooruit: een hold kan langer gelden, maar alleen door
   hem opnieuw te beoordelen -- zo wordt hij nooit stil permanent. */
const MAAND_MAX = 12;
function binnenTermijn(s, t) {
  if (!isDatum(s) || s <= dag(t)) return false;
  // kappen op de laatste dag van de doelmaand: 29 februari + 12 maanden is 28 februari, geen 1 maart
  const v = new Date(dag(t) + 'T00:00:00Z'), m = v.getUTCMonth() + MAAND_MAX;
  const laatste = new Date(Date.UTC(v.getUTCFullYear(), m + 1, 0)).getUTCDate();
  const grens = new Date(Date.UTC(v.getUTCFullYear(), m, Math.min(v.getUTCDate(), laatste)));
  return s <= grens.toISOString().slice(0, 10);
}
const DATUMFOUT = 'Geef een herbeoordelingsdatum (JJJJ-MM-DD) die bestaat, in de toekomst ligt en hoogstens ' + MAAND_MAX + ' maanden vooruit.';

module.exports = { isDatum, binnenTermijn, DATUMFOUT, MAAND_MAX };
