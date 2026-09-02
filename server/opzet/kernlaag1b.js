/* DE KERN SAMENSTELLEN -- deel 1b: de staart van deel 1.

   Positioneel geknipt uit ./kernlaag1.js, op de 10 kB-grens en niet op een
   thema -- precies zoals de kop van dat bestand het voorschrijft. Deel 1 kwam
   met de 18+-poort op de kern (kern.volwassen) over de grens; de staart is er
   als aaneengesloten stuk afgehaald en wordt vanuit server.js DIRECT na deel 1
   aangeroepen, dus alles hieronder staat in exact zijn oude orde: de drie
   ontwerptakken, het doorgeefjournaal, en het stadsweefsel dat VOOR zijn
   lezers in laag 2 en 5 moet staan. Zelfde vorm als ./kernlaag2b.js.

   Wat `kern` en `hulp` zijn: zie de kop van ./kernlaag1.js. */
'use strict';

module.exports = (kern, hulp) => {
  const { anthropic, crypto, db, keyVanCodenaam, log, save, schoon, sseToCustomer, sseToOffice } = hulp;

/* RTG Atelier (kern/atelier.js): het besloten ontwerpbureau van de kantoren
   voor mode en alles wat je aan het lijf draagt. AI tekent concepten uit,
   levert tech packs en de blik van de creatief directeur; het palet komt als
   naam + hex mee zodat het scherm een moodboard toont. */
Object.assign(kern, require('../kern/atelier').maakAtelier({ db, save, crypto, anthropic, schoon }));
/* RTG Ontwerpstudio (kern/studio.js): de tegenhanger van het Atelier voor
   alles wat je beweegt: automotive, jachten & boten, luchtvaart en
   helikopters. AI tekent het concept uit, levert een specsheet en de blik
   van de chef-ontwerper. */
Object.assign(kern, require('../kern/studio').maakStudio({ db, save, crypto, anthropic, schoon }));
/* RTG Hardwarelab (kern/hardwarelab.js): de derde ontwerptak, voor de eigen
   apparaten: PDA's en tablets, schermen, sensoren, de zaakdoos-familie en
   accessoires. AI tekent het concept uit, levert een stuklijst en de blik
   van de chef-engineer. */
Object.assign(kern, require('../kern/hardwarelab').maakHardwarelab({ db, save, crypto, anthropic, schoon }));

/* Het doorgeefjournaal (kern/doorgeefjournaal.js): een leesbare regel per
   binnenkomend verzoek en per uitgaand bericht. Vroeg in de rij: de haak waar
   de lagen eronder aan melden (server/journaalhaak.js) moet vanaf het
   eerste verzoek bezet zijn -- anders mist het journaal de opstartfase, en daar
   zaten de storingen. Het bewaarde deel gaat naar een BESTAND en niet naar een
   collectie; zie kern/journaalbestand.js. */
Object.assign(kern, require('../kern/journaalbestand').metBestand({ db, save }));

/* Het stadsweefsel (kern/stadsweefsel/): de ondergrond onder de stad --
   geografie, objecten, indicatoren, begroting, besluitvorming en het
   algoritmeregister.

   DE VOLGORDE IS HIER GEDRAG. Het weefsel staat VOOR zijn lezers: kern/gemeente
   (laag 2) biedt zijn meldingen bij de zaakmotor aan en kern/stad (laag 5) leest
   zijn zones uit de geografie. Wie dit blok naar beneden schuift, start een stad
   zonder ondergrond -- en dan hangt een gemeentemelding aan geen enkele zaak.
   Het staat in deze laag en niet in laag 2 omdat die daarmee over de 10 KB ging;
   eerder is hier ook goed, want alles wat het weefsel nodig heeft bestaat al. */
const melderSeintje = (codenaam) => {
  try { Promise.resolve(keyVanCodenaam(codenaam)).then(t => { if (t && t.key) sseToCustomer(t.key, 'sync', { scope: 'stad' }); }).catch(() => {}); }
  catch (e) { log.uitzondering(e, { bron: 'weefsel', waar: 'melderSeintje' }); }
};
Object.assign(kern, require('../kern/stadsweefsel')({ db, save, crypto, sseToOffice, melderSeintje, log }));
};
