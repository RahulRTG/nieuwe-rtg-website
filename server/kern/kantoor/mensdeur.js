/* STAAT ER EEN MENS ACHTER DEZE KANTOORHANDELING? -- de schaduwmeting.

   WAT DIT OPLOST. KANTOOR.md par. 3 en KANTOORMACHT.md par. 0 zeggen hetzelfde:
   een spoor dat eindigt bij een gedeelde code is geen spoor, het is een alibi.
   `officeAuth` WEET dat al -- hij zet `identiteit: 'bewezen'` of `'anoniem'` op
   de envelop en legt `req.officeKey` klaar -- en niets doet er iets mee. Dit
   bestand doet er iets mee, en met opzet het minste dat werkt: het TELT.

   WAAROM TELLEN EN NIET WEIGEREN. Dat is de huisregel uit CONTROLPLANE.md en
   uit ../commercie/schaduw.js: je kunt niet afdwingen wat nooit in de schaduw
   heeft gelopen. 460 kantoorroutes hangen vandaag aan de gedeelde code en daar
   draait het dagelijkse werk op; een deur die dichtgaat voordat iemand weet wie
   erdoor loopt, is een storing en geen grens. Na een week is "wat zou er
   gebeurd zijn" een getal in plaats van een gevoel.

   Er is dus GEEN tak in dit bestand waarlangs een verzoek wordt tegengehouden.
   Dat staat hier structureel en niet als afspraak.

   WAT DIT TOEVOEGT AAN scripts/kantoormacht.js. Die meter leest de BRON en is
   daarom lexicaal: hij ziet dat een bestand `officeKey` noemt, niet dat de
   route die je nu aanroept er iets mee doet. Zijn `anoniemUitvoerbaar` draagt
   daarom de graad `vermoed` en is een ONDERgrens. Deze meting is runtime en per
   route: welke deuren worden werkelijk anoniem gebruikt, en welke nooit. Dat is
   het verschil tussen een triagelijst en een werklijst.

   WAT HET NIET IS, EN DAT IS DE HELFT VAN HET ONTWERP.

   Dit is een TELLER EN GEEN JOURNAAL. Per route twee getallen, en verder niets:
   geen wie, geen wanneer, geen volgorde. Dat is geen zuinigheid maar een grens
   die dit huis al getrokken heeft -- KOSTEN.md: "de meter houdt tellers en geen
   journaal, een gedragslogboek per lid is voor een factuur niet nodig", en
   KANTOOR.md par. 11.3 zet die grens voor personeel strenger in plaats van
   losser: werkOBJECTEN wel, werkGEDRAG niet. Een schaduwmeting met een regel per
   verzoek zou precies de verzameling aanleggen waartegen het hele
   codenaam-ontwerp beschermt, en zij zou hem aanleggen over de eigen mensen.

   Wie hier later "even" een tijdstempel of een sleutel per waarneming bij zet,
   maakt er een gedragslogboek van. Dat is een besluit en geen detail.

   HET PLAFOND, EN WAAROM HET ER IS. De sleutel is het PAD, en een pad komt van
   buiten: wie /api/office/verzin-maar-wat aanroept met een geldige kantoorcode
   zou anders een sleutel in de opslag kunnen laten groeien. Boven MAX_PADEN
   landt alles in de bak `overig`. Dat verliest precisie op onbekende paden en
   houdt de opslag begrensd; de 585 routes die bestaan passen ruim onder het
   plafond, dus in de praktijk verliest de meting niets.

   DE STAND KOMT LATER, EN HIJ KOMT VAN ../commercie/schaduw.js. Zodra de
   eigenaar besluit dat de mens-eis wordt AFGEDWONGEN, is dat een stand met een
   rijpheidseis (minimaal zoveel waarnemingen over zoveel dagen) en dat bestaat
   al -- inclusief de regel dat een schaduwregel die nog nooit iemand zou hebben
   tegengehouden niet "veilig" is maar "onbewezen". Er komt hier dus GEEN tweede
   schaduwmechanisme naast; dit bestand telt, dat bestand beslist. */
'use strict';

/* Ruim boven de 585 kantoorroutes die vandaag bestaan, en klein genoeg om de
   opslag begrensd te houden als iemand paden verzint. */
const MAX_PADEN = 900;

function maakMensdeur({ db, save }) {
  const eigen = require('../eigencollectie')({
    db, domein: 'kern/kantoor/mensdeur', bezit: { kantoorMensdeur: 'kaart' }
  });

  /* TWEE TOEGANGEN EN GEEN OMGEZETTE, en dat is geen stijlkeuze -- de kop van
     ../eigencollectie.js schrijft hem voor en dit bestand overtrad hem eerst.
     `bak()` LEGT DE COLLECTIE AAN als zij er nog niet is. Zit een leesweg daar
     achter, dan schrijft /api/office/mensdeur bij het allereerste (mogelijk
     geweigerde) verzoek leeg meubilair in de opslag -- en dan zegt de statuscode
     iets anders dan de opslag. Schrijven doet bak(), opzoeken doet kijk(). */
  function bak() { return eigen.bak('kantoorMensdeur'); }
  function kijk() { return eigen.kijk('kantoorMensdeur'); }

  /* Het pad zonder querystring. De query kan een token dragen (zie
     backoffice-01.js, dat /api/office/doc?token=... opvraagt) en die hoort in
     geen enkele meting terecht te komen. */
  function padVan(req) {
    const rauw = String((req && (req.originalUrl || req.url)) || '');
    const pad = rauw.split('?')[0];
    return pad.slice(0, 120);
  }

  /* DE ENIGE SCHRIJFWEG. `heeftMens` is een besluit dat de aanroeper al genomen
     heeft (officeAuth weet of er een lidKey is); hier wordt het alleen geteld.

     ER WORDT PAS GETELD ALS HET VERZOEK IS UITGEVOERD, en dat is een reparatie
     uit de proef. `officeAuth` draait VOOR de strengere poorten: /api/office/
     mensdeur draagt zelf boardroomAuth, dus een anonieme sessie komt langs deze
     teller en wordt daarna alsnog geweigerd. Tellen bij binnenkomst zette die
     route dus op de werklijst "wordt anoniem gebruikt" terwijl hij juist al
     dicht zit -- een meetfout die je aan de uitslag niet ziet, want het getal
     ziet er precies zo uit als een echte anonieme uitvoering.

     Daarom hangt de telling aan `finish` en telt alleen wat 2xx of 3xx werd.
     Een 401, 403 of 404 is een deur die zijn werk deed en geen handeling. */
  function tel(req, res, heeftMens) {
    let pad = padVan(req);
    if (!pad.startsWith('/api/')) return;   // geen kantoorpad: niet onze meting
    if (!res || typeof res.on !== 'function') return;
    res.on('finish', () => {
      try {
        if (res.statusCode >= 400) return;
        const B = bak();
        if (!B[pad] && Object.keys(B).length >= MAX_PADEN) pad = 'overig';
        if (!B[pad]) B[pad] = { pad, metMens: 0, zonderMens: 0 };
        if (heeftMens) B[pad].metMens += 1; else B[pad].zonderMens += 1;
        save();
      } catch (e) { /* een meting houdt nooit een antwoord tegen */ }
    });
  }

  /* DE UITSLAG. Bewust drie bakken en geen percentage: een route die alleen
     anoniem wordt gebruikt is werk, een route die alleen op naam wordt gebruikt
     kan vandaag al dicht, en een route die beide ziet vraagt een gesprek. Een
     samengesteld cijfer eroverheen zou die drie verschillen wegpoetsen, en dat
     is precies wat BEWIJSMACHINE.md verbiedt. */
  function stand() {
    const rijen = Object.values(kijk());
    const alleenAnoniem = rijen.filter(r => r.zonderMens > 0 && r.metMens === 0);
    const alleenOpNaam = rijen.filter(r => r.metMens > 0 && r.zonderMens === 0);
    const beide = rijen.filter(r => r.metMens > 0 && r.zonderMens > 0);
    const verzoeken = rijen.reduce((s, r) => s + r.metMens + r.zonderMens, 0);
    return {
      uitleg: 'Runtime schaduwmeting van de kantoordeur: per route hoe vaak er een ' +
        'bewezen mens achter zat. Telt alleen; houdt niets tegen.',
      grens: 'Een teller en geen journaal: geen wie, geen wanneer, geen volgorde. ' +
        'Een route die hier NIET staat is niet aangeroepen sinds de meting loopt -- ' +
        'dat is iets anders dan "wordt nooit anoniem gebruikt".',
      verzoeken,
      padenGezien: rijen.length,
      alleenAnoniem: alleenAnoniem.length,
      alleenOpNaam: alleenOpNaam.length,
      beide: beide.length,
      /* De werklijst, en die is met opzet gesorteerd op hoeveel het gebruikt
         wordt: wie de deur dichtzet, doet dat het eerst waar het pijn doet. */
      werklijst: alleenAnoniem.sort((a, b) => b.zonderMens - a.zonderMens).slice(0, 50),
      kanNuAlDicht: alleenOpNaam.sort((a, b) => b.metMens - a.metMens).slice(0, 50)
    };
  }

  return { tel, stand, MAX_PADEN };
}

module.exports = { maakMensdeur, MAX_PADEN };
