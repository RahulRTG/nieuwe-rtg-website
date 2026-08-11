/* Kern-module "socialegraaf": wat er tussen u en de mensen om u heen speelt, en
   wat daarvan nog moet komen (LIFE.md, fase 1).

   DE EERSTE VAN DE VIJF LAGEN. LIFE.md par. 6 geeft RTG Sociaal hetzelfde
   wereldpatroon als RTG Geld: graaf, beleid, cockpit, Rahul, actielog. Dit is de
   graaf, en alleen de graaf. Er is hier geen beleid (de regels van het lid), geen
   cockpit, geen stem en geen actielog; die komen in fase 2 tot 5 en hebben deze
   laag nodig om op te staan.

   ALLEEN LEZEN, EN DAT IS AFDWINGBAAR. Deze module heeft geen eigen collectie,
   schrijft nooit en bewaart niets -- net als kern/socialewereld.js, en om
   dezelfde reden. Wat hij toevoegt aan die laag is DIEPTE: waar de samenhanglaag
   drie bronnen leest en de rij toont, leest deze er negen plus de Control Tower,
   en beantwoordt hij de vraag die geen enkele sociale app vandaag beantwoordt:
   wat wacht er op mij, en wat komt eraan.

   WAAROM DE SAMENHANGLAAG BLIJFT. kern/socialewereld.js hoort bij een familie van
   vier (reis, kantoor, sociaal, geld) die dezelfde taal spreken via
   kern/wereldkern.js en door drie toetsen in die taal worden gehouden. Hem
   opheffen omdat er een diepere laag naast komt, zou die familie uit elkaar
   trekken voor een winst die er niet is -- precies de afweging die
   routes/geld.js ook maakte toen de geldgraaf naast kern/geldwereld.js kwam. De
   twee lezen deels dezelfde domeinen; ze tellen niets van elkaar over.

   HET WERKWOORD VAN DEZE WERELD (LIFE.md par. 3): samenstellen en klaarzetten,
   bevestigen doet de mens. In fase 1 is er nog niets om te bevestigen -- deze
   laag kijkt alleen. Dat is met opzet de eerste fase: hij verandert niets aan wat
   een lid KAN, alleen aan wat het platform ZIET, en is daarmee volledig
   omkeerbaar.

   De bronnen krijgt de motor MEE en kiest hij niet zelf, om dezelfde reden als
   kern/levensgraaf/graaf.js: een motor die zijn eigen brandstof kiest, kan er
   maar een soort verstoken. Zo kan een toets de negen domeinen vervangen zonder
   de halve kern na te bouwen.

   Gemount vanuit opzet/kernlaag3b.js, NA kern/levensgraaf (de vooruitblik vraagt
   de Control Tower) en na de sociale domeinen. */
'use strict';

const { vandaag } = require('./hulp');
const maakLijn = require('./lijn');

/* De volgorde waarin een mens dit wil zien. Wat bij MIJ ligt bovenaan, dan wat
   bij een ander ligt, dan de rest. Dat is dezelfde gedachte als de vier signalen
   van kern/wereldkern.js, maar niet dezelfde tabel -- en dat verschil is echt:
   die tabel weegt hoe DRINGEND iets is, deze weegt bij WIE het ligt. Ze door
   elkaar halen zou van "er wacht iemand op u" en "dit is over drie dagen"
   hetzelfde maken, en dat is precies het onderscheid waar deze wereld op draait. */
const WACHTRANG = { ik: 0, ander: 1, '': 2 };

module.exports = ({ kern, bronnen }) => {
  const bronMod = (bronnen || require('./bronnen'))({ kern });
  const vooruitMod = require('./vooruitblik')({ kern });
  const lijnMod = maakLijn();

  /* Het hele beeld in een keer. Bronnen die stukgaan komen met naam in stil[] en
     nemen de andere niet mee; de vooruitblik valt apart, want die hangt aan een
     andere laag (de levensgraaf) en kan los omvallen. */
  function beeld(key) {
    const v = bronMod.verzamel(key);
    const momenten = v.momenten.slice().sort((a, b) =>
      (WACHTRANG[a.wacht] - WACHTRANG[b.wacht]) ||
      String(b.wanneer || '').localeCompare(String(a.wanneer || '')) ||
      String(b.tijd || '').localeCompare(String(a.tijd || '')));

    const stil = v.stil.slice();
    let vooruit = { achterstallig: [], komt: [], later: 0, totaal: 0 }, clubs = 0;
    try {
      vooruit = vooruitMod.termijnen(key);
      clubs = vooruitMod.clubs(key);
    } catch (e) { stil.push('termijnen'); }

    return {
      ok: true,
      momenten,
      vooruit,
      telling: {
        momenten: momenten.length,
        /* WACHT OP MIJ is het enige getal dat deze laag zelf maakt, en het is
           een telling en geen score: het gaat over dingen, niet over mensen. Een
           getal per persoon zou een ranglijst van relaties zijn, en dat is
           precies wat LIFE.md par. 4.4 verbiedt. */
        wachtOpMij: momenten.filter(m => m.wacht === 'ik').length,
        wachtOpAnder: momenten.filter(m => m.wacht === 'ander').length,
        vandaag: momenten.filter(m => m.wanneer === vandaag()).length,
        achterstallig: vooruit.achterstallig.length,
        clubs
      },
      stil,
      bronnen: bronMod.NAMEN
    };
  }

  /* De momentlijn (fase 4): dezelfde gegevens, andere ordening. Hij krijgt het
     beeld MEE en haalt niets zelf op -- twee plekken die dezelfde negen domeinen
     uitlezen, lopen uiteen zonder dat iets klaagt. */
  function lijn(key) {
    return lijnMod.lijn(beeld(key));
  }

  return { socialegraaf: { beeld, lijn, NAMEN: bronMod.NAMEN } };
};
