/* Welke teksten zijn aantoonbaar RTG-interface?

   /api/vertaal/ui is publiek omdat ook de voordeur vóór inloggen vertaald moet
   kunnen worden. Dat maakt willekeurige invoer nog geen UI. Dit register leest
   bij de start alle serveerbare HTML/JS en bewaart zichtbare tekst, relevante
   attributen en stringliteralen. Alleen een exacte, genormaliseerde treffer mag
   naar een modelprovider. Zo blijven namen, chats en verzonnen kostbare prompts
   lokaal, ook als een client de browsergrens probeert te omzeilen. */
'use strict';
const fs = require('fs');
const path = require('path');

function normaliseer(s) {
  return String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
}
function htmlOntsleutel(s) {
  const vast = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return String(s || '').replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (m, k) => {
    if (k[0] !== '#') return vast[k.toLowerCase()] || m;
    const hex = k.slice(0, 2).toLowerCase() === '#x';
    const n = parseInt(k.slice(hex ? 2 : 1), hex ? 16 : 10);
    return Number.isFinite(n) ? String.fromCodePoint(n) : m;
  });
}
function jsOntsleutel(s) {
  return String(s || '').replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t')
    .replace(/\\([\\'"`])/g, '$1');
}

function maakUiBronnen(publicDir, extraBestanden) {
  const teksten = new Set();
  function voeg(s) {
    s = normaliseer(htmlOntsleutel(s));
    if (s.length >= 2 && s.length <= 300) teksten.add(s);
  }
  function htmlStukken(s) {
    let m;
    const tussen = />([^<>]+)</g;
    while ((m = tussen.exec(s))) voeg(m[1]);
    const attrs = /\b(?:placeholder|title|aria-label|aria-description|alt|value)\s*=\s*(["'])(.*?)\1/gi;
    while ((m = attrs.exec(s))) voeg(m[2]);
  }
  function leesBestand(p) {
    let bron = '';
    try { bron = fs.readFileSync(p, 'utf8'); } catch (e) { return; }
    if (p.endsWith('.html')) htmlStukken(bron);
    const literals = /'((?:\\.|[^'\\]){2,300})'|"((?:\\.|[^"\\]){2,300})"|`((?:\\.|[^`\\]){2,300})`/g;
    let m;
    while ((m = literals.exec(bron))) {
      const s = jsOntsleutel(m[1] != null ? m[1] : m[2] != null ? m[2] : m[3]);
      voeg(s);
      if (/[<>]/.test(s)) htmlStukken(s);
    }
  }
  function loop(dir) {
    let namen = [];
    try { namen = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const n of namen) {
      if (n.name === 'dist') continue;
      const p = path.join(dir, n.name);
      if (n.isDirectory()) loop(p);
      else if (/\.(?:html|js)$/.test(n.name)) leesBestand(p);
    }
  }
  loop(publicDir);
  for (const p of (extraBestanden || [])) leesBestand(p);
  return {
    toegestaan: s => teksten.has(normaliseer(s)),
    aantal: teksten.size
  };
}

module.exports = { maakUiBronnen, normaliseer };
