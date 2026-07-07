/* ============================================================================
   Vertaallaag voor de RTG-backend.

   Twee taken:
   1) localize(text, lang): vaste seed-inhoud (Nederlands als basis) omzetten
      naar de taal van de bezoeker. Werkt volledig offline via een woordenboek.
   2) translate(text, to, from): losse berichten (reacties, DM's) vertalen naar
      de taal van de ontvanger. Gebruikt de echte Claude-API als die beschikbaar
      is (ANTHROPIC_API_KEY), anders het woordenboek en een woord-voor-woord
      terugval, zodat de functie ook in demo-modus iets zinnigs teruggeeft.
   ========================================================================== */

/* Vaste seed-inhoud: Nederlands -> Engels. Deterministisch, dekt de hele
   demo-inhoud (facturen, reis, posts, reacties, menukaarten, partnerreizen). */
const NL2EN = {
  // facturen
  'Kyoto, Hoshinoya, 4 nachten': 'Kyoto, Hoshinoya, 4 nights',
  'KLM Amsterdam - Osaka, business class (2 pers.)': 'KLM Amsterdam - Osaka, business class (2 pers.)',
  'Lissabon, Palácio weekend, incl. transfers': 'Lisbon, Palácio weekend, incl. transfers',
  'Jaarbijdrage lidmaatschap 2026': 'Annual membership contribution 2026',
  'Vervalt 28 juli 2026': 'Due 28 July 2026',
  'Vervalt 15 augustus 2026': 'Due 15 August 2026',
  'Betaald op 2 mei 2026': 'Paid on 2 May 2026',
  'Betaald op 4 januari 2026': 'Paid on 4 January 2026',
  'Zojuist betaald': 'Just paid',
  // reis
  '12 - 19 oktober 2026': '12 - 19 October 2026',
  '12 okt': '12 Oct', '12-16 okt': '12-16 Oct', '14 okt': '14 Oct', '15 okt': '15 Oct', '16-19 okt': '16-19 Oct',
  'KLM KL867, Amsterdam → Osaka Kansai': 'KLM KL867, Amsterdam → Osaka Kansai',
  'Business class, 2 personen · stoelen 2A/2C': 'Business class, 2 people · seats 2A/2C',
  'Privétransfer Kansai → Hoshinoya Kyoto': 'Private transfer Kansai → Hoshinoya Kyoto',
  'Chauffeur wacht bij aankomsthal, naambord RTG': 'Driver waits in the arrivals hall, RTG name board',
  'Hoshinoya Kyoto, Riverside suite': 'Hoshinoya Kyoto, Riverside suite',
  '4 nachten, ontbijt op de kamer, late check-out': '4 nights, breakfast in the room, late check-out',
  'Privé-theeceremonie, Gion': 'Private tea ceremony, Gion',
  'Met vertaler · 2 personen · 15:00 uur': 'With interpreter · 2 people · 15:00',
  'Diner, Kikunoi Honten (3★)': 'Dinner, Kikunoi Honten (3★)',
  'Kaiseki-menu · tafel 19:30 uur': 'Kaiseki menu · table 19:30',
  'Ryokan Tawaraya, traditionele kamer': 'Ryokan Tawaraya, traditional room',
  '3 nachten, kaiseki-halfpension': '3 nights, kaiseki half board',
  // post-teksten
  'De theeceremonie die mijn concierge regelde, geen toeristen, geen haast. Dit is waarom ik niet meer zelf boek.':
    'The tea ceremony my concierge arranged, no tourists, no rush. This is why I no longer book myself.',
  'Ochtendvlucht, twee vergaderingen, om 18:00 aan het meer. De Business Pass plant de dag strakker dan mijn assistent ooit deed.':
    'Morning flight, two meetings, by the lake at 18:00. The Business Pass plans the day tighter than my assistant ever did.',
  'Voor de prijs van een gewoon hotel een palácio, via één WhatsApp-bericht. Nettoprijzen zijn geen marketing, ze bestaan echt.':
    'For the price of an ordinary hotel, a palácio, via a single WhatsApp message. Net prices aren\'t marketing, they truly exist.',
  'Layover van 9 uur omgezet in een middag Raffles + spa. De AI stelde het voor, mijn concierge bevestigde binnen 10 minuten.':
    'A 9-hour layover turned into an afternoon at Raffles + spa. The AI suggested it, my concierge confirmed within 10 minutes.',
  'Riad tegen inkoopprijs, en 30% van mijn bijdrage ging naar de RTFoundation. Reizen dat iets teruggeeft, dat deel vertel ik iedereen.':
    'A riad at wholesale price, and 30% of my contribution went to the RTFoundation. Travel that gives back, that part I tell everyone.',
  // reacties (seed)
  'Staat genoteerd voor november. Dank.': 'Noted for November. Thank you.',
  'Welk palácio was dit? Sta op het punt te boeken!': 'Which palácio was this? I am about to book!',
  'Sophie, dit wil ik in november zien, welke wijk was dit?': 'Sophie, I want to see this in November, which district was this?',
  // menu, Kikunoi
  'Hassun, seizoensvoorgerecht': 'Hassun, seasonal starter',
  'Acht kleine gerechten die het seizoen vieren.': 'Eight small dishes celebrating the season.',
  'Mukozuke, sashimi': 'Mukozuke, sashimi',
  'Dagverse vangst, gesneden aan tafel.': 'Catch of the day, sliced at the table.',
  'Wagyu-hoofdgerecht': 'Wagyu main course',
  'A5 wagyu, licht gegrild, met seizoensgroenten.': 'A5 wagyu, lightly grilled, with seasonal vegetables.',
  'Matcha & wagashi': 'Matcha & wagashi',
  'Ceremoniële matcha met huisgemaakte wagashi.': 'Ceremonial matcha with house-made wagashi.',
  'Kaiseki': 'Kaiseki', 'Zoet': 'Sweet',
  // menu, Pontocho
  'Yuzu Highball': 'Yuzu Highball', 'Japanse whisky, yuzu, bruisend.': 'Japanese whisky, yuzu, sparkling.',
  'Umeshu Sour': 'Umeshu Sour', 'Pruimenlikeur, citroen, eiwit.': 'Plum liqueur, lemon, egg white.',
  'Sakura Spritz (0%)': 'Sakura Spritz (0%)', 'Kersenbloesem, tonic, geen alcohol.': 'Cherry blossom, tonic, no alcohol.',
  'Edamame & nori': 'Edamame & nori', 'Gestoomde edamame met zeezout.': 'Steamed edamame with sea salt.',
  'Signatuur': 'Signature', 'Alcoholvrij': 'Non-alcoholic', 'Hapjes': 'Bites',
  // partnerreizen
  'Kyoto in herfstkleur': 'Kyoto in autumn colour', '8 dagen · oktober 2026': '8 days · October 2026',
  'Hoshinoya aan de rivier, privé-theeceremonie in Gion en de esdoorns van Arashiyama vóór de drukte.':
    'Hoshinoya by the river, a private tea ceremony in Gion and the maples of Arashiyama before the crowds.',
  'Palácio-weekend Lissabon': 'Palácio weekend Lisbon', '4 dagen · doorlopend': '4 days · year-round',
  'Een palácio voor de prijs van een gewoon hotel, hetzelfde adres waar onze leden over posten in De Salon.':
    'A palácio for the price of an ordinary hotel, the same address our members post about in The Salon.',
  'Riad & woestijn Marrakech': 'Riad & desert Marrakech', '5 dagen · doorlopend': '5 days · year-round',
  'Een riad in de medina, hammam en een avond in de Agafay-woestijn, ingekocht zoals wij dat voor leden doen.':
    'A riad in the medina, a hammam and an evening in the Agafay desert, bought the way we do for members.',
  'Vlucht business class': 'Business class flight', 'Hoshinoya Kyoto, 4 nachten': 'Hoshinoya Kyoto, 4 nights',
  'Ryokan Tawaraya, 3 nachten': 'Ryokan Tawaraya, 3 nights', 'Privétransfers & theeceremonie': 'Private transfers & tea ceremony',
  'Vlucht & transfers': 'Flight & transfers', 'Palácio-suite, 3 nachten': 'Palácio suite, 3 nights',
  'Ontbijt & late check-out': 'Breakfast & late check-out', 'Tafelreservering fado-avond': 'Table reservation, fado evening',
  'Vlucht & privétransfers': 'Flight & private transfers', 'Riad, 4 nachten': 'Riad, 4 nights',
  'Hammam & diner in de Agafay': 'Hammam & dinner in the Agafay', 'Gids door de souks': 'Guide through the souks',
  // locatielabels
  'Arashiyama, Kyoto': 'Arashiyama, Kyoto', 'Higashiyama, Kyoto': 'Higashiyama, Kyoto',
  'Pontocho-steeg, Kyoto': 'Pontocho alley, Kyoto', 'Kyoto Station': 'Kyoto Station',
  'Schiphol Business Aviation': 'Schiphol Business Aviation', 'Live positie': 'Live position'
};

/* Veelgebruikte woorden voor de woord-voor-woord terugval (demo zonder API).
   Niet perfect, maar geeft de ontvanger een leesbaar idee in zijn eigen taal. */
const WORDS_NL_EN = {
  'hallo':'hello','hoi':'hi','dank':'thanks','dankjewel':'thank you','bedankt':'thanks','alsjeblieft':'please',
  'ja':'yes','nee':'no','graag':'gladly','mooi':'beautiful','prachtig':'gorgeous','geweldig':'great',
  'reis':'trip','reizen':'travel','hotel':'hotel','kamer':'room','diner':'dinner','lunch':'lunch','ontbijt':'breakfast',
  'wanneer':'when','waar':'where','hoe':'how','welk':'which','welke':'which','wat':'what','wie':'who',
  'boeken':'to book','geboekt':'booked','prijs':'price','korting':'discount','betalen':'to pay','betaald':'paid',
  'ik':'I','je':'you','jij':'you','u':'you','wij':'we','met':'with','voor':'for','naar':'to','van':'from','in':'in','op':'on',
  'en':'and','of':'or','niet':'not','ook':'also','heel':'very','erg':'very','goed':'good','leuk':'nice','stad':'city',
  'strand':'beach','zon':'sun','weer':'weather','vraag':'question','antwoord':'answer','bericht':'message','groeten':'regards',
  'zie':'see','ik zie':'I see','morgen':'tomorrow','vandaag':'today','avond':'evening','ochtend':'morning',
  'restaurant':'restaurant','tafel':'table','fles':'bottle','wijn':'wine','koffie':'coffee','thee':'tea',
  'is':'is','ben':'am','was':'was','zijn':'are','heb':'have','heeft':'has','kan':'can','kunnen':'can','wil':'want','willen':'want'
};
const WORDS_EN_NL = Object.fromEntries(Object.entries(WORDS_NL_EN).map(([k, v]) => [v, k]));

const EN2NL = {};
for (const [nl, en] of Object.entries(NL2EN)) if (!(en in EN2NL)) EN2NL[en] = nl;

let anthropic = null;
function setAnthropic(a) { anthropic = a; }

const cache = new Map();

/* Ruwe taalherkenning voor het geval de bron-taal niet is meegegeven. */
function detect(text) {
  const t = ' ' + String(text).toLowerCase() + ' ';
  const nl = [' de ', ' het ', ' een ', ' ik ', ' je ', ' en ', ' niet ', ' met ', ' voor ', ' zijn ', ' dat ', ' dit ', ' uw '];
  const en = [' the ', ' a ', ' is ', ' i ', ' you ', ' and ', ' not ', ' with ', ' for ', ' this ', ' that ', ' are ', ' of '];
  const score = arr => arr.reduce((n, w) => n + (t.includes(w) ? 1 : 0), 0);
  return score(en) > score(nl) ? 'en' : 'nl';
}

/* Vaste seed-inhoud omzetten naar de bezoekerstaal (alleen NL -> EN). */
function localize(text, lang) {
  if (lang !== 'en' || text == null) return text;
  return NL2EN[text] || text;
}
function localizeList(list, lang) {
  return Array.isArray(list) ? list.map(x => localize(x, lang)) : list;
}

function wordLevel(text, to) {
  const dict = to === 'en' ? WORDS_NL_EN : WORDS_EN_NL;
  let hit = false;
  const out = String(text).split(/(\s+)/).map(tok => {
    const m = tok.match(/^([\wÀ-ÿ']+)(.*)$/);
    if (!m) return tok;
    const w = m[1].toLowerCase();
    if (dict[w]) { hit = true; const r = dict[w]; return (m[1][0] === m[1][0].toUpperCase() ? r[0].toUpperCase() + r.slice(1) : r) + m[2]; }
    return tok;
  }).join('');
  return hit ? out : null;
}

async function claudeTranslate(text, to) {
  const target = to === 'en' ? 'English' : 'Dutch';
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 600,
    system: 'You are a translation engine for a luxury travel club. Translate the user message into ' + target +
      '. Keep the tone natural and courteous. Preserve names, places and emoji. Reply with ONLY the translation, no quotes, no notes.',
    messages: [{ role: 'user', content: String(text).slice(0, 1500) }]
  });
  return response.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
}

/* Vertaal een los bericht naar de taal van de ontvanger. */
async function translate(text, to, from) {
  text = String(text || '');
  to = to === 'en' ? 'en' : 'nl';
  if (!text.trim()) return { text, translated: false, from: from || to };
  from = (from === 'en' || from === 'nl') ? from : detect(text);
  if (from === to) return { text, translated: false, from };

  const key = to + '|' + text;
  if (cache.has(key)) return { text: cache.get(key), translated: cache.get(key) !== text, from };

  let out = to === 'en' ? NL2EN[text] : EN2NL[text];
  if (!out && anthropic) { try { out = await claudeTranslate(text, to); } catch (e) { /* val terug */ } }
  if (!out) out = wordLevel(text, to);
  const result = out || text;
  cache.set(key, result);
  return { text: result, translated: result !== text, from };
}

module.exports = { setAnthropic, localize, localizeList, translate, detect };
