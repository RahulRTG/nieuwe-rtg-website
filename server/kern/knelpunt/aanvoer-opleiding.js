/* ============================================================================
   DE TWEEDE BRON -- leerstof, en met opzet maximaal anders dan vacatures.

   WAAROM DEZE EN NIET VERVOER. Twee bronnen dragen geen contract als ze op
   elkaar lijken -- dat is dezelfde reden waarom ./aanvoer-werk.js niet naast een
   tweede vacaturekanaal is gezet, en waarom scripts/ritproef.js de rit nam en
   niet de bezorging. De vraag die deze bron beantwoordt is: past
   ./aanvoer-bronnen.js op iets dat structureel anders IS, of hebben we een
   vacature-adapter gebouwd die toevallig een contract heet?

   VIER DINGEN WAARIN HIJ VERSCHILT VAN DE WERKBRON, en ze zijn geen van alle
   cosmetisch:

     1. Er is GEEN LIJST. kern/beroepenbieb/ slaat niets op: hij REKENT
        2 x 1.000.000 combinaties uit een beroep, een soort, een editie en een
        niveau. `openVacatures` geeft je een rij die je kunt aflopen; hier is er
        niets om af te lopen.
     2. Er is GEEN AANBIEDER. Een vacature heeft een bedrijf, een plaats en een
        werkgever die ja of nee zegt. Leerstof is van dit huis zelf en van
        niemand anders.
     3. Er is GEEN EIS. Een vacature draagt `minLeeftijd`; leerstof draagt niets
        wat iemand buitensluit. De hele geschiktheidsvraag bestaat hier niet.
     4. Er is GEEN SCHAARSTE. Een vacature kan vervuld raken; een leerpad niet.

   EN DAAROM WERKT DE SELECTIE ANDERS -- dit is de kern van deze module. De
   werkbron neemt de eerste MAX van een eindige lijst. Dat kan hier niet: de
   eerste 25 van twee miljoen zijn niet "de eerste 25", ze zijn willekeur met
   een net randje. Er MOET dus gezocht worden, en zoeken kan alleen op een woord.

   HET WOORD KOMT UIT DE RANDVOORWAARDE EN NERGENS ANDERS. Dat is het verschil
   tussen matchen op het PROBLEEM en matchen op de PERSOON, en alleen het eerste
   mag (FOUNDATION.md par. 5). Staat er geen bruikbaar woord in, dan levert deze
   bron NIETS -- met een reden, via `geenBron` in ./aanvoer-bronnen.js. Hij
   verzint geen beroep, want een verzonnen beroep is een verzonnen advies.

   DAT IS EEN ECHTE BEPERKING EN GEEN TIJDELIJKE. Een knelpunt "ik heb een
   diploma nodig" is met deze bron niet te beantwoorden zonder te weten WELK
   vak, en dat weten wij niet. De eerlijke uitkomst is dan leeg en niet een
   willekeurige greep uit de bibliotheek.
   ========================================================================== */
'use strict';

const { terreinenVan, KAART } = require('./openingen');

/* Hoeveel leerpaden er hoogstens als vondst terugkomen. Zelfde getal en zelfde
   reden als in ./aanvoer-werk.js: een aantal, geen oordeel. */
const MAX = 25;

/* Woorden die nooit als zoekterm dienen. Ze staan in vrijwel elke
   randvoorwaarde en matchen in een bibliotheek van twee miljoen altijd wel
   IETS -- en een treffer op "werk" of "een" is ruis die er als een vondst
   uitziet. De lijst is kort en met opzet niet slim: wie hem uitbreidt tot een
   stoplijst van honderd woorden, bouwt een taalmodel in een zoekveld. */
const TE_ALGEMEEN = new Set(['een', 'de', 'het', 'van', 'voor', 'met', 'mijn', 'ik', 'heb',
  'nodig', 'moet', 'kunnen', 'geen', 'niet', 'opleiding', 'diploma', 'cursus', 'leren',
  'studie', 'school', 'certificaat', 'bevoegdheid', 'werk', 'baan', 'om', 'te', 'in', 'op']);

/* De woorden waarop deze bron mag zoeken, uit de randvoorwaarde zelf. Langste
   eerst: "lasser" is een betere zoekterm dan "las", en wie kort begint krijgt
   de brede treffer die de smalle verdringt. */
function zoektermen(voorwaarde) {
  const v = voorwaarde && typeof voorwaarde === 'object' ? voorwaarde : {};
  const tekst = String(v.wat || '') + ' ' + String(v.id || '');
  const woorden = tekst.toLowerCase().replace(/[^a-zà-ÿ\s-]/g, ' ').split(/\s+/)
    .filter((w) => w.length >= 4 && !TE_ALGEMEEN.has(w));
  return [...new Set(woorden)].sort((a, b) => b.length - a.length).slice(0, 4);
}

/* Bouwt de opleidingsbron op kern/beroepenbieb/.

   Zelfde vorm als ./aanvoer-werk.js: een OPHALER en niet de module zelf, want
   de kern-tas is op montagemoment nog niet gevuld (opzet/aanbouw3.js). Die
   fout is bij de werkbron een keer gemaakt en wordt hier niet herhaald. */
function maakOpleidingbron(beroepenbiebVan) {
  const kaart = KAART.opleiding;

  return function opleidingbron(voorwaarde) {
    const bieb = typeof beroepenbiebVan === 'function' ? beroepenbiebVan() : null;
    /* Gooien en niet zwijgen: een niet-aangesloten bron is iets anders dan een
       bron zonder aanbod, en ./aanvoer-bronnen.js houdt die twee apart. */
    if (!bieb || typeof bieb.catalogus !== 'function')
      throw new Error('de Beroepen-Bibliotheek is hier niet beschikbaar; staat `beroepenbieb` in ' +
        'GRENZEN.json voor dit domein, en wordt hij laat opgehaald in plaats van bij het monteren?');

    if (!terreinenVan(voorwaarde).includes('opleiding')) return [];

    const termen = zoektermen(voorwaarde);
    if (!termen.length) return [];          // geen woord om op te zoeken -> geenBron, met reden


    /* Beide werelden, want een randvoorwaarde zegt niet of hij technisch of
       zakelijk is -- en kiezen zou hier hetzelfde zijn als raden. */
    const uit = [];
    /* Het GEVONDEN totaal komt uit de bibliotheek zelf (`totaal` per zoekterm)
       en wordt niet geschat. Zonder dat getal leest "24 leerpaden" als "er zijn
       er 24", terwijl er duizenden kunnen zijn -- zie de kop van
       ./aanvoer-bronnen.js. */
    let gevonden = 0;
    for (const term of termen) {
      for (const wereld of ['techniek', 'zaken']) {
        const r = bieb.catalogus(wereld, { zoek: term, per: 24, pagina: 1 });
        if (r && Number.isFinite(r.totaal)) gevonden += r.totaal;
        for (const app of (r && Array.isArray(r.items) ? r.items : [])) {
          if (uit.length >= MAX) return { gevonden, vondsten: uit };
          uit.push({
            terrein: 'opleiding',
            wat: [app.titel || app.naam, app.beroep, app.soort, app.niveau && ('niveau ' + app.niveau)]
              .filter(Boolean).join(' - '),
            ingang: kaart.ingang,
            /* De dektNiet van de KAART: dit is leerSTOF en geen inschrijving,
               en het levert geen diploma op. Die zin hoort overal hetzelfde te
               luiden, dus hij wordt hier niet overgeschreven. */
            dektNiet: kaart.dektNiet,
            /* De bibliotheek kent geen schaarste en noemt ook geen aantal per
               leerpad. `null` blijft dus null -- "onbeperkt" zou een bewering
               zijn die de bron zelf niet doet. */
            beschikbaarheid: null
          });
        }
      }
      if (uit.length) break;   // de langste term wint; korter zoeken verbreedt alleen
    }
    return { gevonden, vondsten: uit };
  };
}

module.exports = { maakOpleidingbron, MAX, zoektermen };
