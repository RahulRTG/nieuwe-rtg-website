/* Eigen JS-lexer (deel van de zelfgebouwde AST-scanner). Zet broncode om in een
   stroom tokens. Geen dependency: puur eigen werk.

   Twee lastige plekken die een lexer echt moet kennen:
   - regex vs. deling: een "/" is een reguliere expressie of een deel-teken,
     afhankelijk van het vorige betekenisvolle token (de klassieke ambiguiteit).
   - template-literals: `...${expr}...` -- we knippen de template in de lexer op
     in stukjes tekst (quasis) en de ruwe bronstukken van elke ${}-expressie,
     met haakjes-tellen dat strings/templates/commentaar overslaat. De parser
     parseert die expressie-bronnen daarna zelf.

   Elke token: { type, value, start, end, lijn, nl }.
     type: 'naam' | 'getal' | 'string' | 'regex' | 'lees' (punctuator) |
           'template' | 'eof'
     nl:   true als er nieuwe regel(s) voor dit token stonden (voor ASI). */
'use strict';

const SLEUTELS = new Set(('break case catch class const continue debugger default delete do else ' +
  'export extends finally for function if import in instanceof new return super switch this throw ' +
  'try typeof var void while with yield let static async await enum').split(' '));

// punctuators, langste eerst zodat ">>>=" niet als ">" wordt gelezen
const PUNCT = ['>>>=', '...', '=>', '**=', '<<=', '>>=', '>>>', '===', '!==', '??=', '||=', '&&=',
  '**', '==', '!=', '<=', '>=', '&&', '||', '??', '?.', '++', '--', '+=', '-=', '*=', '/=', '%=',
  '&=', '|=', '^=', '<<', '>>',
  '{', '}', '(', ')', '[', ']', ';', ',', '<', '>', '+', '-', '*', '/', '%', '&', '|', '^', '!',
  '~', '?', ':', '=', '.', '@'];

function isIdStart(c) { return /[A-Za-z_$]/.test(c) || c.charCodeAt(0) > 127; }
function isIdDeel(c) { return /[A-Za-z0-9_$]/.test(c) || c.charCodeAt(0) > 127; }

function lex(bron) {
  const tokens = [];
  let i = 0, lijn = 1;
  const n = bron.length;
  if (bron[0] === '#' && bron[1] === '!') { while (i < n && bron[i] !== '\n') i++; } // shebang
  let vorige = null;         // vorig betekenisvol token (voor regex/deling)
  let nl = false;            // nieuwe regel gezien sinds het vorige token

  function fout(bericht) { const e = new Error('lexfout regel ' + lijn + ': ' + bericht); e.lijn = lijn; e.pos = i; throw e; }

  // Mag hier een regex-literal beginnen (i.p.v. deling)?
  function regexMag() {
    const p = vorige;
    if (!p) return true;
    if (p.type === 'lees') return p.value !== ')' && p.value !== ']' && p.value !== '++' && p.value !== '--';
    if (p.type === 'naam' && p.keyword) return !['this', 'super'].includes(p.value);
    return false; // na naam/getal/string/regex/template: deling
  }

  // Sla een template-expressie over en geef de ruwe bron terug (haakjes tellen).
  function leesTemplateExpr() {
    const begin = i; // i wijst net na "${"
    let diep = 1;
    while (i < n && diep > 0) {
      const c = bron[i];
      if (c === '{') { diep++; i++; }
      else if (c === '}') { diep--; if (diep === 0) break; i++; }
      else if (c === "'" || c === '"') { slaStringOver(c); }
      else if (c === '`') { slaTemplateOver(); }
      else if (c === '/' && bron[i + 1] === '/') { while (i < n && bron[i] !== '\n') i++; }
      else if (c === '/' && bron[i + 1] === '*') { i += 2; while (i < n && !(bron[i] === '*' && bron[i + 1] === '/')) { if (bron[i] === '\n') lijn++; i++; } i += 2; }
      else { if (c === '\n') lijn++; i++; }
    }
    if (i >= n) fout('niet-afgesloten ${} in template');
    const src = bron.slice(begin, i);
    i++; // de "}" zelf
    return src;
  }
  function slaStringOver(q) {
    i++; // openende quote
    while (i < n && bron[i] !== q) { if (bron[i] === '\\') i++; if (bron[i] === '\n') lijn++; i++; }
    i++; // sluitende quote
  }
  function slaTemplateOver() {
    i++; // openende backtick
    while (i < n && bron[i] !== '`') {
      if (bron[i] === '\\') { i += 2; continue; }
      if (bron[i] === '$' && bron[i + 1] === '{') { i += 2; leesTemplateExpr(); continue; }
      if (bron[i] === '\n') lijn++;
      i++;
    }
    i++; // sluitende backtick
  }

  function duw(type, value, start) { const t = { type, value, start, end: i, lijn, nl }; tokens.push(t); if (type !== 'template' || true) vorige = t; nl = false; return t; }

  while (i < n) {
    const c = bron[i];
    // witruimte + nieuwe regels
    if (c === '\n') { lijn++; nl = true; i++; continue; }
    if (c === ' ' || c === '\t' || c === '\r' || c === '\f' || c === '\v' || c === ' ' || c === '﻿') { i++; continue; }
    // commentaar
    if (c === '/' && bron[i + 1] === '/') { while (i < n && bron[i] !== '\n') i++; continue; }
    if (c === '/' && bron[i + 1] === '*') { i += 2; while (i < n && !(bron[i] === '*' && bron[i + 1] === '/')) { if (bron[i] === '\n') { lijn++; nl = true; } i++; } if (i >= n) fout('niet-afgesloten /* */'); i += 2; continue; }
    const start = i;
    // identifier / keyword (of een prive-veldnaam #ident)
    if (isIdStart(c) || (c === '#' && isIdStart(bron[i + 1]))) {
      i++; while (i < n && isIdDeel(bron[i])) i++;
      const w = bron.slice(start, i);
      const t = duw('naam', w, start); t.keyword = SLEUTELS.has(w);
      continue;
    }
    // getal
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(bron[i + 1]))) {
      i++;
      if (c === '0' && /[xXoObB]/.test(bron[i])) { i++; while (i < n && /[0-9a-fA-F_]/.test(bron[i])) i++; }
      else { while (i < n && /[0-9_]/.test(bron[i])) i++; if (bron[i] === '.') { i++; while (i < n && /[0-9_]/.test(bron[i])) i++; } if (/[eE]/.test(bron[i])) { i++; if (/[+-]/.test(bron[i])) i++; while (i < n && /[0-9_]/.test(bron[i])) i++; } }
      if (bron[i] === 'n') i++; // BigInt
      duw('getal', bron.slice(start, i), start); continue;
    }
    // string
    if (c === "'" || c === '"') {
      i++; while (i < n && bron[i] !== c) { if (bron[i] === '\\') { i++; if (bron[i] === '\n') lijn++; } else if (bron[i] === '\n') fout('niet-afgesloten string'); i++; }
      if (i >= n) fout('niet-afgesloten string'); i++;
      duw('string', bron.slice(start, i), start); continue;
    }
    // template
    if (c === '`') {
      i++; const quasis = ['']; const exprs = [];
      while (i < n && bron[i] !== '`') {
        if (bron[i] === '\\') { quasis[quasis.length - 1] += bron[i] + (bron[i + 1] || ''); i += 2; continue; }
        if (bron[i] === '$' && bron[i + 1] === '{') { i += 2; exprs.push(leesTemplateExpr()); quasis.push(''); continue; }
        if (bron[i] === '\n') lijn++;
        quasis[quasis.length - 1] += bron[i]; i++;
      }
      if (i >= n) fout('niet-afgesloten template'); i++;
      duw('template', { quasis, exprs }, start); continue;
    }
    // regex of deling
    if (c === '/' && regexMag()) {
      i++; let klas = false;
      while (i < n) { const d = bron[i]; if (d === '\\') { i += 2; continue; } if (d === '[') klas = true; else if (d === ']') klas = false; else if (d === '/' && !klas) break; else if (d === '\n') fout('niet-afgesloten regex'); i++; }
      if (i >= n) fout('niet-afgesloten regex'); i++;
      while (i < n && isIdDeel(bron[i])) i++; // vlaggen
      duw('regex', bron.slice(start, i), start); continue;
    }
    // punctuator
    let gevonden = null;
    for (const p of PUNCT) { if (bron.startsWith(p, i)) { if (p === '?.' && /[0-9]/.test(bron[i + 2])) continue; gevonden = p; break; } }
    if (!gevonden) fout('onbekend teken ' + JSON.stringify(c));
    i += gevonden.length; duw('lees', gevonden, start); continue;
  }
  tokens.push({ type: 'eof', value: null, start: n, end: n, lijn, nl });
  return tokens;
}

module.exports = { lex, SLEUTELS };
