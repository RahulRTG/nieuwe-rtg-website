/* ============================================================================
   DE AGENTINSTRUCTIES (ARCHITECTOPDRACHT.md, fase 1)

   CLAUDE.md is opgeknipt: AGENTS.md is de ene bron voor elke agent, CLAUDE.md
   importeert hem, en de samenvattingen per diepte-document staan woordelijk in
   DOCUMENTENKAART.md. Deze toets houdt drie dingen vast:

     1. er verdween geen blok -- elk blok van de oude CLAUDE.md (commit
        ab8f6b76, vastgelegd in test/fixtures/agentinstructies-inventaris.json)
        staat woordelijk op zijn bestemming;
     2. er staat niets dubbel -- twee kopieen lopen na de eerste wijziging uiteen;
     3. wat een agent bij de start krijgt, blijft klein en Codex krijgt iets.

   Toets 3 is de zelfijking: hij haalt in het geheugen een verplichte regel weg
   en eist dat de controle hem mist. Een controle die nooit kan zakken, is geen
   controle.
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const L = require('../scripts/lib/agentinstructies');

const BESTEMMINGEN = ['CLAUDE.md', 'AGENTS.md', 'DOCUMENTENKAART.md'];
/* Ratel: wat Claude Code bij de start laadt (CLAUDE.md plus imports) mag niet
   groeien boven deze maat. Gemeten op 17.697 bytes; omhoog alleen met een reden
   in de commit, en nooit door de kaart terug in de import te zetten. */
const MAX_START_BYTES = 18000;
const MAX_CLAUDE_BYTES = 1000;

const tekst = (b) => fs.readFileSync(path.join(L.WORTEL, b), 'utf8');

test('1. de inventaris is de bevroren oude CLAUDE.md, met een bestemming per blok', () => {
  const inv = L.inventaris();
  assert.strictEqual(inv.bron.commit, 'ab8f6b76');
  assert.strictEqual(inv.blokken.length, inv.bron.blokken);
  assert.strictEqual(inv.blokken.length, 106);
  for (const b of inv.blokken) {
    assert.ok(BESTEMMINGEN.includes(b.bestemming), 'blok ' + b.nr + ' heeft geen geldige bestemming: ' + b.bestemming);
    assert.match(b.hash, /^[0-9a-f]{16}$/);
  }
});

test('2. geen blok van de oude CLAUDE.md is verloren', () => {
  const weg = L.ontbrekend(L.inventaris());
  assert.deepStrictEqual(weg.map((b) => b.nr + ' -> ' + b.bestemming + ': ' + b.anker), [],
    'deze blokken staan niet (meer) woordelijk op hun bestemming');
});

test('3. zelfijking: haal een verplichte regel weg, en de controle mist hem', () => {
  const inv = L.inventaris();
  const proeven = [
    ['AGENTS.md', 'de AI mag **nooit** zelf toegang beloven of verlenen'],
    ['AGENTS.md', '--burgundy:#7F1634'],
    ['DOCUMENTENKAART.md', 'Een cap die een document noemt, wordt sindsdien tegen de'],
  ];
  for (const [bestand, zin] of proeven) {
    const voor = tekst(bestand);
    const blok = L.blokken(voor).find((b) => b.includes(zin));
    assert.ok(blok, 'de proefzin staat niet in ' + bestand + ': ' + zin);
    const na = voor.replace(blok, '');
    const weg = L.ontbrekend(inv, { [bestand]: na });
    assert.ok(weg.some((b) => b.hash === L.hash(blok)),
      'de controle zag niet dat het blok met "' + zin + '" uit ' + bestand + ' verdween');
  }
});

test('4. niets staat dubbel: elk blok woont op precies een plek', () => {
  const per = {};
  for (const b of BESTEMMINGEN) per[b] = new Set(L.blokken(tekst(b)).map(L.hash));
  const dubbel = [];
  for (const b of L.inventaris().blokken) {
    const waar = BESTEMMINGEN.filter((x) => per[x].has(b.hash));
    if (waar.length > 1) dubbel.push(b.nr + ' in ' + waar.join(' en '));
  }
  assert.deepStrictEqual(dubbel, []);
});

test('5. de start blijft klein, CLAUDE.md importeert AGENTS.md, en Codex krijgt iets', () => {
  const m = L.meet();
  assert.deepStrictEqual(m.claude.bestanden, ['CLAUDE.md', 'AGENTS.md']);
  assert.deepStrictEqual(m.claude.ontbreekt, []);
  assert.ok(m.claude.bytes <= MAX_START_BYTES,
    'de start van Claude Code is ' + m.claude.bytes + ' bytes, de ratel staat op ' + MAX_START_BYTES);
  assert.ok(Buffer.byteLength(tekst('CLAUDE.md')) <= MAX_CLAUDE_BYTES,
    'CLAUDE.md hoort een ingang te zijn, geen tweede kopie van AGENTS.md');
  assert.deepStrictEqual(m.codex.bestanden, ['AGENTS.md']);
  assert.ok(m.codex.bytes > 0);
  assert.ok(!/^@DOCUMENTENKAART\.md/m.test(tekst('CLAUDE.md') + tekst('AGENTS.md')),
    'de kaart hoort niet bij de start te laden');
});

test('6. elk document met een samenvatting op de kaart staat in de index van AGENTS.md', () => {
  const agents = tekst('AGENTS.md');
  const kop = /^\*\*`([A-Z][^`]*\.(?:md|json))`/gm;
  const missen = [];
  for (const m of tekst('DOCUMENTENKAART.md').matchAll(kop)) {
    if (!agents.includes('- `' + m[1] + '`')) missen.push(m[1]);
  }
  assert.deepStrictEqual(missen, []);
});

test('7. de wetten die naar deze bestanden wijzen, vinden hun anker', () => {
  const wetten = JSON.parse(tekst('WETTEN.json')).wetten;
  const hier = wetten.filter((w) => BESTEMMINGEN.includes(w.bron.bestand));
  assert.ok(hier.length >= 7, 'de zeven wetten uit de oude CLAUDE.md horen hier nog te wijzen');
  for (const w of hier) {
    assert.ok(tekst(w.bron.bestand).includes(w.bron.anker), w.id + ': anker niet gevonden in ' + w.bron.bestand);
  }
});
