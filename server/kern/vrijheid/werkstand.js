/* VRIJHEID: DE WERKSTAND -- en waarom "geen taken meer" niet "klaar" is.

   Wie vrijheid geeft zodra de takenlijst leeg is, maakt er een race van: vink
   snel af en je mag naar huis. Daarom is WORK_COMPLETE hier nooit
   `taken.length === 0`. Er wordt gekeken naar VERANTWOORDELIJKHEDEN, en een
   verantwoordelijkheid is pas af als iets anders dan de mens zelf dat zegt:

     - een systeem dat het objectief weet (`bron: 'systeem'`, bijvoorbeeld een
       gesloten kas of een afgeronde bestelling), of
     - een ander mens die het bevestigt (`bevestigdDoor` is iemand anders).

   Een kritieke verantwoordelijkheid die alleen door de houder zelf is
   afgevinkt, is UNKNOWN. En bij een kritieke UNKNOWN geeft RTG geen
   automatische vrijheid -- dan kijkt een mens. Dat is geen wantrouwen tegen
   de medewerker; het is dat een zelfverklaring geen bewijs is, voor niemand.

   Een lege lijst is ook UNKNOWN: "er is niets vastgelegd" is niet "er is
   niets te doen".

   Wat hier NIET gebeurt: tellen hoe SNEL iemand klaar was. Dat zou een
   verborgen productiviteitsscore zijn (NO_HIDDEN_PEOPLE_SCORE). */
'use strict';

const STANDEN = Object.freeze(['WORK_OPEN', 'HANDOVER_POSSIBLE', 'WORK_COMPLETE', 'CRITICAL_WORK_REMAINS', 'UNKNOWN']);

function bewezenKlaar(v, persoon) {
  if (!v.klaar) return false;
  if (v.bron === 'systeem') return true;
  return !!v.bevestigdDoor && v.bevestigdDoor !== persoon;
}
const overgedragen = (v, persoon) => !!v.overgedragenAan && v.overgedragenAan !== persoon && v.aanvaard === true;

function werkstand(team, persoon, datum) {
  const lijst = (team.verantwoordelijkheden || []).filter(v => v.persoon === persoon && (!v.datum || v.datum === datum));
  if (!lijst.length)
    return { stand: 'UNKNOWN', kritiek: true, uitleg: 'Er zijn voor vandaag geen verantwoordelijkheden vastgelegd; een lege lijst bewijst niet dat het werk af is.' };

  const open = []; const zelfverklaard = []; const overdraagbaar = [];
  for (const v of lijst) {
    if (bewezenKlaar(v, persoon) || overgedragen(v, persoon)) continue;
    if (v.klaar && v.kritiek) { zelfverklaard.push(v); continue; }
    if (v.kritiek) { open.push(v); continue; }
    if (v.klaar) continue;                                 // niet-kritiek, zelf afgevinkt: goed genoeg
    if (v.overdraagbaar) overdraagbaar.push(v); else open.push(v);
  }
  const namen = (l) => l.map(v => v.naam || v.id).join(', ');
  if (open.some(v => v.kritiek))
    return { stand: 'CRITICAL_WORK_REMAINS', kritiek: true, uitleg: 'Kritiek werk staat nog open: ' + namen(open.filter(v => v.kritiek)) + '.' };
  if (zelfverklaard.length)
    return { stand: 'UNKNOWN', kritiek: true, uitleg: 'Kritiek werk is alleen door uzelf afgevinkt en nog niet bevestigd: ' + namen(zelfverklaard) + '.' };
  if (open.length)
    return { stand: 'WORK_OPEN', kritiek: false, uitleg: 'Werk staat nog open en is niet over te dragen: ' + namen(open) + '.' };
  if (overdraagbaar.length)
    return { stand: 'HANDOVER_POSSIBLE', kritiek: false, uitleg: 'Het resterende werk kan worden overgedragen: ' + namen(overdraagbaar) + '.', over: overdraagbaar.map(v => v.id) };
  return { stand: 'WORK_COMPLETE', kritiek: false, uitleg: 'Alle verantwoordelijkheden zijn aantoonbaar afgerond of overgedragen.' };
}

module.exports = { STANDEN, werkstand };
