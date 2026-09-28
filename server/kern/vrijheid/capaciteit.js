/* VRIJHEID: CAPACITEIT LEREN -- een nee is informatie over de ORGANISATIE.

   Worden vrijdagmiddagverzoeken steeds geblokkeerd omdat er maar een mens is
   die PAYMENT_L3 mag doen, dan is de conclusie niet "medewerkers vragen te
   veel" maar "er is een tweede bevoegde nodig". Deze module telt daarom
   BLOKKADES per ontbrekende eis -- nooit aanvragen per mens -- en maakt van een
   terugkerende blokkade een OPLEIDINGSBEHOEFTE:

     FREEDOM BLOCKED -> CAPABILITY GAP -> ACADEMY NEED -> TRAIN EXTRA PERSON ->
     COMPETENCY PROVEN -> AUTHORITY ELIGIBILITY -> MORE COVERAGE -> MORE FREEDOM

   De lus sluit pas als de tweede bevoegdheid BEWEZEN is: afgetekend door een
   ander en geldig (dekking.js telt precies zo). Een ingeschreven cursus sluit
   niets.

   Er staat geen "Academy" in dit huis (VRIJHEID.md par. 2): de behoefte is
   hier een eigen, lezende regel, en wie hem oppakt tekent de bevoegdheid af
   waar hij al woont (kern/vakbewijs.js). Welke mensen er aanvroegen komt er
   niet in -- een behoefte gaat over een eis, niet over wie er vrij wilde. */
'use strict';
const D = require('./dekking');

const DUIDING = 'CAPABILITY_CAPACITY_PROBLEM';

function houders(team, code, datum) {
  return (team.mensen || []).filter(m => D.inDienst(m, datum) && D.geldigeKwalificaties(team, m.id, datum).codes.has(code)).length;
}

/* beslissingen: [{ uitkomst, blokkades: [...] }] uit de afgelopen periode. */
function blokkadeAnalyse(beslissingen, team, beleid, datum) {
  const minAantal = beleid.waarde('capaciteit.minAantal');
  const minAandeel = beleid.waarde('capaciteit.minAandeel');
  if (minAantal.open || minAandeel.open)
    return { stand: 'NIET_GEMETEN', uitleg: 'Er is geen drempel voor een capaciteitsgat vastgesteld; deze wachter kijkt niet.', gaten: [] };
  const lijst = beslissingen || [];
  const totaal = lijst.length;
  const per = {};
  for (const b of lijst) for (const code of new Set(b.blokkades || [])) if (code !== 'bezetting') per[code] = (per[code] || 0) + 1;
  const bezetting = lijst.filter(b => (b.blokkades || []).includes('bezetting')).length;
  const gaten = [];
  for (const [code, n] of Object.entries(per)) {
    const aandeel = totaal ? n / totaal : 0;
    if (n < minAantal.waarde || aandeel < minAandeel.waarde) continue;
    gaten.push({ code, geblokkeerd: n, totaal, houders: houders(team, code, datum), duiding: DUIDING,
      zin: Math.round(aandeel * 100) + '% van de verzoeken (' + n + ' van ' + totaal + ') werd geblokkeerd door ' + code +
        '-dekking. Dit is een capaciteitsvraag, geen gedragsvraag: er zijn te weinig bevoegde mensen.' });
  }
  if (totaal && bezetting >= minAantal.waarde && bezetting / totaal >= minAandeel.waarde)
    gaten.push({ code: 'bezetting', geblokkeerd: bezetting, totaal, duiding: DUIDING,
      zin: bezetting + ' van ' + totaal + ' verzoeken liep vast op de minimale bezetting. Dat wijst op onderbezetting of het rooster, niet op de aanvragers.' });
  return { stand: gaten.length ? 'CAPABILITY_GAP' : 'GEEN_GAT', gaten };
}

/* Een behoefte is vervuld als er nu meer bevoegden zijn dan toen hij ontstond
   en minstens twee: dan is de bus factor van een weg. */
function vervuld(behoefte, team, datum) {
  if (behoefte.code === 'bezetting') return false;
  const nu = houders(team, behoefte.code, datum);
  return nu >= 2 && nu > (behoefte.houdersBijOntstaan || 0);
}

module.exports = { DUIDING, blokkadeAnalyse, vervuld, houders };
