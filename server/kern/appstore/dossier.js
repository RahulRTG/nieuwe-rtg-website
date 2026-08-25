/* ============================================================================
   HET INKOOPDOSSIER -- wat een inkoper, een security officer en een FG van een
   app van derden willen weten, en wat wij daarvan werkelijk KUNNEN aantonen.

   WAAROM DIT BESTAAT. Een bedrijf dat software van een derde toelaat, stuurt
   normaal een vragenlijst: waar staan de gegevens, wie kan erbij, wat gebeurt er
   bij opzeggen, wie heeft de code gezien. Dat kost aan beide kanten weken, en
   het antwoord is proza dat niemand kan nakijken.

   Alles wat hieronder staat komt uit een METING of uit een BESLUIT dat in dit
   huis is vastgelegd, met de bron erbij. Wat wij niet kunnen aantonen, staat in
   `nietGebouwd` met de reden -- en dat is het belangrijkste deel van het
   dossier. Een leverancierspak dat overal "ja" zegt, is niets waard; een dat
   zegt waar het ophoudt, is te vertrouwen op de rest.

   DE STERKSTE CLAIM IN DIT DOSSIER IS EEN NEGATIEVE.

   Een app van derden in de RTG-cel heeft GEEN netwerk (`connect-src 'none'`).
   Daaruit volgt iets wat geen enkele gewone App Store kan zeggen: de leverancier
   heeft geen kopie van de gegevens van dit lid, want er is geen weg waarlangs
   die kopie zijn kant op had kunnen gaan. Geen verwerkersovereenkomst die dat
   belooft, geen audit die het steekproefsgewijs vaststelt -- de architectuur
   maakt het onmogelijk, en de CSP-kop van de celroute is het bewijs.

   Datzelfde maakt de uitgang (punt 69 uit DEVELOPERCLOUD.md) eenvoudig: er is
   niets bij de leverancier om te laten verwijderen. Wat een app bewaarde, stond
   hier, en wordt hier gewist.
   ========================================================================== */
'use strict';

const { toonbaar } = require('./machtigingen');
const { BUDGET } = require('./keuring');
/* De tijd komt uit de tijdmachine en niet rechtstreeks uit het
   besturingssysteem (scripts/klok.js telt dat, en de schuld mag alleen omlaag).
   Hier is dat meer dan boekhouding: de datum op een inkoopdossier is een
   bewering, en een bewering hoort dezelfde klok te lezen als de rest van het
   huis -- anders draagt een dossier een ander uur dan het journaal ernaast. */
const { datum } = require('../../lib/klok');
/* Wat voor ELKE app in dit kanaal geldt -- wat hij nooit krijgt, waar de
   gegevens blijven, hoe de uitgang werkt, en wat dit dossier niet kan zeggen --
   staat in ./dossier-grenzen.js. Dat is geen opdeling om de omvang maar een
   naad: die vier hangen van geen enkele app af. */
const G = require('./dossier-grenzen');

/* Een bewijsregel draagt altijd vier dingen: wat er wordt beweerd, hoe het is
   vastgesteld, waar dat staat, en wat de gemeten waarde is. Een bewering zonder
   die vier hoort hier niet in -- dat is precies het verschil met een
   ingevulde vragenlijst. */
const B = (claim, hoe, bron, waarde) => ({ claim, hoe, bron, waarde });

module.exports = function maakDossier({ S, app, versie, uitgever, opslag, journaal, geld }) {

  function dossier(sleutel) {
    const a = app(sleutel);
    if (!a) return { status: 404, error: 'Deze app bestaat niet.' };
    const v = a.live ? versie(a.live) : null;
    if (!v) return { status: 409, error: 'Deze app staat niet live; er valt geen dossier over te maken.',
      ingetrokken: a.ingetrokken || null };
    const u = uitgever(a.org);
    const m = v.manifest;
    const index = opslag.indexVan(sleutel, v.hash) || {};
    const bestanden = Object.keys(index);
    const blok = (v.bevindingen || []).filter(x => x.ernst === 'blokkeert');
    const letop = (v.bevindingen || []).filter(x => x.ernst === 'let-op');

    return { status: 200, ok: true,
      opgemaakt: datum().toISOString(),
      let: 'Elk gegeven hieronder komt uit een meting of uit een vastgelegd besluit, met de bron erbij. Wat wij niet kunnen aantonen, staat onderaan in nietGebouwd met de reden.',

      leverancier: {
        naam: u ? u.naam : null, organisatie: a.org,
        contact: u ? u.contact : null,
        status: u ? u.status : 'onbekend',
        toegelatenDoor: u && u.besloten ? u.besloten.door : null,
        toegelatenOp: u && u.besloten ? u.besloten.at : null,
        bewijs: [
          B('De leverancier is een aanspreekbare rechtspersoon', 'de organisatie komt uit het tenantregister en niet uit een formulier van de leverancier zelf', 'server/routes/appstore/uitgever.js (orgVan)', a.org),
          B('Een mens van RTG heeft hem toegelaten', 'een besluit met een naam; zonder naam neemt de server het niet aan', 'kern/appstore/index.js (uitgeverBesluit)', u && u.besloten ? u.besloten.door : 'geen')
        ]
      },

      watErDraait: {
        versie: m.versie, hash: v.hash, bestanden: bestanden.length,
        bytes: v.maten ? v.maten.totaal : null, scriptBytes: v.maten ? v.maten.script : null,
        budget: { totaal: BUDGET.totaal, script: BUDGET.script, bestanden: BUDGET.bestanden },
        bewijs: [
          B('Wat draait is exact wat is goedgekeurd', 'de versiehash gaat over alle paden en alle bytes; bij ELKE lezing van schijf wordt het bestand tegen zijn eigen hash gehouden en anders niet uitgeleverd', 'kern/appstore/bundel.js (lees)', v.hash),
          B('De omvang is een poort en geen meter achteraf', 'te zwaar komt de keuring niet door', 'kern/appstore/keuring.js (BUDGET)', (v.maten ? Math.round(v.maten.totaal / 1024) : '?') + ' kB')
        ]
      },

      watHetMag: {
        machtigingen: toonbaar(m.machtigingen, m.doelen),
        bewijs: [
          B('Een machtiging geldt pas als het LID hem geeft', 'het manifest vraagt, het lid verleent; de brug leest alleen de verlening', 'kern/appstore/brug.js (roep)', m.machtigingen.length + ' gevraagd'),
          B('Elke machtiging draagt een doel uit een gesloten lijst', 'vrije tekst is niet te vergelijken en niet te diffen', 'kern/appstore/machtigingen.js (DOELEN)', Object.keys(m.doelen || {}).length + ' met doel'),
          B('Een update die meer vraagt, krijgt het niet vanzelf', 'bij elke opening wordt het verschil met de verlening uitgerekend en aan het lid getoond', 'kern/appstore/etalage.js (diff)', 'per opening')
        ]
      },

      watHetNooitKrijgt: G.WAT_HET_NOOIT_KRIJGT,
      waarDeGegevensBlijven: G.WAAR_DE_GEGEVENS_BLIJVEN,

      watDePoortVond: {
        blokkerend: blok.length, letOp: letop.length,
        bevindingen: letop.map(x => ({ wat: x.wat, bestand: x.bestand, hoe: x.hoe })),
        afgetekendDoor: v.besluit ? v.besluit.door : null,
        afgetekendOp: v.besluit ? v.besluit.at : null,
        bewijs: [
          B('De machine keurt nooit goed', 'de vormcontrole kan alleen afkeuren of doorlaten naar een mens; publiceren gebeurt op een andere plek', 'kern/appstore/besluit.js (besluit)', 'mens vereist'),
          B('En nooit de uitgever zelf', 'een besluit waarvan de organisatie gelijk is aan de uitgever wordt geweigerd', 'kern/appstore/besluit.js', 'afgedwongen'),
          B('De virusscanner draaide over elk bestand', 'dezelfde scanner als de rest van het huis; ontbreekt hij, dan gaat de poort dicht en niet open', 'kern/appstore/scan.js', bestanden.length + ' bestanden')
        ]
      },

      uitgang: G.UITGANG,
      nietGebouwd: G.NIET_TE_ZEGGEN
    };
  }

  return { dossier, kanaal: G.kanaal };
};
