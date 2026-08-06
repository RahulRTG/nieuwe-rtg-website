/* Payroll OS: VALUTA -- want "centen" is niet overal honderdsten.

   WAAROM DIT ERTOE DOET EN GEEN OPSMUK IS. De hele loonlaag rekent in gehele
   getallen, en dat is goed: een loonstrook opgeteld uit floats loopt na twintig
   regels een cent uit de pas. Maar het VELD heet `brutoCenten`, het scherm zet
   er een euroteken voor, en beide gaan ervan uit dat honderd van dat getal een
   eenheid is. In Japan is dat niet zo. De yen heeft GEEN onderverdeling: 5.000
   yen is 5000 in de kleinste eenheid, niet 500.000. Wie daar met honderdsten
   rekent, betaalt honderd keer te weinig -- of honderd keer te veel, en dat is
   erger, want dat merkt niemand die het geld ontvangt.

   Andersom bestaan er valuta's met DRIE decimalen: de Koeweitse dinar, de
   Bahreinse dinar, de Tunesische dinar. Daar zijn duizend fils een dinar.

   DE REGEL DIE DIT OPLOST: een bedrag in dit huis is altijd een geheel getal in
   de KLEINSTE EENHEID van zijn valuta, en de valuta staat erbij. Niet "centen"
   als natuurwet maar "minor units" met een schaal die uit deze tabel komt. De
   veldnamen (`brutoCenten`, `nettoCenten`) blijven staan -- ze in de hele laag
   omdopen is een verbouwing die niets aan de uitkomst verandert en wel elke
   oude strook onleesbaar maakt -- maar wat ze BETEKENEN staat hier.

   WAAR DE VALUTA VANDAAN KOMT: uit het regelpakket, dezelfde plek als de
   tarieven. Niet uit het land van de zaak via een tabel die iemand bijhoudt:
   een land kan van munt wisselen (Kroatie ging in 2023 naar de euro) en dan
   hoort een OUDE loonrun nog steeds in de oude munt te staan. De jaargang van
   toen weet dat; een landtabel van vandaag niet.

   WAT HIER NIET GEBEURT: omrekenen. Er staat geen enkele wisselkoers in dit
   bestand en die hoort er ook niet in. Loon wordt uitbetaald in de munt van het
   land; een koers erbij zou betekenen dat een loonstrook verandert als de markt
   beweegt, en dat is precies wat een loonstrook niet mag doen. */
'use strict';

/* ISO 4217, alleen de afwijkingen. Verreweg de meeste valuta's hebben twee
   decimalen; die hoeven hier niet te staan. Wat hier WEL staat is elke valuta
   waar het anders is, want daar zit de fout. */
const NUL_DECIMALEN = ['BIF', 'CLP', 'DJF', 'GNF', 'ISK', 'JPY', 'KMF', 'KRW',
  'PYG', 'RWF', 'UGX', 'UYI', 'VND', 'VUV', 'XAF', 'XOF', 'XPF'];
const DRIE_DECIMALEN = ['BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND'];

const CODE_VORM = /^[A-Z]{3}$/;

/* Hoeveel decimalen heeft deze valuta? Onbekend levert null en NIET een
   vriendelijke 2: een gok van twee decimalen op een yen is een factor honderd,
   en dat is precies de fout waar dit bestand voor bestaat. */
function decimalenVan(code) {
  const c = String(code || '').toUpperCase();
  if (!CODE_VORM.test(c)) return null;
  if (NUL_DECIMALEN.includes(c)) return 0;
  if (DRIE_DECIMALEN.includes(c)) return 3;
  return 2;
}

const schaalVan = (code) => {
  const d = decimalenVan(code);
  return d == null ? null : Math.pow(10, d);
};

/* De symbolen die mensen herkennen. Bewust een korte lijst: waar geen symbool
   staat komt de CODE in beeld ("CHF 4 200,00"), en dat is beter dan een teken
   dat bij de verkeerde munt hoort. Een dollarteken voor een Canadese dollar
   naast een Amerikaanse is hoe je een bedrag in het verkeerde land leest. */
const SYMBOLEN = { EUR: '€', GBP: '£', JPY: '¥', USD: 'US$', CHF: 'CHF' };

/* Een bedrag in de kleinste eenheid naar tekst, met de valuta erbij.

   De scheidingstekens volgen de Nederlandse schrijfwijze, want dat is de taal
   van dit huis; de VALUTA volgt het land van de loonrun. Die twee zijn
   verschillende vragen en werden vaak door elkaar gehaald: een Nederlandse
   administrateur die een Japanse loonstrook bekijkt, leest Nederlandse cijfers
   met een Japanse munt. */
function toon(minorUnits, code) {
  const d = decimalenVan(code);
  if (d == null) return String(minorUnits) + ' (' + String(code || 'onbekende valuta') + ')';
  const negatief = minorUnits < 0;
  const abs = Math.abs(Math.round(Number(minorUnits) || 0));
  const schaal = Math.pow(10, d);
  const heel = Math.floor(abs / schaal);
  const rest = abs - heel * schaal;
  const groepen = String(heel).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const staart = d ? ',' + String(rest).padStart(d, '0') : '';
  const teken = SYMBOLEN[String(code).toUpperCase()] || String(code).toUpperCase();
  return (negatief ? '-' : '') + teken + ' ' + groepen + staart;
}

/* De keuring, voor ./regelpakket.js. Een pakket zonder valuta is niet "vast
   euro": het is een pakket waarvan we niet weten in welke munt het rekent, en
   dat is een pakket waar geen loon op mag draaien. */
function keurValuta(code) {
  const c = String(code || '');
  if (!c) return ['valuta ontbreekt. Zeg in welke munt dit pakket rekent; "vast euro" is geen aanname die een loonrun mag dragen.'];
  if (!CODE_VORM.test(c.toUpperCase()))
    return ['valuta "' + c + '" is geen ISO 4217-code van drie hoofdletters.'];
  return [];
}

/* SEPA is EUR, en dat is geen detail. Een betaalbestand in het SEPA-formaat met
   yen erin wordt door de bank geweigerd of -- erger -- als euro's gelezen. Deze
   functie bestaat zodat ./journaal.js kan STOPPEN in plaats van een bestand te
   maken dat er goed uitziet. */
const isSepa = (code) => String(code || '').toUpperCase() === 'EUR';

module.exports = { decimalenVan, schaalVan, toon, keurValuta, isSepa,
  NUL_DECIMALEN, DRIE_DECIMALEN, SYMBOLEN };
