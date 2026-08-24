/* ============================================================================
   HET TOEVAL -- een plek waar dit huis een munt opgooit.

   WAAROM DIT ER IS. Een toets die om de dertig rondes zakt is erger dan een
   toets die altijd zakt: de eerste leer je negeren. En de enige manier om zo'n
   uitslag te ONDERZOEKEN is hem overdoen -- precies wat niet kan zolang elke
   keuze uit een bron komt die per definitie elke keer anders is.

   Ditzelfde probleem is hier eerder opgelost voor de tijd (server/lib/klok.js,
   RTG_KLOK). Dit is dezelfde ingreep voor het toeval, met dezelfde afspraken:
   zonder de omgevingsvariabele verandert er niets en kost het niets, met de
   variabele is de stroom herhaalbaar, en in productie weigert hij hard.

   HOE.

     RTG_ZAAD=hallo        elke aanroep hieronder wordt herhaalbaar
     (niet gezet)          exact Math.random(), geen omweg

   Een zaad is een tekenreeks, geen getal: 'ronde-473' of de tak waarop je zit
   leest terug in een foutmelding, '1699283' niet.

   WAT HIER MET OPZET NIET DOORHEEN GAAT: crypto.randomBytes en alles wat
   daarop leunt -- sessietokens, pincodes, sleutels, entreecodes. Een
   voorspelbaar sessietoken is geen reproduceerbaarheid maar een inbraak. Deze
   module raakt uitsluitend Math.random-toeval: welke tip je krijgt, welke
   vraag als volgende komt, hoe een demovloot beweegt. Dat onderscheid staat op
   verschillende plekken in de kern al met zoveel woorden in de code ("niet
   voorspelbaar zijn (Math.random is dat wel)"), en het blijft zo.

   WAT DIT NOG NIET IS, en dat hoort erbij. Deze module maakt het MOGELIJK; hij
   verplaatst geen enkele bestaande aanroep. Zolang een module Math.random zelf
   aanroept, doet hij niet mee -- dat is geen verborgen fout maar een gemeten
   schuld, geteld in TOEVAL.json en bewaakt door scripts/toeval.js.

   EN NOG EEN EERLIJKE GRENS. Een gezaaide stroom herhaalt zich alleen als de
   VOLGORDE van de aanroepen zich herhaalt. Twee verzoeken die tegelijk
   binnenkomen kunnen elkaar afwisselen, en dan komt dezelfde aanroep een
   trekking verder in de rij terecht. Voor een toets die een server voor zichzelf
   heeft -- en dat is hier de regel -- is dat geen probleem. Voor een server
   onder echte gelijktijdige belasting wel, en dan is "het zaad stond vast" geen
   bewijs dat de uitkomst hetzelfde hoorde te zijn. Wie dat nodig heeft, heeft
   een stroom PER verzoek nodig en niet een per proces.
   ========================================================================== */
'use strict';

const RUW = process.env.RTG_ZAAD == null ? '' : String(process.env.RTG_ZAAD);

/* WEIGEREN IN PRODUCTIE, EN HARDER DAN DE KLOK DAT DOET.

   Een verzette klok in productie is een storing. Een vastgezet toeval in
   productie is iets anders: elke keuze die op deze module leunt wordt
   voorspelbaar voor wie het zaad kent, en de grens tussen "welke tip krijg ik"
   en "welke code hoort bij deze deur" is een grens die code verschuift, niet
   een grens die vaststaat. Dus: bij het laden gooien, niet bij het eerste
   gebruik. Een fout die pas bij de duizendste aanvraag opvalt is de duurste. */
if (RUW && process.env.NODE_ENV === 'production') {
  throw new Error('RTG_ZAAD staat gezet terwijl NODE_ENV=production. Een vastgezet toeval hoort ' +
    'niet in een echte rit: elke keuze die erop leunt wordt voorspelbaar. Haal RTG_ZAAD uit de omgeving.');
}

/* Een tekenreeks naar vier startgetallen (cyrb128). Waarom niet gewoon een
   getal parsen: dan zou 'ronde-473' stil als 0 worden gelezen en zouden alle
   zaden hetzelfde zijn -- de vorm van stilte waar LAT-regel 5 over gaat. */
function zaadGetallen(tekst) {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0; i < tekst.length; i++) {
    const k = tekst.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
}

/* sfc32: klein, snel, en met een periode die geen enkele toetsronde haalt.
   Geen cryptografische generator, en dat is hier juist de bedoeling -- wie
   cryptografie nodig heeft, hoort bij crypto.randomBytes te zijn. */
function maakStroom(zaad) {
  let [a, b, c, d] = zaadGetallen(zaad);
  return function () {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

const STROOM = RUW ? maakStroom(RUW) : null;
/* De LEVENDE stroom staat apart van STROOM, zodat terugNaarVers() hem kan
   vervangen zonder dat de vraag "is er uberhaupt een zaad" mee verandert. */
let volgende = STROOM;
let getrokken = 0;

/* De vervanger van Math.random(). Zonder zaad LETTERLIJK Math.random -- geen
   wikkel, geen teller, geen kosten. */
const kans = RUW ? (() => { getrokken++; return volgende(); }) : Math.random;

/* De drie vormen die in deze codebase werkelijk voorkomen, zodat een aanroeper
   niet zelf `Math.floor(kans() * a.length)` hoeft te schrijven. Dat is niet
   alleen leesbaarder: die uitdrukking is hier al twintig keer met de hand
   overgeschreven en een ervan hoort een randgeval te missen. */
function kies(rij) {
  if (!Array.isArray(rij) || !rij.length) return undefined;
  return rij[Math.floor(kans() * rij.length)];
}
/* Een geheel getal van min tot en met max. Inclusief aan BEIDE kanten, want dat
   is wat elke aanroeper hier bedoelt ("een cijfer van 1 tot 6"). */
function geheel(min, max) {
  min = Math.ceil(min); max = Math.floor(max);
  if (!(max >= min)) return min;
  return min + Math.floor(kans() * (max - min + 1));
}
/* Fisher-Yates, op een KOPIE. De versie die hier in de code staat schudt de
   rij die je meegeeft, en dat is twee keer een bron van verwarring geweest. */
function schud(rij) {
  const uit = Array.isArray(rij) ? rij.slice() : [];
  for (let i = uit.length - 1; i > 0; i--) {
    const j = Math.floor(kans() * (i + 1));
    [uit[i], uit[j]] = [uit[j], uit[i]];
  }
  return uit;
}

/* TERUG NAAR VERS -- de naad die elke module met eigen toestand hier heeft.

   Twee dingen gaan terug: de teller (die bepaalt geen gedrag, alleen de zin in
   uitleg()) en de STROOM zelf. Dat tweede is de reden dat deze naad er is. Een
   gezaaide reeks is alleen herhaalbaar vanaf zijn BEGIN; een server die een
   tweede toets bedient zonder terug te zetten, geeft die toets de trekkingen die
   de vorige toevallig had overgelaten. Dan staat het zaad wel vast en verloopt
   de tweede toets alsnog anders -- de duurste soort halve oplossing.

   Zonder zaad doet hij niets: er is dan geen stroom om terug te zetten, en de
   teller telt niet. */
function terugNaarVers() {
  getrokken = 0;
  if (STROOM) volgende = maakStroom(RUW);
}

const gezaaid = () => !!RUW;
const zaad = () => RUW || null;
const trekkingen = () => getrokken;
const uitleg = () => (RUW
  ? 'het toeval ligt vast op zaad "' + RUW + '" (' + getrokken + ' trekkingen tot nu toe)'
  : 'het toeval is echt toeval');

const CONTROL = {
  control: 'TOEVAL-ZAAD',
  wat: 'keuzes die op toeval leunen zijn te herhalen, zodat een sporadische uitslag te onderzoeken is',
  eigenaar: 'Techniek',
  bewijs: ['test/toeval.test.js'],
  bewijsstuk: 'TOEVAL.json -- hoeveel code nog buiten het zaad staat',
  dekking: { register: 'TOEVAL.json', beproefd: 'gemeten.modulesOpHetZaad',
    totaal: 'gemeten.bestanden', eenheid: 'modules die toeval trekken',
    tellers: { directeToevalAanroepen: 'gemeten.totaal' } },
  grens: 'alleen code die DEZE module gebruikt is te herhalen; de rest roept Math.random zelf aan. ' +
    'Hoeveel dat er zijn staat in TOEVAL.json en wordt door scripts/toeval.js bewaakt. ' +
    'crypto.randomBytes valt hier met opzet BUITEN: een voorspelbaar sessietoken is geen ' +
    'reproduceerbaarheid maar een inbraak. En een gezaaide stroom herhaalt zich alleen als de ' +
    'VOLGORDE van de aanroepen zich herhaalt -- bij gelijktijdige verzoeken is dat niet gegeven.'
};

module.exports = { kans, kies, geheel, schud, gezaaid, zaad, trekkingen, uitleg, terugNaarVers, maakStroom, CONTROL };
