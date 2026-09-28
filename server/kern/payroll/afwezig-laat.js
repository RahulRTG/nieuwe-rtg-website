/* Afwezigheid voor de planners (./verzuim.js, afwezigOp), LAAT gelezen:
   payrollOS hangt pas in kernlaag2 in de kern, en de planners worden in
   server.js al eerder gemaakt. Daarom krijgt deze functie geen kern maar een
   manier om hem op te halen, en leest ze hem pas bij het aanroepen.
   Geen register is { onbekend: true } en nooit "niemand is afwezig" -- een
   planner die dat niet kan lezen, zegt het erbij. */
'use strict';

module.exports = (geefKern) => function afwezigOp(code, staffId, datum) {
  const kern = geefKern();
  const vz = kern && kern.payrollOS && kern.payrollOS.verzuim;
  return vz && typeof vz.afwezigOp === 'function' ? vz.afwezigOp(code, staffId, datum) : { onbekend: true };
};
