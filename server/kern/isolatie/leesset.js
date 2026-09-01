/* DE LEESSET -- wat er onder `isolatie` overblijft, en waarom dat GEMETEN is.

   HET GAT DAT DIT VULT. Een drager op `isolatie` hield tot nu toe precies
   evenveel tegen als een drager op `beschermd`: de zes bevroren categorieën. Het
   verschil dat de naam belooft -- alles dicht behalve lezen -- bestond niet,
   want het huis isoleert door elke functieschakelaar om te zetten en een
   schakelaar is huis-breed.

   WAAROM DE METHODE HET VERKEERDE SIGNAAL IS. De voor de hand liggende regel is
   "alleen GET". In dit huis lopen 3728 schrijfroutes tegenover 35 GET-routes: het
   LEZEN gaat hier grotendeels ook per POST. Die regel zou dus alles hebben
   dichtgezet, en dan is isolatie hetzelfde als een lid uitloggen -- de knop die
   volgens BESTUUR.md grens 6.10 niet gebruikt wordt.

   DE REGEL IS DAAROM OMGEKEERD: EEN PAD MOET ZIJN LEZERSCHAP VERDIENEN. Niet
   "alles mag behalve wat verdacht is" maar "niets mag behalve wat bewezen
   onschadelijk is". Drie voorwaarden, en ze moeten alle drie kloppen:

   1. GEMETEN GEEN EFFECT. IDEMPROEF.json draaide een kale oproep tegen de
      draaiende server en keek daarna in de opslag. Een pad dat werkelijk werk
      deed (een 2xx gaf) en geen enkele collectie bewoog, is een lezer -- niet
      omdat iemand dat vond maar omdat het gemeten is. Dat zijn er 1236.
   2. HET EFFECTMODEL ZIET ER NIETS GESLOTENS IN. De meting onder 1 heeft een
      BLINDE VLEK die zij zelf noemt: `nietGemeten: bestand,externe-aanroep`.
      /api/agenda/ai bewoog geen collectie en roept wel een model aan -- dat kost
      geld en verlaat het huis. ./effecten.js dekt precies dat gat, en daarom
      moeten de twee bronnen het EENS zijn. Een van de twee zou hier onvoldoende
      zijn, en dat is geen dubbel werk maar de reden dat het klopt.
   3. DE BESCHERMSTAND LAAT HET DOOR. Isolatie is strenger dan beschermd
      (./ordening.js), dus alles wat beschermd sluit, blijft dicht.

   PLUS DE UITZONDERINGEN, want zonder die is de regel niet uit te voeren. Wie
   niet kan inloggen leest niets, en een hulpdienst stilzetten om een incident in
   te dammen is nooit de goedkoopste keuze. Het zijn dezelfde vier als in
   kern/beschermstand-lijst.js, en met opzet dezelfde: een tweede lijst
   uitzonderingen zou binnen een jaar uiteenlopen met de eerste.

   VEROUDERING MAAKT HEM STRENGER EN NOOIT LOSSER, en dat is de reden dat een
   bouwartefact hier wél de autoriteit mag zijn terwijl kern/stuur/plan.js dat
   uitdrukkelijk verbiedt. Daar is de kaart een lijst van wat MAG; loopt zij
   achter, dan staat er iets open dat dicht hoorde. Hier is de meting een lijst
   van wat BEWEZEN ONSCHADELIJK is; loopt zij achter, dan is een nieuw pad
   simpelweg niet bewezen en gaat het dicht. De verkeerde kant van dit register
   is de veilige kant.

   WAT DIT KOST, EN DAT HOORT ER EVEN GROOT BIJ TE STAAN. 3074 paden zijn nooit
   met succes gemeten (de proef kwam er niet bij: geen wereld, geen object, geen
   rol). Die gaan onder isolatie dicht, en een deel daarvan zijn onschuldige
   lezers. Isolatie is dus botter dan hij hoeft te zijn, en dat wordt minder
   naarmate IDEMPROEF.json verder komt -- niet naarmate deze module slimmer
   wordt. Het getal staat in ISOLATIEPROEF.json. */
'use strict';

const path = require('path');
const fs = require('fs');
const effecten = require('./effecten');

const BRON = path.join(__dirname, '..', '..', '..', 'IDEMPROEF.json');

/* De vier die binnen een gesloten stand blijven lopen. Ze worden GELEZEN uit
   kern/beschermstand-lijst.js en niet overgetypt: twee lijsten die hetzelfde
   moeten zeggen, zeggen na een jaar iets anders (LAT.md regel 4). */
function uitzonderingIds() {
  try { return require('../beschermstand-lijst').UITZONDERINGEN || {}; } catch (e) { return {}; }
}

/* De gemeten lezers, één keer ingelezen. Geen cache-verval: het bestand
   verandert alleen bij een build, en dan draait het proces opnieuw. */
let gemeten = null;
function lees() {
  if (gemeten) return gemeten;
  let ruw = null;
  try { ruw = JSON.parse(fs.readFileSync(BRON, 'utf8')); } catch (e) { ruw = null; }
  if (!ruw || !ruw.perRoute) {
    /* GEEN BESTAND IS GEEN LEGE LIJST MET EEN SCHOUDEROPHALEN. Zonder meting is
       er geen enkel bewezen lezerschap, en dan sluit isolatie alles behalve de
       vier uitzonderingen. Dat is hard, en het is de goede kant om fout te gaan
       -- maar het moet wel ZICHTBAAR zijn, anders denkt iemand dat de laag
       gewoon streng is. */
    gemeten = { lezers: new Set(), gevonden: 0, gemetenGeslaagd: 0,
      ontbreekt: 'IDEMPROEF.json is niet gelezen; er is dus geen enkel bewezen lezerschap' };
    return gemeten;
  }
  const lezers = new Set();
  let geslaagd = 0, totaal = 0;
  for (const rij of Object.values(ruw.perRoute)) {
    totaal++;
    const z = rij.zonderSleutel || {};
    const eerste = (z.statussen || [])[0];
    /* De oproep moet WERK hebben gedaan. Een 404 die niets bewoog, bewijst
       niets over de route -- alleen dat de proef er niet bij kwam. Dat
       onderscheid niet maken zou 3074 ongemeten paden tot lezer promoveren, en
       dat is exact de fout die deze hele module moet voorkomen. */
    if (!(eerste >= 200 && eerste < 300)) continue;
    geslaagd++;
    const e = z.effect || {};
    const bewoog = Object.keys(e).filter(k => k !== 'nietGemeten').some(k => e[k] !== 'geen');
    if (!bewoog) lezers.add(rij.pad);
  }
  gemeten = { lezers, gevonden: totaal, gemetenGeslaagd: geslaagd, ontbreekt: null };
  return gemeten;
}

/* Het oordeel per pad. Geeft altijd een REDEN terug, ook bij ja: een scherm dat
   moet uitleggen waarom iets dicht is, heeft de grond nodig en niet de uitkomst. */
function magOnderIsolatie(pad, functie) {
  const uitz = uitzonderingIds();
  if (functie && uitz[functie.id]) {
    return { mag: true, grond: 'UITZONDERING',
      waarom: 'deze functie loopt ook binnen een gesloten stand door: ' + uitz[functie.id] };
  }

  const m = lees();
  if (!m.lezers.has(String(pad))) {
    return { mag: false, grond: m.ontbreekt ? 'GEEN_METING' : 'NIET_BEWEZEN_LEZER',
      waarom: m.ontbreekt
        ? m.ontbreekt + ', dus onder isolatie blijft alleen over wat met naam is uitgezonderd'
        : 'van dit pad is niet gemeten dat het werk doet zonder iets te veranderen; onder isolatie ' +
          'gaat dicht wat zijn lezerschap niet heeft bewezen' };
  }

  /* De blinde vlek van die meting, gedekt door de tweede bron -- maar ALLEEN
     door haar harde helft.

     EEN METING SLAAT EEN VERMOEDEN, en dat is hier geen stijlvoorkeur maar een
     bug die eruit is gehaald. De eerste versie liet ook `vermoed` blokkeren, en
     toen viel /api/adres/zoek dicht met de reden IDENTITEIT_WIJZIGEN -- want zijn
     functie zit in de categorie "Toegang en identiteit", en het vermoeden is
     afgeleid uit die categorie. Een adres opzoeken wijzigt geen identiteit. Een
     categorie zegt waar iets WOONT; een gemeten kale oproep zegt wat het DOET.
     Waar die twee botsen, wint de meting, en dat is precies waarvoor de graad
     bestaat. Een `verklaard` effect is geen vermoeden maar een regel die iemand
     met een grond heeft opgeschreven, en die telt wel. */
  const prof = effecten.effectenVan(pad, 'POST', functie);
  if (prof.graad === 'verklaard') {
    const stout = (prof.effecten || []).filter(x => x !== 'LEZEN_EIGEN');
    if (stout.length) {
      return { mag: false, grond: 'EFFECT_GESLOTEN',
        waarom: 'de opslagmeting zag geen collectie bewegen, maar zij kijkt niet naar bestanden en ' +
          'uitgaande aanroepen; het effectmodel ziet hier ' + stout.join(' en ') };
    }
  }

  return { mag: true, grond: 'GEMETEN_LEZER',
    waarom: 'een kale oproep deed werk en bewoog geen enkele collectie, en het effectmodel ziet ' +
      'er niets geslotens in' };
}

/* De cijfers voor het register. Geen percentage: de noemer hangt ervan af of je
   over paden, rollen of gemeten paden praat, en die drie zijn niet hetzelfde. */
function stand() {
  const m = lees();
  return {
    routesInDeProef: m.gevonden,
    metSuccesGemeten: m.gemetenGeslaagd,
    bewezenLezers: m.lezers.size,
    nooitMetSuccesGemeten: m.gevonden - m.gemetenGeslaagd,
    ontbreekt: m.ontbreekt,
    kost: 'wat nooit met succes is gemeten, gaat onder isolatie dicht. Een deel daarvan zijn ' +
      'onschuldige lezers, dus isolatie is botter dan hij hoeft te zijn. Dat wordt minder naarmate ' +
      'IDEMPROEF.json verder komt, niet naarmate deze module slimmer wordt.',
    verouderingsrichting: 'strenger: een pad dat nog niet in de meting staat, is niet bewezen en gaat dicht'
  };
}

/* Alleen voor de toetsen: de ingelezen meting weggooien. */
function vergeet() { gemeten = null; }

module.exports = { magOnderIsolatie, stand, vergeet, BRON };
