/* De nadruk van een scherm (ONTWERPSYSTEEM.md par. 7): de contractregels.

   Een nadruk is geen tweede stijlsysteem maar een handvol tokens die het
   schermtype of een deel ervan verlegt. Deze regels houden dat zo: de lijst
   is gesloten, elk schermtype heeft een standaard, tokens.css zet per nadruk
   precies dezelfde tokens, de standaard van een schermtype is letterlijk de
   nadruk die het contract noemt, alleen tokens.css zet een nadruktoken, en
   geen scherm of script gebruikt een nadruk die niet bestaat. */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const zonderCommentaar = s => s.replace(/\/\*[\s\S]*?\*\//g, '');

/* Splits op de komma's op het bovenste niveau: `:where(a, b)` is één selector. */
function lijst(tekst) {
  const uit = []; let diepte = 0, nu = '';
  for (const c of tekst) {
    if (c === '(') diepte++; else if (c === ')') diepte--;
    if (c === ',' && diepte === 0) { uit.push(nu); nu = ''; } else nu += c;
  }
  uit.push(nu);
  return uit.map(x => x.trim()).filter(Boolean);
}

/* Alle blokken van tokens.css als { selectors, declaraties }. */
function blokken(css) {
  const uit = [];
  for (const m of zonderCommentaar(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const decl = {};
    for (const d of m[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) decl[d[1]] = d[2].trim();
    uit.push({ selectors: lijst(m[1]), decl });
  }
  return uit;
}

function bestanden(map, patroon, uit = []) {
  if (!fs.existsSync(map)) return uit;
  for (const e of fs.readdirSync(map, { withFileTypes: true })) {
    const p = path.join(map, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') bestanden(p, patroon, uit); } else if (patroon.test(e.name)) uit.push(p);
  }
  return uit;
}

function nadrukFouten(contract, DS, publiek = path.dirname(DS)) {
  const fouten = [];
  const namen = Object.keys(contract.nadrukken || {});
  const standaard = contract.nadrukStandaard || {};
  const tokens = contract.nadrukTokens || [];
  if (!namen.length) return ['contract.nadrukken ontbreekt (ONTWERPSYSTEEM.md par. 7)'];
  if (!tokens.length) fouten.push('contract.nadrukTokens ontbreekt');
  for (const t of contract.schermtypen) {
    if (!standaard[t]) fouten.push('schermtype ' + t + ' heeft geen nadrukStandaard');
    else if (!namen.includes(standaard[t])) fouten.push('nadrukStandaard ' + t + ' -> ' + standaard[t] + ' is geen nadruk uit het contract');
  }
  for (const t of tokens) if ((contract.themabaar || []).includes(t) && t.startsWith('--ds-nadruk-')) fouten.push('themabaar noemt ' + t + '; een thema verlegt geen nadruk');

  const tokpad = path.join(DS, 'tokens.css');
  const alle = fs.existsSync(tokpad) ? blokken(fs.readFileSync(tokpad, 'utf8')) : [];
  const zoek = sel => alle.find(b => b.selectors.includes(sel));
  /* De standaard per schermtype staat in :where(), zodat data-ds-nadruk op
     hetzelfde element altijd wint (specificiteit 0). */
  const zoekStandaard = t => alle.find(b => b.selectors.some(x => /^:where\(.*\)$/.test(x) && lijst(x.slice(7, -1)).includes('.ds-scherm[data-ds-schermtype="' + t + '"]')));
  const waarden = {};
  for (const n of namen) {
    const b = zoek('[data-ds-nadruk="' + n + '"]');
    if (!b) { fouten.push('public/ds/tokens.css: geen regel voor [data-ds-nadruk="' + n + '"]'); continue; }
    for (const t of tokens) if (!(t in b.decl)) fouten.push('public/ds/tokens.css: nadruk ' + n + ' zet ' + t + ' niet');
    waarden[n] = b.decl;
  }
  for (const [t, n] of Object.entries(standaard)) {
    const b = zoekStandaard(t);
    if (!b) { fouten.push('public/ds/tokens.css: geen standaardnadruk voor schermtype ' + t + ' (in :where())'); continue; }
    for (const tok of tokens) if (waarden[n] && b.decl[tok] !== waarden[n][tok]) fouten.push('public/ds/tokens.css: schermtype ' + t + ' zet ' + tok + ' anders dan zijn standaard ' + n);
  }
  /* Alleen tokens.css zet een nadruktoken; een component leest hem. */
  for (const f of bestanden(DS, /\.css$/)) {
    if (f === path.join(DS, 'tokens.css')) continue;
    if (/--ds-nadruk-[\w-]+\s*:/.test(zonderCommentaar(fs.readFileSync(f, 'utf8')))) fouten.push('public/ds/' + path.relative(DS, f).split(path.sep).join('/') + ': zet een nadruktoken; dat doet alleen tokens.css');
  }
  /* Geen scherm of script noemt een nadruk die niet bestaat. */
  for (const f of bestanden(publiek, /\.(?:html|js)$/)) {
    for (const m of fs.readFileSync(f, 'utf8').matchAll(/data-ds-nadruk=\\?["']([\w-]*)\\?["']/g)) {
      if (!namen.includes(m[1])) fouten.push('public/' + path.relative(publiek, f).split(path.sep).join('/') + ': onbekende nadruk "' + m[1] + '" (contract: ' + namen.join(', ') + ')');
    }
  }
  return fouten;
}

module.exports = { nadrukFouten };
