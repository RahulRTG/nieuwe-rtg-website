/* ============================================================================
   HET PORTFOLIO -- wat een mens van zijn dossier NAAR BUITEN zou tonen.

   Uit ./leerdossier.js geknipt op de 10 kB-grens (keuringsregel 13), en de naad
   is echt: dat bestand SCHRIJFT en leest terug voor de mens zelf, dit projecteert
   naar buiten. Die twee hebben een verschillende regel, en juist die regel is de
   reden dat deze laag bestaat.

   WIJ TELLEN GEEN AANDACHT ALS ONTWIKKELING. Dat is de klassieke
   social-mediafout in een zin -- publiceren = impact -- en hij wordt hier
   tegengehouden door een filter en niet door een voornemen: alles met
   `aanspraak: 'geen'` valt af. Dat zijn gezien, uitgelezen en BEREIKT.

   DIE DERDE IS DE HELE KUNST. "Mijn werk kwam bij iemand aan" voelt als een
   prestatie en het is bereik. Een platform dat dat meetelt, heeft binnen een
   jaar makers die voor bereik werken; een platform dat het weglaat, kan niet
   uitleggen waarom "aangeboden" en "er is echt iemand geweest" niet hetzelfde
   zijn. Daarom staat `bereikt` WEL in het dossier en NIET in het portfolio.

   WAT HIER NOOIT KOMT: een getal. Niet het aantal bewijzen, niet het aantal
   mensen, niet het aantal onderwerpen. Een portfolio dat een getal draagt wordt
   op dat getal gesorteerd zodra er twee mensen naast elkaar staan -- en dan is
   het de Career Score die CARRIERE.md, HDI.md, ONTMOETEN.md, STAGE.md en INT-04
   alle vijf afwijzen.

   EN ELK BEWIJSSTUK DRAAGT ZIJN `nietZegt` MEE. Een bewijs zonder de zin "en
   dit zegt het niet" is een leverancierspak dat overal ja zegt (APPSTORE.md);
   kern/carriereledger/regels.js zegt daar terecht over dat dat blok de helft
   van de betekenis is.
   ========================================================================== */
'use strict';

const { AANSPRAKEN } = require('./tredenlijst');

module.exports = ({ peil, trede }) => {
  /* HET PORTFOLIO -- en dit is de plek waar "publiceren = impact" wordt
     tegengehouden.

     Wat er WEL in komt: regels met `aanspraak` eigenDoen of overdracht. Wat er
     NOOIT in komt: alles met `aanspraak: 'geen'` -- gezien, uitgelezen en
     BEREIKT. Die laatste is de scherpe, want hij voelt als een prestatie: je
     werk kwam bij iemand aan. Dat is bereik, en bereik is aandacht.

     WIJ TELLEN GEEN AANDACHT ALS ONTWIKKELING. Er staat daarom ook geen AANTAL
     in dit antwoord, in geen enkele vorm: geen aantal regels, geen aantal
     mensen, geen aantal onderwerpen. Een portfolio dat een getal draagt, wordt
     op dat getal gesorteerd zodra er twee mensen naast elkaar staan.

     De regels komen chronologisch terug, nieuwste eerst, precies zoals ze zijn
     geschreven -- inclusief hun `stelt` en `nietZegt`, want een bewijsstuk
     zonder de zin "en dit zegt het NIET" is een leverancierspak dat overal ja
     zegt (APPSTORE.md). */
  function portfolio(sleutel, opties) {
    const o = opties || {};
    const regels = peil(sleutel)
      .filter(r => { const a = AANSPRAKEN[r.aanspraak]; return a && a.portfolio; })
      .slice().reverse();
    const gekozen = o.onderwerp ? regels.filter(r => r.onderwerp === String(o.onderwerp)) : regels;
    return {
      /* Elk bewijsstuk draagt zijn eigen zes antwoorden mee: wat gebeurde er,
         welk werkwoord, waar komt het vandaan, wie stelde het vast, wat het
         niet zegt, en of het buiten Foundation mag. */
      bewijzen: gekozen.slice(0, Math.min(Number(o.max) || 100, 300)).map(r => {
        const t = trede(r.trede) || {};
        const a = AANSPRAKEN[r.aanspraak] || {};
        return {
          at: r.at, onderwerp: r.onderwerp, trede: r.trede, naam: t.naam || r.trede,
          werkwoord: r.werkwoord, herkomst: r.herkomst, bron: r.bron,
          graad: r.graad, doorWie: t.doorWie || null,
          stelt: t.stelt || null, nietZegt: t.nietZegt || null,
          aanspraak: r.aanspraak, buitenFoundation: !!a.buitenFoundation
        };
      }),
      /* Wat er met opzet NIET in staat, even groot als wat er wel in staat. */
      nietGeteld: 'Gezien, uitgelezen en bereikt staan hier niet in. Dat iets bij iemand AANKWAM is bereik, ' +
        'en bereik is aandacht -- wij tellen aandacht niet als ontwikkeling. Er staat ook geen aantal in: ' +
        'geen regels, geen mensen, geen onderwerpen. Een portfolio met een getal wordt op dat getal gesorteerd ' +
        'zodra er twee mensen naast elkaar staan.',
      /* EN ER GAAT VANDAAG NIETS NAAR BUITEN. `buitenFoundation` zegt wat er
         MAG, niet wat er gebeurt: er is geen exportroute, en die komt er alleen
         als de mens hem zelf in gang zet. */
      uitgang: 'Er bestaat geen route die dit buiten Foundation brengt. `buitenFoundation` zegt alleen welke ' +
        'regels daarvoor in aanmerking zouden komen als die route er ooit komt, en dat besluit is van de mens zelf.'
    };
  }

  return { portfolio };
};
