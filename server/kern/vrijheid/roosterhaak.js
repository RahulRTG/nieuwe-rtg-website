/* VRIJHEID: DE HAAK NAAR HET ROOSTER, en het terugnemen van toegekende tijd.

   `rooster` is een adapter met `pas`, `heeft` en `terug`; in de server is dat
   de brug naar het verzuimregister (./verzuimbrug.js). Zonder adapter staat
   een besluit op NIET_AANGESLOTEN, en een fout wordt ONBEKEND -- nooit
   "gelukt". `pas` mag zelf een stand teruggeven (NIET_DOORGEZET, met een
   reden), want een adapter die iets niet kan doorzetten hoort dat te zeggen. */
'use strict';

module.exports = ({ rooster, zend, tijd, org }) => {
  function roosterPas(code, obj, wijziging) {
    obj.roosterWijziging = wijziging;
    if (!rooster) { obj.rooster = 'NIET_AANGESLOTEN'; return; }
    try { const r = rooster.pas(code, wijziging); obj.rooster = (r && r.stand) || 'BIJGEWERKT'; if (r && r.reden) obj.roosterReden = r.reden; }
    catch (e) { obj.rooster = 'ONBEKEND'; obj.roosterFout = String(e && e.message || e); zend('RECONCILE_REQUIRED', { organisatie: code, id: obj.id }); }
  }
  /* Toegekende tijd TERUGNEMEN (ingetrokken, toch gewerkt, uit dienst): de
     boeking telt niet meer mee voor het saldo en de afwezigheid gaat uit het
     rooster. Op EEN plek, want wie het op drie plekken doet vergeet het op een:
     tot 27 september hield een ingetrokken verzoek zijn boeking, dus een
     ingetrokken RTG Day telde nog mee tegen de tien. */
  function vrijgaveTerug(code, obj) {
    const b = org(code).boekingen; const i = b.findIndex(x => x.id === obj.id);
    if (i >= 0) b[i] = Object.freeze({ ...b[i], ingetrokken: true, afwezigheid: null });
    if (!rooster || !rooster.terug || !['BIJGEWERKT', 'ONBEKEND'].includes(obj.rooster)) return;
    obj.roosterRichting = 'terug';
    try { rooster.terug(code, obj.roosterWijziging); obj.rooster = 'TERUGGEDRAAID'; }
    catch (e) { obj.rooster = 'ONBEKEND'; obj.roosterFout = String(e && e.message || e); zend('RECONCILE_REQUIRED', { organisatie: code, id: obj.id }); }
  }

  return { roosterPas, vrijgaveTerug };
};
