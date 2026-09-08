'use strict';
/* De vertaallaag ZONDER model: een termtabel per doeltaal en het
   wereld-kernwoordenboek. Losgeknipt uit server/translate.js op de natuurlijke
   naad -- dat bestand houdt het model, de cache en de batching; dit bestand
   houdt wat er zonder sleutel mogelijk is, en dat is met opzet weinig. */
const { WORDS_NL_EN, WORDS_EN_NL, WORDS_ES } = require('./woordenboek');
/* De termtabel per DOELtaal (zonder AI-sleutel). De Spaanse tabel dekt
   Nederlands en Engels als bron; andere talen vallen zonder AI-sleutel terug
   op de oorspronkelijke tekst (nooit kapot, nooit half). */
const WORDS = { en: WORDS_NL_EN, nl: WORDS_EN_NL, es: WORDS_ES };
/* Het wereld-kernwoordenboek: 30 school-kernwoorden in ALLE registertalen. Zij
   dekken een bericht dat zelf een van die woorden is, en niets daarbuiten. */
const wereld = require('./woordenboek/wereld');

/* HET WOORDENBOEK ANTWOORDT ALLEEN OP EEN VOLLEDIGE BOODSCHAP.

   Hier stond `wordLevel`, die een zin op spaties splitste en elk woord verving
   dat toevallig in de tabel stond: "اليوم is de مدرسة gesloten" -- Nederlandse
   zinsbouw met vier omgewisselde woorden, gemeld als `translated: true`. Dat is
   slechter dan de brontaal laten staan, want het ziet eruit als een vertaling.
   Woordvolgorde, meervoud, geslacht en aanspreekvorm zitten niet in een los
   woord, dus de kleinste vertaalbare eenheid is de hele BOODSCHAP.

   Een bericht dat zelf een tabelingang IS vertaalt nog wel ("huiswerk" ->
   "Hausaufgaben"). Samenstellen uit losse termen gebeurt niet. Bewaakt door
   test/wereldtaal.test.js; zet hier nooit een splitsing op spaties terug. */
function volledigeBoodschap(text, to) {
  const dict = WORDS[to] || wereld.dictVan(to);
  if (!dict) return null;
  // leestekens aan de randen horen niet bij de term ("Welkom!"); wat ertussen
  // staat telt wel mee, dus een zin valt hier vanzelf af
  const kaal = String(text).trim().replace(/^[^\wÀ-ÿ]+/, '').replace(/[^\wÀ-ÿ]+$/, '');
  if (!kaal) return null;
  const term = dict[kaal.toLowerCase()];
  if (!term) return null;
  // alleen optillen, nooit verlagen: het Duitse zelfstandig naamwoord staat al
  // met een hoofdletter, en een schrift zonder kapitaal verandert hier niets
  const metHoofdletter = kaal[0] !== kaal[0].toLowerCase();
  return String(text).replace(kaal, metHoofdletter ? term[0].toUpperCase() + term.slice(1) : term);
}

module.exports = { volledigeBoodschap };
