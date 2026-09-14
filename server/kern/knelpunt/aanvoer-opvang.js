/* ============================================================================
   AANVOER -- DE DERDE BRON: KINDEROPVANG.

   Zie ./aanvoer.js voor het contract. Deze bron bestaat om EEN vraag te
   beantwoorden die na twee bronnen nog openstond: twee punten liggen altijd op
   een lijn. Werk (opgeslagen rijen, een aanbieder, een eis, schaarste als
   aantal) en leerstof (procedureel, twee keer een miljoen, geen aanbieder, geen
   eis, geen schaarste) waren met opzet elkaars tegenpool, en het contract paste
   op allebei. Dat bewijst nog niet dat het contract past -- het bewijst dat het
   op twee vormen past.

   WAAROM JUIST DEZE DERDE. Kinderopvang deelt met geen van beide zijn vorm:

     - er is wel een aanbieder (anders dan leerstof) maar geen EIS aan de mens
       (anders dan een vacature),
     - de schaarste is geen aantal rijen maar een GEMETEN BEZETTING per groep:
       capaciteit min aanwezig,
     - en daarmee is dit de eerste bron die het etiket `beschikbaarheid` ECHT
       kan vullen. Bij de andere twee blijft dat veld `null`, want het contract
       laat het leeg tenzij een bron hem noemt. Een etiket dat nooit gevuld
       werd, is een etiket dat nooit beproefd is.

   DE GRENS DIE HIER EXTRA SCHERP LIGT. `opvangwijzerOverzicht(codenaam)` geeft
   het aanbod EN wat er op de eigen codenaam openstaat. Dat tweede deel raakt
   deze laag nooit: `vondsten(voorwaarde)` krijgt geen mens, dus er is geen
   codenaam om door te geven, en wat de bron pakt is uitsluitend `.opvangen`.
   Dat is geen voorzichtigheid maar de handtekening -- een profiel kan hier
   structureel niet.

   EN DE ZIN DIE MEE MOET. De ouderlaag zegt in zijn eigen antwoord: *een vrije
   plek betekent dat er nu ruimte in de groep is, niet dat u hem heeft.* Die
   hoort in `dektNiet` en niet alleen in het scherm eronder, want een vondst
   reist verder dan de route die hem maakte.
   ========================================================================== */
'use strict';

const MAX = 25;

/* De late getter, om dezelfde reden als bij ./aanvoer-werk.js: wie de module bij
   het BEDRADEN uitpakt, bevriest `undefined` als de kernlaag later wordt
   samengesteld. Ontbreekt hij, dan WERPT deze bron -- een lege lijst zou als
   "geen opvang in de buurt" lezen, en dat is een uitspraak die niemand deed. */
const maakOpvangbron = (opvangwijzerVan) => function opvangbron() {
  const w = typeof opvangwijzerVan === 'function' ? opvangwijzerVan() : opvangwijzerVan;
  if (!w || typeof w.overzicht !== 'function') {
    throw new Error('aanvoer-opvang: de opvangwijzer is niet bedraad. Een lege lijst zou hier ' +
      'lezen als "er is geen opvang", en dat is iets anders dan "wij kijken niet".');
  }

  /* GEEN ARGUMENT, en dat is het punt: overzicht() zonder codenaam geeft het
     aanbod met een lege eigen-lijst. Wij pakken alleen `opvangen`. */
  const uit = w.overzicht();
  const plekken = Array.isArray(uit && uit.opvangen) ? uit.opvangen : [];

  const vondsten = [];
  for (const p of plekken) {
    const groepen = Array.isArray(p.groepen) ? p.groepen : [];
    const vrij = groepen.reduce((n, g) => n + (Number(g.vrij) || 0), 0);
    const capaciteit = groepen.reduce((n, g) => n + (Number(g.capaciteit) || 0), 0);
    vondsten.push({
      terrein: 'opvang',
      wat: p.naam + (p.waar ? ' (' + p.waar + ')' : '') +
        ' -- ' + groepen.length + ' groep(en), ' + capaciteit + ' plaatsen in totaal' +
        (p.nannysGescreend ? ', ' + p.nannysGescreend + ' gescreende begeleider(s)' : ''),
      ingang: '/api/opvang',
      dektNiet: 'Een vrije plek betekent dat er nu ruimte in de groep is, niet dat u hem heeft. Het ' +
        'inschrijven van een kind doet de opvang zelf, na een gesprek. RTG reserveert hier niets en ' +
        'vraagt niets voor u aan. Over kosten of een vergoeding zegt dit niets: kinderopvangtoeslag ' +
        'bestaat in deze code niet.',
      herkomst: 'kern/verzorging/opvangleden.js',
      /* HET EERSTE ECHT GEVULDE `beschikbaarheid`-ETIKET. Een geteld getal uit
         capaciteit min aanwezig, geen schatting -- en bij nul staat er nul, niet
         "neem contact op". */
      beschikbaarheid: vrij + ' van ' + capaciteit + ' plaats(en) nu vrij'
    });
    if (vondsten.length >= MAX) break;
  }
  return { gevonden: plekken.length, vondsten };
};

module.exports = { maakOpvangbron };
