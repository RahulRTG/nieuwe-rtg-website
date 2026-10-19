/* ============================================================================
   DE WANDKLOK VAN DE CONTAINER -- de telling achter keuringsregel 77.

   De server draait in productie in een UTC-container. `Date#getHours()`,
   `getDay()`, `getDate()`, `getMonth()`, `getFullYear()`, `getMinutes()` en
   hun `set`-broers lezen en schrijven de zone van het PROCES, dus daar UTC.
   Op 19 oktober 2026 stonden ze op 124 regels in server/: de cockpitgroet zei om 19:00
   in Amsterdam "Goedemiddag", een leeftijd sprong pas om twee uur 's nachts
   om, een happy hour van 17:00 begon om 19:00. Ze zijn allemaal omgezet naar
   server/kern/tijdzone.js (de zone van het lid, de zaak of het huis) of naar
   de UTC-vorm (`getUTCMonth()`) waar het om rekenen met een duur ging.

   TWEE TELLINGEN.

   1. `wandklok(root)` -- de lokale getters en setters. Doel nul, harde grens:
      wie de klok van de wand wil, vraagt kern/tijdzone.js welke wand. Een
      uitzondering kan, met `tijd-uitzondering: <reden>` op de regel zelf of
      de regel erboven -- een reden en geen vinkje.

   2. `utcVandaag(root)` -- "vandaag" als `new Date().toISOString().slice(0, 10)`.
      Dat is de UTC-datum, en tussen 22:00/23:00 en middernacht is dat in
      Amsterdam al morgen. Het waren er 161. Omgezet zijn de plekken waar
      "vandaag" alleen een kalenderdatum van een lid of zaak raakt (agenda,
      boekingen, tickets, verhuur, standaarddatums, bestandsnamen), en waar het
      met een opgeslagen tijdstip werd vergeleken, ook die kant (`datumVan`).
      De rest is per domein werk, want veel van die datums worden VERGELEKEN met
      datums die op dezelfde UTC-manier uit een opgeslagen `at` zijn geknipt: een
      kant omzetten zonder de andere maakt het erger. De levens-, geld- en
      sociale graaf met de levenslijn zijn als een stelsel omgezet: hun
      `vandaag` en `dagVan` wonen in levensgraaf/hulp.js en lezen het huis.
      De kassadag rekent met de omzetdag tot 05:00 (tijdzone.omzetdag,
      eigenaarsbesluit, HORECA.md). Nog niet: de backoffice-dashboards.
      Daarom een ratel en geen grens: alleen omlaag.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const WANDKLOK = /\.(?:set|get)(?:FullYear|Month|Date|Day|Hours|Minutes)\(|\.to(?:Time|Date)String\(|\.getTimezoneOffset\(/;
const UTC_VANDAAG = /(?:new Date\(\)|datum\(\)|new Date\(Date\.now\(\)\)|new Date\(nu\(\)\))\.toISOString\(\)\.slice\(0, ?10\)/g;
const UITZONDERING = /tijd-uitzondering:\s*\S.{8,}/;
// de plek waar de wandklok WOONT
const THUIS = 'server/kern/tijdzone.js';
// het plafond van de tweede telling; alleen omlaag
const UTC_VANDAAG_MAX = 106;

function bestanden(root) {
  const uit = [];
  (function loop(dir) {
    for (const naam of fs.readdirSync(dir)) {
      if (naam === 'node_modules' || naam === 'data') continue;
      const vol = path.join(dir, naam);
      const st = fs.statSync(vol);
      if (st.isDirectory()) loop(vol);
      else if (naam.endsWith('.js')) uit.push(vol);
    }
  })(path.join(root, 'server'));
  return uit.sort();
}

const isCommentaar = (r) => /^\s*(?:\/\/|\/\*|\*)/.test(r);
const rel = (root, f) => path.relative(root, f).split(path.sep).join('/');

/* Elke lokale getter of setter buiten kern/tijdzone.js, als `bestand:regel`. */
function wandklok(root) {
  const uit = [];
  for (const f of bestanden(root)) {
    const r = rel(root, f);
    if (r === THUIS) continue;
    const regels = fs.readFileSync(f, 'utf8').split('\n');
    regels.forEach((regel, i) => {
      if (isCommentaar(regel) || !WANDKLOK.test(regel)) return;
      if (UITZONDERING.test(regel) || UITZONDERING.test(regels[i - 1] || '')) return;
      uit.push(r + ':' + (i + 1));
    });
  }
  return uit;
}

/* Hoe vaak "vandaag" nog de UTC-datum is. */
function utcVandaag(root) {
  let n = 0;
  for (const f of bestanden(root)) {
    for (const regel of fs.readFileSync(f, 'utf8').split('\n')) {
      if (isCommentaar(regel)) continue;
      const m = regel.match(UTC_VANDAAG);
      if (m) n += m.length;
    }
  }
  return n;
}

module.exports = { wandklok, utcVandaag, UTC_VANDAAG_MAX, WANDKLOK, UITZONDERING };
