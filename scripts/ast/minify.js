/* De eigen minifier: parse -> print, op onze eigen parser/printer. Vervangt het
   pakket `terser` (en daarmee ook acorn). Puur eigen werk, geen dependency.

   Bewust veilig. We manglen (nog) GEEN namen: het echte gevaar van een minifier
   is dat een verkeerde hernoeming stille, kapotte client-code uitlevert, en over
   de lijn haalt gzip/brotli het meeste van dat verschil toch weg. Wat we wel doen
   is commentaar + witruimte strippen en haakjes weglaten waar de voorrang ze niet
   eist. En als de geminificeerde uitvoer NIET exact dezelfde boom oplevert, vallen
   we terug op de bron -- net als terser's eigen vangnet. Zo leveren we nooit iets
   kapots uit; in het slechtste geval een bestand onverkleind. */
'use strict';
const { parse } = require('./parser');
const { print } = require('./print');

// histogram van knooptypes: een snelle structurele vingerafdruk van de boom
function vorm(node, h) {
  if (node == null || typeof node !== 'object') return h;
  if (Array.isArray(node)) { for (const x of node) vorm(x, h); return h; }
  if (typeof node.type === 'string') h[node.type] = (h[node.type] || 0) + 1;
  for (const k in node) { if (k === 'start' || k === 'end' || k === 'lijn' || k === 'raw') continue; const v = node[k]; if (v && typeof v === 'object') vorm(v, h); }
  return h;
}

// samenvatting van alle namen + literals, in volgorde: vangt een fout waarbij de
// vorm klopt maar een naam/getal is verschoven. Alleen pushen, aan het eind een
// keer join -- anders wordt het O(n^2) op grote bundels.
function bladLijst(node, uit) {
  if (node == null || typeof node !== 'object') return;
  if (Array.isArray(node)) { for (const x of node) bladLijst(x, uit); return; }
  if (node.type === 'Identifier') uit.push('#' + node.name);
  else if (node.type === 'Literal') uit.push('=' + node.raw);
  else if (node.type === 'TemplateElement') uit.push('`' + node.cooked);
  else if (node.type === 'MetaProperty') uit.push('@' + node.meta + '.' + node.property);
  for (const k in node) { if (k === 'start' || k === 'end' || k === 'lijn') continue; const v = node[k]; if (v && typeof v === 'object') bladLijst(v, uit); }
}
function blad(node) { const uit = []; bladLijst(node, uit); return uit.join(''); }

function zelfdeVorm(a, b) {
  const ha = vorm(a, {}), hb = vorm(b, {});
  const ks = new Set([...Object.keys(ha), ...Object.keys(hb)]);
  for (const k of ks) if ((ha[k] || 0) !== (hb[k] || 0)) return false;
  return blad(a) === blad(b); // ook de namen/literals moeten exact gelijk blijven
}

// Geef de geminificeerde code terug, of de bron als er ook maar iets niet klopt.
function minifyCode(code) {
  let boom;
  try { boom = parse(code); } catch (e) { return code; }        // niet te parsen: laat met rust
  let uit;
  try { uit = print(boom); } catch (e) { return code; }
  let boom2;
  try { boom2 = parse(uit); } catch (e) { return code; }        // uitvoer moet parseerbaar zijn
  if (!zelfdeVorm(boom, boom2)) return code;                    // en exact dezelfde boom opleveren
  return uit.length < code.length ? uit : code;                 // nooit groter dan de bron
}

// Zelfde vorm als terser: minify(code[, opts]) -> { code }. opts wordt genegeerd.
function minify(code) { return { code: minifyCode(code) }; }

module.exports = { minify, minifyCode };
