/* HET ISOLATIEFILTER -- bevoegd zijn is niet hetzelfde als beschikbaar zijn.

   HET GAT DAT DIT VULT. kern/stuur/beleid.js is closed by default en dat is
   sterk: een pad is pas AI-bedienbaar nadat een mens het bewust heeft
   opgenomen. Maar die lijst is VAST. Zodra een lid in isolatie staat, mag het
   AI-stuur nog steeds precies dezelfde 176 paden kiezen als daarvoor -- de
   beschermstand grijpt pas bij de HTTP-aanroep in, en dan heeft het model de
   handeling al voorgesteld en heeft de gebruiker hem al bevestigd. Een
   weigering aan het eind van die keten is een slechte weigering: hij komt na de
   belofte.

   DE REGEL: WAT DE BESCHERMSTAND ZOU TEGENHOUDEN, STAAT NIET IN DE LIJST
   WAARUIT DE AI KIEST. Dat is dezelfde vorm als de bewijspoort in ./beleid.js,
   die een geschorste capability uit `toegestanePaden` laat vallen. Er komt hier
   dus geen tweede bevoegdheidsmodel bij; er komt een versmalling bij op een
   lijst die al is goedgekeurd.

   HET IS EEN VERSMALLING EN NOOIT EEN VERBREDING, en dat is structureel: de
   uitkomst is per constructie een deelverzameling van wat er binnenkwam. Wie
   hier ooit iets toevoegt, heeft van een beveiligingsfilter een tweede
   allowlist gemaakt -- en dan kan een stand die strenger heet, iets openzetten.

   DE VERSMALLING DRAAGT ALTIJD EEN REDEN. EXECUTIE.md blok 0: de gevaarlijkste
   faalvorm van deze laag is een versmalling die het gevraagde vermogen VERBERGT.
   Dit filter geeft daarom niet alleen de overgebleven paden terug maar ook wat
   er uit ging en waarom, zodat het stuur kan zeggen "dit kan ik nu niet, omdat
   uw account in isolatie staat" in plaats van te doen alsof het niet bestaat. */
'use strict';

/* MET WELKE METHODE EEN PAD WORDT BEOORDEELD, EN WAAROM DAT NIET ALTIJD POST IS.
   De eerste versie beoordeelde alles als POST, en die versneed 42 paden van een
   lid in de beschermstand -- waaronder /api/bank/afschrift en /api/bank/advies.
   Dat zijn LEZERS. In dit huis lopen de meeste lezers over POST (3728 tegenover
   35 GET; zie de kop van kern/beschermstand.js), dus "het is een POST" zegt hier
   niets over wat er gebeurt. De beschermstand belooft met zoveel woorden dat het
   lezen doorloopt; een filter dat een lid zijn eigen afschrift ontneemt, breekt
   die belofte en maakt van de beschermstand alsnog isolatie met een vriendelijke
   naam.

   HET STUUR WEET HET AL, en daarom komt het antwoord daarvandaan in plaats van
   uit een tweede lijst: ./beleid.js deelt elk AI-pad in als `lezen`, `klein` of
   `voorstel`. Wat op de lezen-lijst staat, wordt als GET gewogen. Dat is geen
   aanname over de route maar een oordeel dat een mens al heeft geveld toen hij
   het pad opnam -- en als dat oordeel fout is, is dat een fout in de allowlist
   en niet hier. */
const METHODE = 'POST';

/* De trede komt UIT de schaal en staat hier niet als tekenreeks: zie de
   NIVEAUS-uitleg in ./beleid.js. */
const { NIVEAUS } = require('./beleid');
const herkomst = require('../isolatie/herkomst');
const maakHerkomstpoort = require('./herkomstpoort');

function maakIsolatiefilter({ isolatie, beleid }) {

  /* De functie achter een pad, voor het effectmodel. Hij komt uit dezelfde
     catalogus als de beschermstand; is die er niet, dan werkt het effectmodel
     zonder categorievermoeden -- strenger, en dat is hier de goede kant. */
  function functieVoor(pad) {
    try { return require('../../functies').functieVoorPad(pad) || null; } catch (e) { return null; }
  }

  function methodeVoor(pad, wereld) {
    if (!beleid || !wereld) return METHODE;
    try { return beleid.beleidVoor(pad, wereld).niveau === NIVEAUS.LEZEN ? 'GET' : METHODE; }
    catch (e) { return METHODE; }   /* bij twijfel het strengste; dat is de goede kant om fout te gaan */
  }

  /* Geeft { paden, weggevallen } terug. Nooit meer paden dan er binnenkwamen.

     `bronnen` zijn de KANALEN waarlangs invoer aan deze opdracht heeft
     bijgedragen (../isolatie/herkomst.js). Zat daar onvertrouwde inhoud bij, dan
     versmalt hij OOK zonder dat er een beveiligingsstand geldt -- dat is de
     invariant "onvertrouwde inhoud vergroot nooit de beschikbare capabilities",
     en die staat los van isolatie. Een mail die geld wil laten bewegen, hoort
     ook op een doodgewone dinsdag te worden tegengehouden. */
  /* Het herkomstoordeel woont in ./herkomstpoort.js -- zie de kop daar waarom. */
  const { magMetHerkomst } = maakHerkomstpoort({ isolatie, beleid, functieVoor, methodeVoor });

  function versmal(paden, context, wereld, bronnen) {
    const binnen = Array.isArray(paden) ? paden : [];
    const dichtDoorHerkomst = herkomst.sluitDoorHerkomst(bronnen || []);

    const stand = isolatie && context ? isolatie.effectieveStand(context.standen || {}) : null;
    const standGeldt = !!(stand && (stand.beschermd === true || stand.trede === 'isolatie' ||
      stand.tredeOnbepaald === true));

    if (!standGeldt && !dichtDoorHerkomst.length) {
      return { paden: binnen, weggevallen: [], actief: false, stand,
        waarom: !isolatie || !context
          ? 'geen isolatiecontext meegegeven en geen onvertrouwde invoer; er valt niets te versmallen'
          : 'geen enkele drager staat in een stand die iets sluit, en alleen gezaghebbende bronnen droegen bij' };
    }

    const blijft = [];
    const weg = [];
    for (const pad of binnen) {
      /* 1. DE STAND. Alleen als er ook werkelijk een stand geldt -- anders zou
            elke aanroep met onvertrouwde invoer ook de isolatievraag stellen en
            per pad een besluit forceren dat niets toevoegt. */
      if (standGeldt) {
        const b = isolatie.besluit({ pad, methode: methodeVoor(pad, wereld), context });
        if (!b.toegestaan) {
          weg.push({ pad, reden: b.reden, regel: b.regel || null, uitleg: b.uitleg,
            dragers: (b.dragers || []).map(d => d.drager) });
          continue;
        }
      }
      /* 2. DE HERKOMST, en dat oordeel woont in `magMetHerkomst` hieronder.
            EEN WAARHEID, TWEE LEZERS: de kaart versmalt de LIJST, maar de
            uitvoerpoort moet bij `doe` hetzelfde zeggen -- en het model heeft
            de bredere lijst dan al gezien. Zou de poort dit oordeel nabouwen,
            dan lopen de twee binnen een jaar uiteen zonder dat iemand het merkt,
            want ze 'werken' allebei. */
      if (dichtDoorHerkomst.length) {
        const oordeel = magMetHerkomst(pad, wereld, bronnen);
        if (!oordeel.mag) { weg.push(oordeel.weg); continue; }
      }
      blijft.push(pad);
    }
    return { paden: blijft, weggevallen: weg, actief: true, stand,
      herkomstSluit: dichtDoorHerkomst,
      waarom: weg.length
        ? weg.length + ' pad(en) vielen weg door een beveiligingsstand of door onvertrouwde invoer'
        : 'de stand en de herkomst gelden, maar raken geen van deze paden' };
  }

  /* De zin die het stuur aan een mens laat zien. Nooit "dat kan ik niet" zonder
     erbij te zeggen waardoor -- een grijze knop zonder uitleg leert mensen dat
     het systeem willekeurig is (GRAMMATICA.md). */
  function uitleg(weggevallen) {
    if (!weggevallen || !weggevallen.length) return null;
    const dragers = [...new Set(weggevallen.flatMap(w => w.dragers))];
    return 'Dit kan nu niet: er staat een beveiligingsstand aan op ' +
      (dragers.length ? dragers.join(' en ') : 'deze omgeving') +
      '. Wat er dichtstaat: ' + [...new Set(weggevallen.map(w => w.regel).filter(Boolean))].join(', ') + '.';
  }

  return { versmal, magMetHerkomst, uitleg, methodeVoor, METHODE };
}

module.exports = { maakIsolatiefilter };
