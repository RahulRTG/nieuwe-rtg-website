/* De Salon toont alleen wat viraal gaat of maatschappelijk belangrijk is.

   Viraliteit meten we aan de echte betrokkenheid: likes + reacties + de
   RTG-waardering (reward). Maatschappelijk belang bepaalt een AI-oordeel; is dat
   er (nog) niet, dan valt het terug op een lichte heuristiek op de tekst, zodat
   de gate ook zonder API-sleutel werkt. Twee dingen staan hier LOS van en
   blijven altijd zichtbaar: de zakelijke partner-etalage (p.partner) en de door
   RTG uitgelichte posts (p.featured) -- die cureert RTG zelf.

   Geen "verslavende" trucs: dit is puur een kwaliteitsdrempel op het openbare
   feed, geen kunstmatige urgentie of oneindige scroll. */
const VIRAAL_DREMPEL = 120;
const BELANG = /\b(foundation|rtfoundation|liefdadig|goede?\s*doel|benefiet|donatie|inzamel|collecte|klimaat|natuur|duurzaam|gezondheid|veiligheid|gemeenschap|buurt|vrijwillig|noodhulp|ramp|herdenk|inclusie|toegankelijk|onderwijs|educatie|mensenrecht)\b/i;

function likesVan(p) { return (p.baseLikes || 0) + Object.keys(p.likedBy || {}).length; }
function reactiesVan(p) { return Array.isArray(p.comments) ? p.comments.length : 0; }
function viraalScore(p) { return likesVan(p) + reactiesVan(p) * 8 + (p.reward || 0) * 10; }
function isViraal(p) { return viraalScore(p) >= VIRAAL_DREMPEL; }

// maatschappelijk belangrijk: een gezet AI-oordeel (p.belangrijk) wint; anders
// de heuristiek op tekst + plaats
function isBelangrijk(p) {
  if (typeof p.belangrijk === 'boolean') return p.belangrijk;
  return BELANG.test(String(p.text || '') + ' ' + String(p.place || ''));
}

/* Komt deze post in De Salon van deze kijker?

   De algemene regel is de kwaliteitsdrempel: alleen wat viraal gaat of
   maatschappelijk belangrijk is, zien vreemden. Maar het blijft ook een sociaal
   netwerk: van iemand met wie je bevriend bent of die je volgt, zie je een
   bericht altijd -- ook als het (nog) niet viraal is. En ga je zelf viraal, dan
   ziet iedereen je. De kijker-afhankelijke uitzonderingen komen via een optionele
   `kijker` met twee voorspellers: volgt(p) en bevriend(p). Zonder kijker gedraagt
   de gate zich als het openbare feed (alleen viraal/belangrijk/curatie). */
function toonInSalon(p, kijker) {
  if (!p) return false;
  if (p.partner) return true;   // de zakelijke etalage staat los van de drempel
  if (p.featured) return true;  // RTG cureert: altijd zichtbaar
  if (isViraal(p) || isBelangrijk(p)) return true;              // viraal: iedereen ziet je
  if (kijker && (kijker.bevriend(p) || kijker.volgt(p))) return true; // vriend/volger: sowieso
  return false;
}

// reden voor een klein label in de UI; null = geen. Persoonlijke banden gaan
// voor op de drempel-labels: een vriend/volger zie je omdat je hem kent.
function reden(p, kijker) {
  if (!p || p.partner || p.featured) return null;
  if (kijker && kijker.bevriend(p)) return 'vriend';
  if (kijker && kijker.volgt(p)) return 'volgend';
  if (isBelangrijk(p)) return 'belangrijk';
  if (isViraal(p)) return 'viraal';
  return null;
}

/* Het AI-oordeel over maatschappelijk belang: zet p.belangrijk op de posts die
   nog geen oordeel hebben. Bewust buiten het feed-pad gehouden -- een lezer mag
   nooit op een AI-aanroep wachten -- en bewust niet op een timer: dit draait op
   een knop in de boardroom, zodat een mens de opdracht geeft en de kosten
   zichtbaar blijven. RTG cureert.

   De aanroep zelf loopt via de centrale AI-laag (../ai jaNee): daar staat het
   model en daar zit de uitwijkketen. Deze module houdt alleen het vakinhoudelijke
   deel vast: welke posts kandidaat zijn en wat we precies vragen. Geeft de AI geen
   oordeel (geen sleutel, storing, onleesbaar antwoord), dan blijft p.belangrijk
   ongezet en doet de heuristiek hierboven het werk. */
const { jaNee } = require('../ai-kort');
const BELANG_MAX = 40;   // hoogstens zoveel posts per ronde, tegen een AI-rekening die wegloopt
const BELANG_VRAAG = 'Bepaal of een korte Salon-post maatschappelijk belangrijk is (raakt de gemeenschap, gezondheid, veiligheid, natuur/klimaat, liefdadigheid, onderwijs of mensenrechten) of gewoon persoonlijk. Antwoord met exact "ja" of "nee".';

function belangKandidaten(posts) {
  if (!Array.isArray(posts)) return [];
  return posts.filter(p => p && !p.partner && !p.featured && typeof p.belangrijk !== 'boolean');
}

async function beoordeelBelang(ai, posts) {
  const uit = { bekeken: 0, gezet: 0, belangrijk: 0, wachtend: 0 };
  const kandidaten = belangKandidaten(posts);
  uit.wachtend = kandidaten.length;
  if (!ai) return uit;
  for (const p of kandidaten.slice(0, BELANG_MAX)) {
    uit.bekeken++;
    const oordeel = await jaNee(ai, BELANG_VRAAG, String(p.text || '') + ' - ' + String(p.place || ''));
    if (oordeel === null) continue;          // geen oordeel: de heuristiek doet het
    p.belangrijk = oordeel;
    uit.gezet++;
    if (oordeel) uit.belangrijk++;
  }
  uit.wachtend -= uit.gezet;
  return uit;
}

module.exports = { VIRAAL_DREMPEL, BELANG_MAX, likesVan, reactiesVan, viraalScore, isViraal, isBelangrijk,
  toonInSalon, reden, belangKandidaten, beoordeelBelang };
