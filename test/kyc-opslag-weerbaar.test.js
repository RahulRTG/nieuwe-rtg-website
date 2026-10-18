/* DE OPSLAG VAN IDENTITEITSBEWIJZEN: VERSLEUTELING ZONDER SLEUTEL EN DE MAP
   (server/kluis.js, server/identiteitsmap.js).

   Een identiteitsbewijs en een selfie zijn de gevoeligste bestanden van het
   huis. kluis.js versleutelt ze met RTG_ENC_KEY; identiteitsmap.js zorgt dat er
   per account hooguit één bewijs en één selfie blijft staan en dat
   vergetelheid alles van het account wist. Twee dingen stonden nergens
   getoetst: wat er gebeurt als de sleutel ONTBREEKT terwijl er versleutelde
   bestanden liggen, en de selfie-opruiming.

   Wat hier niet mag sneuvelen:
   1. zonder sleutel wordt een versleuteld bestand (RTGENC1 of RTGENC2) NIET
      als platte tekst teruggegeven: het lezen stopt met een duidelijke fout;
      onversleutelde bytes en te korte buffers gaan ongewijzigd door;
   2. zonder sleutel versleutelt de laag niets (geen halve versleuteling);
   3. houdAlleenSelfie houdt alleen de nieuwste selfie van DIT account: het
      identiteitsbewijs, de selfie van account 12 en een bestand dat alleen op
      "1-selfie" EINDIGT blijven staan als account 1 wordt opgeruimd;
   4. een bestand dat niet te wissen is, telt niet als gewist; een map die
      niet bestaat is leeg en geen crash.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - in ontsleutelBestand `if (!KEY) throw ...` weggehaald -> "1." ZAKT (RAAK:
     een onduidelijke crypto-fout in plaats van "RTG_ENC_KEY ontbreekt");
   - in identiteitsmap isSelfie de `^` weggehaald -> "3." ZAKT (RAAK: het
     bestand x1-selfie-1.jpg werd gewist bij het opruimen van account 1);
   - in houdAlleenSelfie `&& wis(n)` vervangen door `&& (wis(n), true)` ->
     "4." ZAKT (RAAK).

   Draai: node --test test/kyc-opslag-weerbaar.test.js */
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path');
const { maakIdentiteitsmap } = require('../server/identiteitsmap');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kyc-'));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));

/* kluis.js leest RTG_ENC_KEY bij het laden; daarom twee verse exemplaren. */
function laadKluis(sleutel) {
  const pad = require.resolve('../server/kluis');
  const oud = process.env.RTG_ENC_KEY;
  delete require.cache[pad];
  if (sleutel) process.env.RTG_ENC_KEY = sleutel; else delete process.env.RTG_ENC_KEY;
  try { return require(pad); } finally {
    delete require.cache[pad];
    if (oud === undefined) delete process.env.RTG_ENC_KEY; else process.env.RTG_ENC_KEY = oud;
  }
}

test('1+2. zonder sleutel: versleuteld lezen stopt, niets wordt versleuteld', () => {
  const met = laadKluis('a'.repeat(64));
  const zonder = laadKluis('');
  assert.equal(met.AAN, true); assert.equal(zonder.AAN, false);
  const doc = Buffer.from('paspoort-scan');
  const v1 = met.versleutelBuf(doc), v2 = met.versleutelBestand(doc, '7-1700.jpg');
  assert.deepEqual(met.ontsleutelBestand(v2, '7-1700.jpg'), doc);
  assert.deepEqual(met.ontsleutelBestand(v1, 'wat-dan-ook'), doc, 'een RTGENC1-bestand blijft leesbaar');
  assert.throws(() => zonder.ontsleutelBestand(v2, '7-1700.jpg'), /RTG_ENC_KEY ontbreekt/);
  assert.throws(() => zonder.ontsleutelBestand(v1, '7-1700.jpg'), /RTG_ENC_KEY ontbreekt/);
  assert.throws(() => zonder.ontsleutelBuf(v1), /RTG_ENC_KEY ontbreekt/);
  assert.throws(() => zonder.ontsleutel(met.versleutel('geheim')), /RTG_ENC_KEY ontbreekt/);
  assert.deepEqual(zonder.ontsleutelBestand(doc, 'x'), doc, 'onversleutelde bytes gaan door');
  assert.deepEqual(zonder.ontsleutelBestand(Buffer.from('kort'), 'x'), Buffer.from('kort'));
  assert.equal(zonder.ontsleutelBestand(null, 'x'), null);
  assert.equal(zonder.versleutelBuf(doc), doc, 'zonder sleutel geen halve versleuteling');
  assert.equal(zonder.versleutelBestand(doc), doc);
  assert.equal(zonder.versleutel('tekst'), 'tekst');
  assert.throws(() => met.versleutelBestand(doc, ''), /vraagt de bestandsnaam/);
  const wachtzin = laadKluis('een lange wachtzin als sleutel');
  assert.deepEqual(wachtzin.ontsleutelBuf(wachtzin.versleutelBuf(doc)), doc);
  assert.throws(() => met.ontsleutelBuf(wachtzin.versleutelBuf(doc)), /authenticate/, 'een andere sleutel opent niets');
});

test('3. alleen de nieuwste selfie van DIT account blijft', () => {
  const dir = fs.mkdtempSync(path.join(TMP, 'map-'));
  const namen = ['1-100.jpg', '1-selfie-100.jpg', '1-selfie-200.png', '12-selfie-100.jpg', '12-100.jpg', 'x1-selfie-1.jpg'];
  for (const n of namen) fs.writeFileSync(path.join(dir, n), 'x');
  const m = maakIdentiteitsmap(dir);
  assert.equal(m.houdAlleenSelfie(1, '1-selfie-200.png'), 1);
  assert.deepEqual(fs.readdirSync(dir).sort(), ['1-100.jpg', '1-selfie-200.png', '12-100.jpg', '12-selfie-100.jpg', 'x1-selfie-1.jpg']);
  assert.equal(m.houdAlleenSelfie('1', '1-selfie-200.png'), 0, 'herhalen wist niets meer');
  assert.equal(m.wisAllesVan(12), 2);
  assert.deepEqual(fs.readdirSync(dir).sort(), ['1-100.jpg', '1-selfie-200.png', 'x1-selfie-1.jpg']);
});

test('4. niet te wissen telt niet; een ontbrekende map is leeg', () => {
  const dir = fs.mkdtempSync(path.join(TMP, 'vast-'));
  fs.mkdirSync(path.join(dir, '3-selfie-100.jpg'));
  fs.writeFileSync(path.join(dir, '3-selfie-200.jpg'), 'x');
  const m = maakIdentiteitsmap(dir);
  assert.equal(m.houdAlleenSelfie(3, '3-selfie-200.jpg'), 0, 'een map met die naam is niet gewist en telt dus niet');
  assert.equal(m.wisAllesVan(3), 1);
  const weg = maakIdentiteitsmap(path.join(TMP, 'bestaat-niet'));
  assert.deepEqual([weg.houdAlleenSelfie(1, 'x'), weg.houdAlleenBewijs(1, 'x'), weg.wisAllesVan(1)], [0, 0, 0]);
});
