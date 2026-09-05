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
const telling = { gewogen: 0, zouSluiten: 0, onzeker: 0, paden: [], dragers: {}, fouten: [] };

/* De productiestart keurt deze vlag hard. Buiten productie kan een gerichte
   proef hem eveneens zetten, maar er bestaat geen impliciete "production =
   vast wel aan"-terugval: de actieve stand moet in de omgeving staan en wordt
   daardoor onderdeel van het releasebewijs. */
function afdwingenUitOmgeving(env = process.env) {
  return String(env.RTG_ISOLATIE_AFDWINGEN || '') === '1';
}

function zetLaag(l, opties) {
  const volgende = l || null;
  const volgendeBijt = !!(opties && opties.afdwingen);
  if (laag && volgende && laag === volgende && bijt && !volgendeBijt) {
    throw new Error('isolatiepoort: een gemonteerde handhaver mag niet stil naar schaduw worden teruggezet');
  }
  laag = volgende;
  bijt = volgende ? volgendeBijt : false;
  if (laag) handhaving.meldHandhaver({ waar: 'middleware/isolatiepoort.js', modus: bijt ? 'afdwingen' : 'schaduw' });
  else handhaving.wisHandhaver();
  return stand();
}

function huidig() { return laag; }
function bijtHij() { return bijt; }

function noteerOnzeker(fout, pad) {
  telling.onzeker++;
  const tekst = String((fout && fout.message) || fout || 'onbekende fout').slice(0, 160);
  if (telling.fouten.length < 20) telling.fouten.push((pad ? String(pad) + ': ' : '') + tekst);
}

/* De omgevingsvlag bewijst alleen intentie. Deze tweede poort draait na het
   monteren van de routes en bewijst dat de laag, de sessieoplosser en een
   leesbaar opslagcontract er in DIT proces werkelijk zijn. */
function eisProductieGereed(env = process.env) {
  if (String(env.NODE_ENV || '') !== 'production') return { nodig: false };
  if (!afdwingenUitOmgeving(env)) throw new Error('isolatiepoort: productie mist RTG_ISOLATIE_AFDWINGEN=1');
  if (!laag || !bijt) throw new Error('isolatiepoort: productie heeft geen bijtende isolatielaag gemonteerd');
  const sessies = require('../kern/isolatie/sessiedragers');
  if (!sessies.sessieOplosserGereed()) throw new Error('isolatiepoort: productie mist de centrale sessieoplosser');
  if (typeof laag.controleerOpslag !== 'function') throw new Error('isolatiepoort: de gemonteerde laag kan haar opslag niet keuren');
  laag.controleerOpslag();
  const leiding = require('../kern/intreksignaal').stand();
  if (!leiding.gekoppeld) throw new Error('isolatiepoort: productie mist de intrekkingsleiding naar bestaande verbindingen');
  if (env.REDIS_URL && leiding.soort !== 'redis') {
    throw new Error('isolatiepoort: REDIS_URL is gezet maar de intrekkingsleiding is niet op Redis gemonteerd');
  }
  return { nodig: true, gereed: true };
}

function stand() {
  const gemeld = handhaving.stand();
  return Object.assign({}, gemeld, { gemonteerd: !!laag && gemeld.gemonteerd, bijt,
    afdwingen: !!laag && bijt && gemeld.afdwingen,
    gewogen: telling.gewogen, zouSluiten: telling.zouSluiten, onzeker: telling.onzeker,
    voorbeelden: telling.paden.slice(0, 20), perDrager: Object.assign({}, telling.dragers),
    fouten: telling.fouten.slice(0, 20),
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
function _wisTelling() {
  telling.gewogen = 0; telling.zouSluiten = 0; telling.onzeker = 0;
  telling.paden = []; telling.dragers = {}; telling.fouten = [];
}

module.exports = { zetLaag, stand, huidig, bijtHij, telling, noteerOnzeker,
  eisProductieGereed, _wisTelling, afdwingenUitOmgeving };
