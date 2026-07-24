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

/* Optioneel AI-oordeel over maatschappelijk belang. Roep dit periodiek of vanuit
   de boardroom aan; het zet p.belangrijk op de posts. Zonder anthropic doet het
   niets (de heuristiek blijft dan gelden). Bewust buiten het feed-pad gehouden:
   de feed mag nooit op een AI-aanroep wachten. */
async function beoordeelBelang(anthropic, posts, scho) {
  if (!anthropic || !Array.isArray(posts)) return 0;
  const kandidaten = posts.filter(p => p && !p.partner && !p.featured && typeof p.belangrijk !== 'boolean').slice(0, 40);
  let gezet = 0;
  for (const p of kandidaten) {
    try {
      const r = await anthropic.messages.create({
        model: 'claude-sonnet-5', max_tokens: 8,
        system: 'Bepaal of een korte Salon-post maatschappelijk belangrijk is (raakt de gemeenschap, gezondheid, veiligheid, natuur/klimaat, liefdadigheid, onderwijs of mensenrechten) of gewoon persoonlijk. Antwoord met exact "ja" of "nee".',
        messages: [{ role: 'user', content: String((p.text || '') + ' - ' + (p.place || '')).slice(0, 500) }]
      });
      const t = ((r && r.content && r.content[0] && r.content[0].text) || '').toLowerCase();
      p.belangrijk = /\bja\b/.test(t);
      gezet++;
    } catch (e) { /* laat de heuristiek het doen */ }
  }
  return gezet;
}

module.exports = { VIRAAL_DREMPEL, likesVan, reactiesVan, viraalScore, isViraal, isBelangrijk, toonInSalon, reden, beoordeelBelang };
