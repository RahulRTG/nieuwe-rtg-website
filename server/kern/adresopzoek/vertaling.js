/* Adresopzoek (deelmodule): de VERTALING. Wat er de deur uit gaat en wat er
   terugkomt -- verder niets. Geen net, geen cache, geen rem, geen klok: alles
   hier is een functie van zijn invoer, en dat is precies waarom het een eigen
   bestand is. De opzoeker zelf (cache, bronbudget, meldingen) staat in
   ../adresopzoek.js.

   WAT ER DE DEUR UIT GAAT, EN NIETS ANDERS: de postcode en het huisnummer. Geen
   naam, e-mailadres, lidnummer, codenaam, token of sessiesleutel. Dat is de hele
   reden dat deze vraag naar een derde partij mag: bij het Kadaster komt een
   vraag binnen die van iedereen kan zijn, en het antwoord staat in elke
   brievenbus. Die vraag ontstaat op precies EEN plek -- bouwVraag() -- zodat er
   ook maar een plek na te kijken is als iemand er ooit iets aan wil toevoegen.
   Doe dat niet.

   EN LET OP DE ZOEKMACHINE, WANT DAAR ZIT DE VAL. De free-ingang van PDOK is
   FUZZY: hij geeft altijd zijn beste treffer, ook als die nergens op slaat.
   Nagemeten op 2026-08-05 met echte aanroepen: "9999ZZ 1" (bestaat niet) gaf
   "1 juli-weg 1G-01, Maastricht", zonder postcode in het antwoord, en "2611HB
   250" (dat huisnummer bestaat daar niet) gaf huisnummer 169. Daarom vergelijkt
   leesAntwoord() de teruggegeven postcode EN het huisnummer met wat er gevraagd
   is: een verkeerd adres dat er zeker uitziet is erger dan een leeg veld. */
'use strict';

const BASIS = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/free';
const NL_POSTCODE = /^[1-9][0-9]{3}[A-Z]{2}$/;

/* De zinnen bij de redenen. Ze staan hier en niet in de route, zodat elk kanaal
   (het gesprek van Rahul, een scherm) hetzelfde zegt. */
const TEKSTEN = {
  onvolledig: 'Ik heb een postcode en een huisnummer nodig.',
  buitenland: 'Deze opzoeker kent alleen Nederlandse postcodes. Vul je adres met de hand in.',
  onbekend: 'Dit adres vind ik niet. Vul het met de hand in.',
  onbereikbaar: 'De adressenbron antwoordt nu niet. Vul je adres met de hand in.',
  druk: 'Het is nu te druk bij de adressenbron. Vul je adres met de hand in.',
  uit: 'De adresopzoeker staat uit. Vul je adres met de hand in.'
};

/* De velden die een antwoord mag dragen. Wat hier niet staat, gaat de deur niet
   uit: `uitCache` deed dat wel, en daarmee kon lid B aftasten of lid A een
   concreet adres had opgezocht. In een huis dat op codenamen draait is dat een
   lek, en de goedkoopste garantie is dat zulke velden er niet doorheen komen. */
const NAAR_BUITEN = ['gevonden', 'straat', 'huisnummer', 'postcode', 'woonplaats', 'land', 'reden', 'tekst'];

/* 1234AB, 1234 ab, 1234-AB: alle drie dezelfde postcode. Wat er niet op lijkt
   is geen tikfout maar een ander land, en dat is een eigen antwoord. */
function normaliseerPostcode(ruw) {
  const s = String(ruw == null ? '' : ruw).replace(/[\s.-]+/g, '').toUpperCase().slice(0, 12);
  if (!s) return { ok: false, reden: 'onvolledig' };
  if (!NL_POSTCODE.test(s)) return { ok: false, reden: 'buitenland' };
  return { ok: true, postcode: s };
}

/* "12", "12A", "12 bis": het getal telt, de toevoeging gaat mee in de vraag maar
   niet in de controle -- zie leesAntwoord(). */
function normaliseerHuisnummer(ruw) {
  const m = String(ruw == null ? '' : ruw).trim().slice(0, 12).match(/^(\d{1,5})\s*(.*)$/);
  if (!m || !Number(m[1])) return { ok: false, reden: 'onvolledig' };
  const nummer = Number(m[1]);
  const toevoeging = m[2].replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6);
  return { ok: true, nummer, toevoeging, tekst: nummer + (toevoeging ? ' ' + toevoeging : '') };
}

/* De enige plek waar een uitgaande URL ontstaat. Er gaan twee dingen in en er
   staat niets anders in de vraag; wie hier een derde parameter bij zet, breekt
   de belofte in de kop van dit bestand. */
function bouwVraag(basis, postcode, huisnummerTekst) {
  return (basis || BASIS)
    + '?q=' + encodeURIComponent(postcode + ' ' + huisnummerTekst)
    + '&fq=' + encodeURIComponent('type:adres') + '&rows=1';
}

/* Het PDOK-antwoord naar onze velden, met de fuzzy-controle uit de kop.
   `bronVreemd` is een INTERN signaal en gaat nooit mee naar buiten: er kwam wel
   een adres terug, maar zonder de velden waar wij op rekenen. Dat is niet "adres
   onbekend" maar "de bron ziet er anders uit dan wij denken", en dat hoort
   gemeld te worden in plaats van stil verzwegen. */
function leesAntwoord(json, gevraagd) {
  const docs = json && json.response && Array.isArray(json.response.docs) ? json.response.docs : [];
  const d = docs[0];
  if (!d) return { gevonden: false, reden: 'onbekend' };
  const straat = String(d.straatnaam || '').trim();
  const woonplaats = String(d.woonplaatsnaam || '').trim();
  const postcode = String(d.postcode || '').replace(/\s+/g, '').toUpperCase();
  if (!straat || !woonplaats) return { gevonden: false, reden: 'onbekend', bronVreemd: true };
  if (postcode !== gevraagd.postcode) return { gevonden: false, reden: 'onbekend' };
  if (Number(d.huisnummer) !== gevraagd.nummer) return { gevonden: false, reden: 'onbekend' };
  return { gevonden: true, straat, woonplaats, land: 'NL', postcode, huisnummer: gevraagd.nummer };
}

module.exports = { BASIS, TEKSTEN, NAAR_BUITEN, normaliseerPostcode, normaliseerHuisnummer, bouwVraag, leesAntwoord };
