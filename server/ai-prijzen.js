/* DE PRIJZEN VAN DE MODELKRAAN: wat een token kost, per model en per soort.
   Afgesplitst uit ./ai-meter.js, die telt wat er vandaag omging; dit bestand
   zegt alleen wat dat waard is. Zie de kop van ./ai-meter.js voor waarom de
   prijzen een tabel zijn en geen waarheid. */
'use strict';

/* Prijzen per miljoen tokens, in dollar. Peildatum 2026-08-19.
   Te overschrijven met RTG_AI_PRIJZEN (JSON), zodat een prijswijziging geen
   codewijziging hoeft te zijn. */
const PRIJZEN_PEILDATUM = '2026-08-19';
const PRIJZEN = {
  'claude-opus-5': { in: 5, uit: 25 },
  'claude-opus-4-8': { in: 5, uit: 25 },
  'claude-opus-4-7': { in: 5, uit: 25 },
  'claude-opus-4-6': { in: 5, uit: 25 },
  'claude-fable-5': { in: 10, uit: 50 },
  'claude-sonnet-5': { in: 3, uit: 15 },
  'claude-sonnet-4-6': { in: 3, uit: 15 },
  'claude-haiku-4-5': { in: 1, uit: 5 },
  'claude-haiku-4-5-20251001': { in: 1, uit: 5 }
};
/* Het duurste dat we kennen: het tarief voor een model dat niet in de tabel
   staat. Zo leidt een nieuw of onbekend model nooit tot een te lage schatting. */
const ONBEKEND = { in: 10, uit: 50 };

/* Een cache-LEESBEURT kost een tiende van de invoerprijs, een cache-SCHRIJF
   1,25x. Dat verschil is de hele reden dat verrijkMetCache in ./anthropic.js
   bestaat, dus de meter hoort het ook te kennen -- anders lijkt caching duurder
   dan het is en gaat iemand hem uitzetten. */
const CACHE_LEES = 0.1;
const CACHE_SCHRIJF = 1.25;

function tabel() {
  if (!process.env.RTG_AI_PRIJZEN) return PRIJZEN;
  try { return Object.assign({}, PRIJZEN, JSON.parse(process.env.RTG_AI_PRIJZEN)); }
  catch (e) { return PRIJZEN; }
}

/* Wat kost dit antwoord. Alle vier de soorten tokens apart, want ze hebben
   alle vier een andere prijs. */
/* Het tarief van een model. Een aanbieder geeft soms een gedateerde naam terug
   (`claude-sonnet-5-20260101`); die hoort bij `claude-sonnet-5`, dus valt een
   exacte treffer weg dan geldt de langste naam uit de tabel waar hij mee begint
   -- met een streepje erachter, zodat `claude-opus-5` nooit `claude-opus-50`
   vangt. Niets gevonden: het duurste dat we kennen. */
function tariefVan(model) {
  const t = tabel(), m = String(model || '');
  if (t[m]) return t[m];
  let beste = null;
  for (const k of Object.keys(t)) if (m.startsWith(k + '-') && (!beste || k.length > beste.length)) beste = k;
  return beste ? t[beste] : ONBEKEND;
}

/* De invoer in VOLLE-invoertokens: gewone invoer telt een, een cache-leesbeurt
   een tiende, een cache-schrijfbeurt 1,25. Voor een teller die één tarief per
   token kent (kern/kosten, soort ai-invoer) is dit het getal dat met dat tarief
   de juiste prijs geeft. */
function gewogenInvoer(usage) {
  const u = usage || {};
  return (Number(u.input_tokens) || 0) + (Number(u.cache_read_input_tokens) || 0) * CACHE_LEES +
    (Number(u.cache_creation_input_tokens) || 0) * CACHE_SCHRIJF;
}

function kostenVan(model, usage) {
  const p = tariefVan(model);
  const u = usage || {};
  const inv = Number(u.input_tokens) || 0;
  const uit = Number(u.output_tokens) || 0;
  const lees = Number(u.cache_read_input_tokens) || 0;
  const schrijf = Number(u.cache_creation_input_tokens) || 0;
  return ((inv * p.in) + (lees * p.in * CACHE_LEES) + (schrijf * p.in * CACHE_SCHRIJF) + (uit * p.uit)) / 1e6;
}

/* Welk model werd er geleverd (server/ai.js). Het antwoord zegt het zelf
   (`model`); zegt het niets, dan is alleen bij Claude het gevraagde model ook
   het geleverde. Bij een andere aanbieder is de gevraagde naam een Claude-naam
   die daar nooit draaide, en dan boeken we de aanbieder -- die staat niet in de
   tabel en telt dus duur (ARBEID.md par. 4 punt 12). */
function geleverdModel(aanbieder, params, uit) {
  if (uit && typeof uit.model === 'string' && uit.model) return uit.model;
  if (aanbieder && aanbieder.naam === 'claude') return params && params.model;
  return 'onbekend:' + ((aanbieder && aanbieder.naam) || 'aanbieder');
}

module.exports = { PRIJZEN, PRIJZEN_PEILDATUM, ONBEKEND, CACHE_LEES, CACHE_SCHRIJF, tabel, tariefVan,
  gewogenInvoer, kostenVan, geleverdModel };
