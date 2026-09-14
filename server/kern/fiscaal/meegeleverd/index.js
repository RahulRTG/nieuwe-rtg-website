/* DE MEEGELEVERDE WETSWIJZIGINGEN LADEN.

   Afgesplitst van ../regelwacht.js op de omvanglat (keuringsregel 13), langs
   dezelfde snede als ../regelwacht-keuring.js: daar staat wat een bron mag
   leveren, hier staat welke wijzigingen dit huis zelf meelevert.

   WAAROM ZE BESTAAN. De basistabel (../landen.js) draagt het PEILJAAR. Een wet
   die daarna veranderde hoort er als jaargang bovenop, met haar ingangsdatum,
   zodat een verkoop van voor die datum op het oude tarief blijft staan. Zonder
   dit zou zo'n wijziging alleen bestaan in de database van wie hem ooit met de
   hand invoerde -- en na een verse seed weer weg zijn.

   Het model is kern/payroll/index.js (`laadMeegeleverd`), en de belangrijkste
   eigenschap is dezelfde: de wijziging gaat langs `pasToe` en dus langs dezelfde
   keuring als elke andere bron. Geen achterdeur voor "onze eigen" tarieven.

   WAT HIER NIET IN HOORT: een correctie. Een jaargang draagt een ingangsdatum en
   beweert daarmee dat er op die dag iets veranderde. Hadden wij een tarief
   gewoon verkeerd staan, dan hoort dat in de basistabel te worden rechtgezet --
   anders verzint de geschiedenis een gebeurtenis. Zie de ES-noot in ../landen.js
   en test/fiscaal-meegeleverd.test.js toets 5. */
'use strict';

/* De bestanden die worden meegeleverd. Met opzet een LIJST en geen readdir: wat
   dit huis meelevert is een besluit, en een bestand dat iemand in de map zet
   hoort niet vanzelf de tarieven van de hele wereld te raken. */
const BESTANDEN = ['de-2026'];

/* `pasToe` komt binnen in plaats van dat deze module de Regelwacht optuigt: dan
   blijft hij toetsbaar zonder database en kan hij zelf niets projecteren.

   `soort: 'meegeleverd'` is met opzet NIET 'kantoor': dan zou de jaargang
   zichzelf op `goedgekeurd` zetten, en er heeft hier geen mens naar gekeken.

   TWEE KEER LADEN LEVERT GEEN TWEEDE JAARGANG: `keur()` vergelijkt met wat er NU
   geldt en geeft een lege wijzigingenset zodra de waarde al staat. */
function laad(pasToe) {
  const uit = [];
  for (const naam of BESTANDEN) {
    try {
      const j = require('./' + naam + '.json');
      const r = pasToe({ landen: { [j.land]: j.wijzigingen } },
        { soort: 'meegeleverd', naam: naam + '.json', gezag: 'indicatief' }, j.versie,
        { geldigVanaf: j.geldigVanaf, rechtsgrond: j.rechtsgrond, bekendgemaaktOp: j.bekendgemaaktOp });
      uit.push({ naam, gedaan: r && r.gedaan ? Object.keys(r.gedaan) : [] });
    } catch (e) {
      uit.push({ naam, error: 'meegeleverde jaargang ' + naam + ' kon niet worden geladen: ' + e.message });
    }
  }
  return uit;
}

module.exports = { laad, BESTANDEN };
