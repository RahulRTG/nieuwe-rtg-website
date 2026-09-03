/* HET EFFECTMODEL -- isolatie gaat over wat er GEBEURT, niet over welk pad het doet.

   WAAROM DIT ER BOVENOP DE BESCHERMSTAND KOMT. kern/beschermstand.js bevriest
   per CATEGORIE uit de functiecatalogus, en dat werkt: het is één centrale lijst
   in plaats van duizend verspreide checks. Maar een categorie zegt waar iets
   woont, niet wat het doet. Zodra er een nieuw pad bij komt dat geld beweegt en
   in een categorie valt die doorloopt, is de grens weg zonder dat iemand iets
   heeft uitgezet. Een effectmodel keert dat om: een nieuw pad met dezelfde
   strekking valt vanzelf onder dezelfde grens.

   HIJ HANDHAAFT VANDAAG NIETS, EN DAT IS HET ONTWERP EN GEEN TEKORT.
   CONTROLPLANE.md: een nieuwe handhavingsregel loopt eerst mee in de schaduw --
   je kunt niet afdwingen wat nooit zonder te blokkeren heeft gedraaid. Deze
   laag rekent dus mee naast de beschermstand en meldt waar de twee het ONEENS
   zijn. Die lijst onenigheden is het werk; hem overslaan en meteen afdwingen is
   hoe je een platform op een dinsdagochtend stilzet.

   DE EFFECTEN ZIJN PLATFORMVERMOGEN EN GEEN DOMEINVERMOGEN. OS.md par. 4: één
   grammatica mag over "mag deze aanroep, en doet hij het?" en nooit over "wat
   voor zaak is dit". `GELD_BEWEGEN` staat er dus wel in en `bookings` niet --
   dat laatste is exact de `Asset`-fout, en die is hier al een keer gemaakt.

   VIER GRADEN, EN DE LAATSTE IS DE BELANGRIJKSTE. Een pad draagt zijn effecten
   `verklaard` (iemand heeft ze opgeschreven, met een grond), `afgeleid` (uit de
   COLLECTIES die de proef zag bewegen, via ./effectcollecties.js), `vermoed`
   (uit de categorie van zijn functie) of `onbekend` (niets van die drie).

   DE VOLGORDE IS EEN RANGORDE VAN BEWIJS EN GEEN VOLGORDE VAN GEMAK. `afgeleid`
   staat boven `vermoed` omdat een gemeten schrijfactie iets zegt over wat een
   route DOET, en een categorie alleen over waar hij WOONT. Dat verschil is een
   keer duur geweest: /api/adres/zoek viel dicht met de reden IDENTITEIT_WIJZIGEN
   omdat zijn functie in "Toegang en identiteit" zit, terwijl een adres opzoeken
   geen identiteit wijzigt.
   Een onbekend effect wordt NOOIT stil als "geen effect" gelezen: in de schaduw
   telt hij als een onenigheid, en zodra deze laag ooit handhaaft, hoort hij
   fail closed te gaan. Wie hier `[]` teruggeeft bij twijfel, heeft een meter
   gebouwd die alles goedkeurt wat hij niet begrijpt. */
'use strict';

const { EFFECTEN, NAMEN } = require('./effectwoorden');
const { VERKLAARD, PER_CATEGORIE } = require('./effectregister');
const { BESCHERMD_SLUIT, TREDE_SLUIT, TREDE_WAAROM, sluit } = require('./standsluiting');
const proefmeting = require('./proefmeting');
const effectcollecties = require('./effectcollecties');

/* ---------------------------------------------------------------------------
   DE AFLEIDING.
   ------------------------------------------------------------------------ */
function effectenVan(pad, methode, functie) {
  const p = String(pad || '');
  const leest = /^(GET|HEAD|OPTIONS)$/i.test(String(methode || 'POST'));

  /* 1. WAT IEMAND HEEFT VERKLAARD -- een patroon met een grond. */
  const uitVerklaring = new Set();
  const gronden = [];
  for (const r of VERKLAARD) {
    if (!r.patroon.test(p)) continue;
    for (const e of r.effecten) uitVerklaring.add(e);
    gronden.push(r.grond);
  }

  /* 2. WAT DE PROEF ZAG BEWEGEN -- gemeten collecties, ingedeeld in
        ./effectcollecties.js. Alleen die laatste stap is mensenwerk. */
  const collecties = proefmeting.collectiesVan(p);
  const uitMeting = new Set();
  const grondenMeting = [];
  if (collecties) {
    for (const col of collecties) {
      const rij = effectcollecties.effectVan(col);
      if (!rij) continue;
      uitMeting.add(rij.effect);
      grondenMeting.push(col + ': ' + rij.grond);
    }
  }

  /* DE TWEE WORDEN OPGETELD EN NIET GERANGSCHIKT, en dat is een besluit uit een
     meting. Over de 31 paden waar allebei de bronnen iets zeggen, overlapten er
     26 en waren er 5 zonder overlap -- maar die vijf spreken elkaar NIET tegen,
     ze vullen elkaar aan: /api/member/ai/tegoed roept een model aan (dat ziet de
     verklaring aan zijn naam) EN beweegt tegoed (dat ziet de proef in de
     collectie). Wie hier de een de ander laat overschrijven, gooit telkens een
     van beide effecten weg -- en bij een beveiligingslaag is dat de helft die je
     net nodig had.

     Ze zien met opzet verschillende dingen: de proef kijkt in de OPSLAG en zegt
     zelf dat zij bestanden en uitgaande aanroepen niet ziet; de verklaring leest
     de NAAM en weet niets van collecties. Elkaars blinde vlek, en daarom samen. */
  const alles = new Set([...uitVerklaring, ...uitMeting]);
  if (alles.size) {
    const bronnen = [];
    if (uitVerklaring.size) bronnen.push('verklaard');
    if (uitMeting.size) bronnen.push('afgeleid');
    return {
      effecten: leest ? ['LEZEN_EIGEN'] : [...alles],
      /* De graad is de STERKSTE bijdragende bron: een verklaring met een grond
         staat boven een afleiding uit een meting, en die weer boven een
         vermoeden uit een categorie. `bronnen` zegt wie er werkelijk meededen. */
      graad: uitVerklaring.size ? 'verklaard' : 'afgeleid',
      bronnen,
      gronden: gronden.concat(grondenMeting),
      bron: bronnen.join(' + ')
    };
  }

  /* 3. HET VERMOEDEN. Uit de categorie van de functie, en dus over waar iets
        WOONT in plaats van wat het DOET. Hij komt als laatste omdat hij als
        enige geen meting en geen grond per pad achter zich heeft. */
  const cat = functie && functie.categorie;
  if (cat && PER_CATEGORIE[cat]) {
    return { effecten: [...PER_CATEGORIE[cat]], graad: 'vermoed', bronnen: ['vermoed'], gronden:
      ['afgeleid uit de categorie "' + cat + '" van zijn functie, en een categorie zegt waar iets woont'],
      bron: 'kern/isolatie/effectregister.js: PER_CATEGORIE' };
  }

  /* GEEN LEGE LIJST. Een leeg antwoord leest als "dit doet niets", en dat is
     de gevaarlijkste zin in een beveiligingslaag. */
  return { effecten: null, graad: 'onbekend', bronnen: [], gronden:
    [collecties && collecties.size
      ? 'de proef zag ' + collecties.size + ' collectie(s) bewegen, maar geen ervan is ingedeeld ' +
        'in kern/isolatie/effectcollecties.js'
      : 'geen verklaring, geen gemeten collectie en geen categorie met een vermoeden'],
    bron: null };
}

/* Het schaduwoordeel. `onbekend` is met opzet een eigen uitkomst naast ja en
   nee: een laag die niet weet wat een pad doet, hoort dat te zeggen en niet te
   stemmen. */
function schaduwOordeel({ pad, methode, functie, stand }) {
  const prof = effectenVan(pad, methode, functie);
  const dicht = sluit(stand);
  if (prof.graad === 'onbekend') {
    return { oordeel: 'onbekend', effecten: null, graad: prof.graad, geraakt: [],
      waarom: 'dit pad heeft geen effectprofiel; er valt niets te wegen' };
  }
  const geraakt = prof.effecten.filter(e => dicht.includes(e));
  return {
    oordeel: geraakt.length ? 'tegenhouden' : 'doorlaten',
    effecten: prof.effecten, graad: prof.graad, gronden: prof.gronden, geraakt,
    waarom: geraakt.length
      ? 'deze stand sluit ' + geraakt.join(' en ')
      : 'geen van de effecten van dit pad staat dicht in deze stand'
  };
}

/* De collectielijst wordt bij het LADEN tegen de effectnamen gehouden. Een
   tikfout daar zou een collectie stil ongeclassificeerd laten -- precies de
   faalvorm die deze laag moet uitsluiten, en die je bij het eerste incident
   ontdekt in plaats van bij het starten. */
const COLLECTIES_INGEDEELD = effectcollecties.keurIn(NAMEN);

module.exports = { EFFECTEN, NAMEN, BESCHERMD_SLUIT, TREDE_SLUIT, TREDE_WAAROM, COLLECTIES_INGEDEELD,
  VERKLAARD, PER_CATEGORIE, effectenVan, sluit, schaduwOordeel };
