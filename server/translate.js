/* ============================================================================
   Vertaallaag voor de RTG-backend.

   Twee taken:
   1) localize(text, lang): vaste seed-inhoud (Nederlands als basis) omzetten
      naar de taal van de bezoeker. Werkt volledig offline via een woordenboek.
   2) translate(text, to, from): losse berichten (reacties, DM's) vertalen naar
      de taal van de ontvanger. Gebruikt de echte Claude-API als die beschikbaar
      is (lokaal of extern), anders een woordenboek dat alleen antwoordt op een
      bericht dat het HELEMAAL dekt. Is dat er niet, dan komt de brontaal terug
      met translated:false -- nooit een half vertaalde zin.
   ========================================================================== */

/* De woordenboeken (seed-inhoud en volledige-boodschaptabellen) staan als
   pure data in een deelmodule. */
const { NL2EN, EN2NL } = require('./translate/woordenboek');
/* De termtabellen en het wereld-kernwoordenboek wonen in ./translate/boodschap:
   dat is de laag ZONDER model, en zij antwoordt alleen op een hele boodschap. */
const { volledigeBoodschap } = require('./translate/boodschap');

let anthropic = null;
function setAnthropic(a) { anthropic = a; }

/* De cache staat in ./translate/cache.js: twee lagen met verschillende
   levensduur (een begrensd geheugen voor losse berichten, en de kast op schijf
   voor vertaalde interface). Zie de kop daar voor waarom ze niet hetzelfde zijn
   en waarom een kasttreffer niet naar het geheugen klimt. */
const { setVertaalkast, cacheLees, cacheSchrijf, kastLees, kastSchrijf } = require('./translate/cache');

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

const { naamEn, bestaat } = require('./talen');
const vertaalModelBatch = require('./translate/batch-model');
/* De keuring staat TUSSEN het model en alles wat blijft; ./translate/uitslag.js
   kiest daarmee welke bron wint. Zie kern/taalkeuring.js voor waarom er drie
   uitkomsten zijn en niet twee. */
const { beslis } = require('./translate/uitslag');

async function claudeTranslate(text, to) {
  const target = to === 'nl' ? 'Dutch' : naamEn(to);
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 600,
    system: 'You are a translation engine for a luxury travel club. Translate the user message into ' + target +
      '. Keep the tone natural and courteous. Preserve names, places and emoji. Reply with ONLY the translation, no quotes, no notes.',
    messages: [{ role: 'user', content: String(text).slice(0, 1500) }]
  });
  return response.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
}

/* Vertaal een los bericht naar de taal van de ontvanger. Elke taal uit het
   wereldtalenregister (server/talen.js) mag als doel; welke talen AANstaan
   bewaakt de aanroeper (talen.taalVan). Een bericht dat zelf een woordenboekterm
   is werkt zonder AI; al het andere vertaalt de AI, en zonder AI-sleutel komt
   het bericht onvertaald terug (translated:false), nooit kapot en nooit half. */
async function translate(text, to, from, opties) {
  text = String(text || '');
  to = bestaat(to) ? String(to).toLowerCase() : 'nl';
  if (!text.trim()) return { text, translated: false, from: from || to };
  from = bestaat(from) ? String(from).toLowerCase() : detect(text);
  if (from === to) return { text, translated: false, from };

  const key = to + '|' + text;
  const hit = cacheLees(key);
  if (hit != null) return { text: hit, translated: hit !== text, from };

  let out = to === 'en' ? NL2EN[text] : (to === 'nl' ? EN2NL[text] : null);
  /* De AI-weg alleen voor wie we kennen. Zonder deze grens is een open
     vertaal-endpoint een gratis doorgeefluik naar een betaalde aanbieder: geen
     inlog, geen kosten voor de aanvrager, en elke ingetypte zin gaat naar een
     derde partij (vaak buiten de EU) zonder dat daar een lid tegenover staat.
     Het woordenboek hieronder blijft voor iedereen werken, dus de taalkiezer op
     het inlogscherm doet het gewoon. */
  const magAi = !opties || opties.ai !== false;
  if (!out && anthropic && magAi) { try { out = await claudeTranslate(text, to); } catch (e) { /* val terug */ } }
  if (!out) out = volledigeBoodschap(text, to); // alleen als het woordenboek het HELE bericht dekt
  const result = out || text;
  cacheSchrijf(key, result);
  return { text: result, translated: result !== text, from };
}

/* Dezelfde vertaallogica voor een schermwoordenboek, maar met echte batching.
   Hoogstens 40 regels / 6000 tekens gaan in één modelaanroep. Alles daarbuiten
   wordt in een volgende begrensde groep verwerkt. Een mislukte groep valt per
   regel terug op het woordenboek waar dat de hele regel dekt, en anders op de
   brontaal -- de interface verdwijnt nooit en raakt nooit half vertaald. */
async function translateBatch(teksten, to, from, opties) {
  teksten = Array.isArray(teksten) ? teksten.map(t => String(t == null ? '' : t)) : [];
  to = bestaat(to) ? String(to).toLowerCase() : 'nl';
  const magAiVoor = typeof (opties && opties.ai) === 'function'
    ? opties.ai : () => (!opties || opties.ai !== false);
  /* De kast bewaart alleen wat de aanroeper AANWIJST als interface. Standaard
     dus niet: een nieuwe aanroeper krijgt nooit stilzwijgend een schijflog. */
  const bewaarMag = !!(opties && opties.bewaar);
  const uit = new Array(teksten.length);
  const wacht = [];
  /* Wat de keuring deze ronde tegenhield. De aanroeper krijgt dit mee, zodat
     een stille afwijzing niet stil blijft. */
  const gekeurd = { goed: 0, verdacht: 0, afgewezen: 0 };

  for (let i = 0; i < teksten.length; i++) {
    const text = teksten[i];
    const bron = bestaat(from) ? String(from).toLowerCase() : detect(text);
    if (!text.trim() || bron === to) {
      uit[i] = { text, translated: false, from: bron };
      continue;
    }
    const key = to + '|' + text;
    const hit = cacheLees(key);
    if (hit != null) {
      uit[i] = { text: hit, translated: hit !== text, from: bron };
      continue;
    }
    const uitKast = kastLees(bewaarMag, to, text);
    if (uitKast != null) {
      uit[i] = { text: uitKast, translated: uitKast !== text, from: bron };
      continue;
    }
    let vast = to === 'en' ? NL2EN[text] : (to === 'nl' ? EN2NL[text] : null);
    if (vast) {
      cacheSchrijf(key, vast);
      uit[i] = { text: vast, translated: vast !== text, from: bron };
    } else wacht.push({ i, text, bron, key, ai: !!magAiVoor(text) });
  }

  /* Eerst de toegestane modelregels bij elkaar, daarna de lokale regels. Een
     gemengde invoerlijst kan zo nooit per ongeluk een privéreeks meenemen in
     dezelfde provider-aanroep, en kost ook geen losse aanroep per afwisseling. */
  for (const reeks of [wacht.filter(x => x.ai), wacht.filter(x => !x.ai)]) {
    for (let vanaf = 0; vanaf < reeks.length;) {
      const groep = [];
      let tekens = 0;
      while (vanaf < reeks.length && groep.length < 40) {
        const volgende = reeks[vanaf];
        if (groep.length && tekens + volgende.text.length > 6000) break;
        groep.push(volgende); tekens += volgende.text.length; vanaf++;
      }
      let model = null;
      if (anthropic && groep[0] && groep[0].ai) {
        try { model = await vertaalModelBatch({ anthropic, teksten: groep.map(x => x.text), to, naamEn }); }
        catch (e) { model = null; }
      }
      groep.forEach((item, j) => {
        /* Welke bron wint, en mag zij blijven: ./translate/uitslag.js. */
        const { tekst, magBewaren } = beslis({
          bron: item.text, modelRegel: model ? model[j] : null,
          lokaal: volledigeBoodschap(item.text, to), naar: to, tel: gekeurd
        });
        /* Een tijdelijke modelstoring mag geen onvertaalde zin als blijvend
           cacheantwoord vastzetten. Alleen echte vertaling is een cache-hit. */
        if (tekst !== item.text) {
          cacheSchrijf(item.key, tekst);
          if (magBewaren) kastSchrijf(bewaarMag && item.ai, to, item.text, tekst);
        }
        uit[item.i] = { text: tekst, translated: tekst !== item.text, from: item.bron };
      });
    }
  }
  uit.keuring = gekeurd;
  return uit;
}

module.exports = { setAnthropic, setVertaalkast, localize, localizeList, translate, translateBatch, detect };
