/* DE STAND VAN DE POORT -- is hij gemonteerd, bijt hij, en wat heeft hij gezien.

   Los van ./isolatiepoort.js omdat het twee onderwerpen zijn, en de naad is
   dezelfde als tussen kern/beschermstand-lijst.js en kern/beschermstand.js: daar
   het OORDEEL ("mag dit verzoek door"), hier de BOEKHOUDING erover. Ze schuiven
   elk om hun eigen reden -- het oordeel als de beveiligingsregels veranderen, de
   boekhouding als een scherm iets anders wil kunnen laten zien -- en samen in een
   bestand betekende dat elke schermwens de weg raakte waar elk verzoek langskomt.

   Dat ze uit elkaar moesten, kwam van keuringsregel 13 (10 KB). Die grens is een
   dakpan en geen doel: eroverheen betekent dat er een tweede onderwerp in zit, en
   dat was hier ook zo.

   DE LATE BINDING WOONT HIER, en daarmee ook `laag` en `bijt`. Zelfde patroon als
   zetWacht/zetScanNet in opzet/verzoekketen.js: de isolatielaag wordt pas bij het
   monteren van de routes opgehangen, en de middleware staat daarvoor. De poort
   VRAAGT de laag op (huidig()) in plaats van hem te bezitten -- zou hij hem zelf
   bewaren, dan zijn er twee plekken die weten of de laag er is, en dan kan er een
   ontstaan die "gemonteerd" zegt terwijl de andere niets doet.

   DE TELLER IS GEEN BEWIJS ZOLANG HIJ NUL IS, en dat zegt stand() zelf. Een
   schaduwteller die nooit vult, gaat anders als bewijs gelden -- CONTROLPLANE.md:
   je kunt niet afdwingen wat nooit heeft meegelopen, maar "nooit meegelopen" is
   iets anders dan "meegelopen en niets gevonden". */
'use strict';

const handhaving = require('../kern/isolatie/handhaving');

let laag = null;
let bijt = false;
const telling = { gewogen: 0, zouSluiten: 0, paden: [], dragers: {} };

function zetLaag(l, opties) {
  laag = l || null;
  bijt = !!(opties && opties.afdwingen);
  if (laag) handhaving.meldHandhaver({ waar: 'middleware/isolatiepoort.js', modus: bijt ? 'afdwingen' : 'schaduw' });
  return stand();
}

function huidig() { return laag; }
function bijtHij() { return bijt; }

function stand() {
  return Object.assign({ gemonteerd: !!laag, bijt }, handhaving.stand(), {
    gewogen: telling.gewogen, zouSluiten: telling.zouSluiten,
    voorbeelden: telling.paden.slice(0, 20), perDrager: Object.assign({}, telling.dragers),
    /* WAAROM DIT GETAL VOORLOPIG NUL BLIJFT, en dat is geen storing: de noemer
       is "verzoeken van accounts die een stand dragen". Zet er niemand een stand,
       dan weegt deze poort niets -- en dan bewijst hij ook niets. */
    let: telling.gewogen === 0
      ? 'nog geen enkel verzoek van een account met een stand; deze teller bewijst dus niets'
      : null
  });
}

/* Alleen voor de toets: een verse start. Nooit uit productiecode aanroepen --
   een teller die zichzelf kan wissen, is geen bewijs. */
function _wisTelling() { telling.gewogen = 0; telling.zouSluiten = 0; telling.paden = []; telling.dragers = {}; }

module.exports = { zetLaag, stand, huidig, bijtHij, telling, _wisTelling };
