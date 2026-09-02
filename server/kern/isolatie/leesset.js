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

const effecten = require('./effecten');
const proefmeting = require('./proefmeting');

/* De vier die binnen een gesloten stand blijven lopen. Ze worden GELEZEN uit
   kern/beschermstand-lijst.js en niet overgetypt: twee lijsten die hetzelfde
   moeten zeggen, zeggen na een jaar iets anders (LAT.md regel 4). */
function uitzonderingIds() {
  try { return require('../beschermstand-lijst').UITZONDERINGEN || {}; } catch (e) { return {}; }
}

/* DE UITGANG MAG NOOIT DICHTVALLEN DOOR DE STAND ZELF.

   Gemeten en niet bedacht: bruikbaarheid.js liet zien dat onder `isolatie` de
   verhalen `zelf-beschermen` en `ontsluiten-aanvragen` op "werkt niet" stonden.
   De routes van deze laag zijn nieuw, dus de proef heeft ze nooit gemeten, dus
   de leesset sluit ze -- en dan kan een mens die in isolatie staat zichzelf niet
   meer beschermen en er ook niet meer uit. Een stand zonder uitgang is een val,
   en een val zet niemand aan.

   Ze staan hier met naam en niet als patroon: een patroon als /api/isolatie/
   zou elke toekomstige route van deze laag automatisch vrijstellen, en juist
   hier hoort elke vrijstelling een besluit te zijn. */
const EIGEN_UITGANG = Object.freeze({
  '/api/isolatie/mijn': 'de eigen stand kunnen LEZEN; wie niet ziet dat hij dichtstaat, snapt niets',
  '/api/isolatie/mijn/zet': 'zichzelf strenger zetten mag nooit door de bescherming zelf dichtvallen',
  '/api/isolatie/mijn/ontsluiting': 'de uitgang aanvragen',
  '/api/isolatie/mijn/ontsluiting/stap': 'de uitgang aflopen',
  '/api/isolatie/mijn/ontsluiting/commit': 'de uitgang afmaken',
  '/api/isolatie/mijn/ontsluiting/afbreken': 'de uitgang laten vallen'
});

/* Het oordeel per pad. Geeft altijd een REDEN terug, ook bij ja: een scherm dat
   moet uitleggen waarom iets dicht is, heeft de grond nodig en niet de uitkomst. */
function magOnderIsolatie(pad, functie) {
  if (EIGEN_UITGANG[String(pad)]) {
    return { mag: true, grond: 'EIGEN_UITGANG',
      waarom: 'dit is de uitgang van de stand zelf: ' + EIGEN_UITGANG[String(pad)] };
  }

  const uitz = uitzonderingIds();
  if (functie && uitz[functie.id]) {
    return { mag: true, grond: 'UITZONDERING',
      waarom: 'deze functie loopt ook binnen een gesloten stand door: ' + uitz[functie.id] };
  }

  const m = proefmeting.stand();
  if (!proefmeting.isBewezenLezer(pad)) {
    return { mag: false, grond: m.ontbreekt ? 'GEEN_METING' : 'NIET_BEWEZEN_LEZER',
      waarom: m.ontbreekt
        ? m.ontbreekt + ', dus onder isolatie blijft alleen over wat met naam is uitgezonderd'
        : 'van dit pad is niet gemeten dat het werk doet zonder iets te veranderen; onder isolatie ' +
          'gaat dicht wat zijn lezerschap niet heeft bewezen' };
  }

  /* DE BLINDE VLEK VAN DIE METING, EN ALLEEN DIE.

     De opslagmeting zegt zelf wat zij niet ziet: `nietGemeten: bestand,
     externe-aanroep`. Precies die gaten dekt het effectmodel hier af -- en
     verder niets, want buiten dat gat heeft de meting GEKEKEN en het model
     alleen geredeneerd.

     DAT ONDERSCHEID IS EEN KEER DUUR GEWEEST. De eerste versie liet elk
     `verklaard` effect een gemeten lezer blokkeren. De regel `^/api/(pay|bank)/`
     zegt GELD_BEWEGEN, dus /api/bank/afschrift -- een afschrift OPVRAGEN -- viel
     dicht. kern/isolatie/bruikbaarheid.js ving dat: het verhaal `geld-lezen`
     stond op "werkt niet", en dat is de eerste handeling van iemand die zijn
     account niet vertrouwt.

     De regel is nu: een effect dat een SCHRIJFACTIE impliceert (geld, rechten,
     identiteit, andermans gegevens, de beveiliging) is door de meter gemeten --
     en de meter zag niets bewegen. Daar wint de meting van de verklaring, want
     zij heeft gekeken. Alleen de effecten die buiten de opslag vallen, mogen een
     gemeten lezer alsnog sluiten. */
  const BUITEN_DE_OPSLAG = ['UITGAANDE_AANROEP', 'EXTERN_BEREIKEN', 'ONVERTROUWDE_BYTES',
    'DERDENCODE_UITVOEREN', 'BULK_UITVOER'];
  const prof = effecten.effectenVan(pad, 'POST', functie);
  if (prof.graad === 'verklaard' || prof.graad === 'afgeleid') {
    const stout = (prof.effecten || []).filter(x => BUITEN_DE_OPSLAG.includes(x));
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
  const m = proefmeting.stand();
  return {
    routesInDeProef: m.routesInDeProef,
    metSuccesGemeten: m.metSuccesGemeten,
    bewezenLezers: m.bewezenLezers,
    nooitMetSuccesGemeten: m.nooitMetSuccesGemeten,
    ontbreekt: m.ontbreekt,
    kost: 'wat nooit met succes is gemeten, gaat onder isolatie dicht. Een deel daarvan zijn ' +
      'onschuldige lezers, dus isolatie is botter dan hij hoeft te zijn. Dat wordt minder naarmate ' +
      'IDEMPROEF.json verder komt, niet naarmate deze module slimmer wordt.',
    verouderingsrichting: 'strenger: een pad dat nog niet in de meting staat, is niet bewezen en gaat dicht'
  };
}

/* Alleen voor de toetsen: de ingelezen meting weggooien. */
function vergeet() { proefmeting.vergeet(); }

module.exports = { magOnderIsolatie, stand, vergeet, EIGEN_UITGANG, BRON: proefmeting.BRON };
