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

/* De woordenboeken (seed-inhoud en woord-voor-woord terugval) staan als
   pure data in een deelmodule. */
const { NL2EN, WORDS_NL_EN, WORDS_EN_NL, EN2NL, WORDS_ES } = require('./translate/woordenboek');
/* De woord-voor-woord terugval per DOELtaal (demo zonder AI-sleutel). De
   Spaanse tabel dekt Nederlands en Engels als bron; andere talen vallen
   zonder AI-sleutel terug op de oorspronkelijke tekst (nooit kapot). */
const WORDS = { en: WORDS_NL_EN, nl: WORDS_EN_NL, es: WORDS_ES };

let anthropic = null;
function setAnthropic(a) { anthropic = a; }

/* Vertaal-cache met een vaste bovengrens: bij een hit schuift de sleutel naar
   achteren (LRU), boven de grens valt de oudste eruit. Zonder grens groeit de
   Map met elke unieke (taal, tekst)-combinatie mee en lekt de server geheugen
   onder vuur van willekeurige teksten. */
const cache = new Map();
const CACHE_MAX = 5000;

/* Ruwe taalherkenning voor het geval de bron-taal niet is meegegeven. */
function detect(text) {
  const t = ' ' + String(text).toLowerCase() + ' ';
  const nl = [' de ', ' het ', ' een ', ' ik ', ' je ', ' en ', ' niet ', ' met ', ' voor ', ' zijn ', ' dat ', ' dit ', ' uw '];
  const en = [' the ', ' a ', ' is ', ' i ', ' you ', ' and ', ' not ', ' with ', ' for ', ' this ', ' that ', ' are ', ' of '];
  const score = arr => arr.reduce((n, w) => n + (t.includes(w) ? 1 : 0), 0);
  return score(en) > score(nl) ? 'en' : 'nl';
}

/* Vaste seed-inhoud omzetten naar de bezoekerstaal. Het woordenboek is NL -> EN;
   voor elke andere taal dan Nederlands tonen we de Engelse versie (de
   internationale terugval; losse berichten worden wel echt vertaald). */
function localize(text, lang) {
  if (!lang || lang === 'nl' || text == null) return text;
  return NL2EN[text] || text;
}
function localizeList(list, lang) {
  return Array.isArray(list) ? list.map(x => localize(x, lang)) : list;
}

function wordLevel(text, to) {
  const dict = WORDS[to];
  if (!dict) return null;
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

const { naamEn, bestaat } = require('./talen');

async function claudeTranslate(text, to) {
  const target = to === 'nl' ? 'Dutch' : naamEn(to);
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 600,
    system: 'You are a translation engine for a luxury travel club. Translate the user message into ' + target +
      '. Keep the tone natural and courteous. Preserve names, places and emoji. Reply with ONLY the translation, no quotes, no notes.',
    messages: [{ role: 'user', content: String(text).slice(0, 1500) }]
  });
  return response.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
}

/* Vertaal een los bericht naar de taal van de ontvanger. Elke taal uit het
   wereldtalenregister (server/talen.js) mag als doel; welke talen AANstaan
   bewaakt de aanroeper (talen.taalVan). Voor nl/en werkt het woordenboek ook
   zonder AI; voor andere talen vertaalt de AI, en zonder AI-sleutel komt het
   bericht onvertaald terug (translated:false), nooit kapot. */
async function translate(text, to, from) {
  text = String(text || '');
  to = bestaat(to) ? String(to).toLowerCase() : 'nl';
  if (!text.trim()) return { text, translated: false, from: from || to };
  from = bestaat(from) ? String(from).toLowerCase() : detect(text);
  if (from === to) return { text, translated: false, from };

  const key = to + '|' + text;
  if (cache.has(key)) {
    const hit = cache.get(key);
    cache.delete(key); cache.set(key, hit); // vers gebruikt: naar achteren
    return { text: hit, translated: hit !== text, from };
  }

  let out = to === 'en' ? NL2EN[text] : (to === 'nl' ? EN2NL[text] : null);
  if (!out && anthropic) { try { out = await claudeTranslate(text, to); } catch (e) { /* val terug */ } }
  if (!out && WORDS[to]) out = wordLevel(text, to);
  const result = out || text;
  cache.set(key, result);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
  return { text: result, translated: result !== text, from };
}

module.exports = { setAnthropic, localize, localizeList, translate, detect };

