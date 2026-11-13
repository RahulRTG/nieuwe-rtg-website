/* ============================================================================
   DE GEZAGSPOORT -- alleen BEWEZEN mag door.

   `afbouw:software` is de softwarepoort voor een uitrol, en hij reeg vier
   stappen aan elkaar met `&&`. Dat is binair: hij stopt bij de eerste die valt
   en is anders klaar. Wat hij niet kon zeggen, is of alle vier er ook werkelijk
   zijn geweest -- en `afbouw:snel` heet bijna hetzelfde en draait er twee.

   Deze toetsen zijn de NEGATIEVE proef die daarbij hoort. Niet "gaat de poort
   open als alles klopt", maar: gaat hij DICHT als er iets ontbreekt, als er iets
   gezakt is, en als het bewijs bij een andere commit hoort. Een poort waarvan
   niemand de gesloten stand heeft gezien, is geen poort.

   Ze draaien het script als apart proces met RTG_AFBOUW_BEWIJSMAP naar een
   wegwerpmap, zodat de echte .release-map van deze machine er niet aan te pas
   komt -- een toets die de releasepoort van zijn eigen machine kan dichttrekken,
   wordt binnen een week uitgezet.
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const { VEREIST } = require('../scripts/afbouwoordeel');
const { nuCommit } = require('../scripts/lib/stempel');
const SCRIPT = path.join(__dirname, '..', 'scripts', 'afbouwoordeel.js');
const COMMIT = nuCommit();

/* Zet een kunstmatige ronde neer: welke van de vier bewijzen er zijn, en of ze
   geslaagd zijn. Alles wat je weglaat, ontbreekt. */
function ronde(bewijzen) {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-afbouw-'));
  fs.mkdirSync(path.join(map, '.release'), { recursive: true });
  for (const [id, opties] of Object.entries(bewijzen)) {
    const v = VEREIST.find((x) => x.id === id);
    if (!v) throw new Error('onbekend bewijs in de proef: ' + id);
    const inhoud = { ...opties, [id === 'suite' ? 'stempel' : 'bron']:
      { commit: opties.commit || COMMIT, boomVuil: opties.boomVuil ?? false } };
    fs.writeFileSync(path.join(map, v.bestand), JSON.stringify(inhoud) + '\n');
  }
  return map;
}

function draai(map, vlaggen) {
  const r = cp.spawnSync(process.execPath, [SCRIPT].concat(vlaggen || []),
    { env: Object.assign({}, process.env, { RTG_AFBOUW_BEWIJSMAP: map }), encoding: 'utf8' });
  return { code: r.status, uit: (r.stdout || '') + (r.stderr || '') };
}

const alleVier = () => ({
  // Werkelijke schrijvers: SUITE gebruikt gemeten.groen, niet geslaagd.
  suite: { gemeten: { volledig: true, groen: true, afsluitcode: 0,
    tapVolledig: true, tests: 10, geslaagdeTests: 10, mislukt: 0,
    geannuleerd: 0, overgeslagen: 0, todo: 0, bestanden: 2 } },
  schermen: { geslaagd: true }, releasepoort: { geslaagd: true },
  staging: { geslaagd: true }
});

test('alle vier geleverd op deze commit: BEWEZEN, en de poort gaat open', () => {
  const r = draai(ronde(alleVier()), ['--eis-bewezen']);
  assert.match(r.uit, /BEWEZEN/);
  assert.equal(r.code, 0, 'met alle bewijzen hoort hij door te laten');
});

/* DE PROEF DIE ERTOE DOET. Niets is gezakt -- er ontbreekt alleen iets. */
test('een ontbrekend bewijs is ONBEWEZEN, en met --eis-bewezen sluit de poort', () => {
  const zonderStaging = alleVier();
  delete zonderStaging.staging;
  const map = ronde(zonderStaging);
  const streng = draai(map, ['--eis-bewezen']);
  assert.match(streng.uit, /ONBEWEZEN/);
  assert.equal(streng.code, 1, 'een uitrolpoort hoort hier te zakken');
  const los = draai(map, []);
  assert.match(los.uit, /ONBEWEZEN/);
  assert.equal(los.code, 0, 'zonder de vlag blijft hij een lezer -- anders leert iedereen de exitcode negeren');
});

test('een gezakt bewijs sluit de poort OOK zonder --eis-bewezen', () => {
  const metGezakt = alleVier();
  metGezakt.releasepoort = { geslaagd: false };
  const r = draai(ronde(metGezakt), []);
  assert.match(r.uit, /GEZAKT/);
  assert.equal(r.code, 1, 'tegenbewijs telt altijd, vlag of geen vlag');
});

test('een rode SUITE in het echte schrijversformaat sluit ook de vrijblijvende lezer', () => {
  const rood = alleVier();
  Object.assign(rood.suite.gemeten, { groen: false, afsluitcode: 1,
    geslaagdeTests: 9, mislukt: 1 });
  const r = draai(ronde(rood), []);
  assert.match(r.uit, /GEZAKT/);
  assert.equal(r.code, 1);
});

test('een groene SUITE-claim vereist volledige consistente TAP zonder skips of todo', () => {
  for (const wijziging of [
    { volledig: false }, { tapVolledig: false }, { afsluitcode: 1 },
    { tests: 0, geslaagdeTests: 0 }, { bestanden: 0 }, { geslaagdeTests: 9 },
    ...['mislukt', 'geannuleerd', 'overgeslagen', 'todo'].map(k => ({ [k]: 1, geslaagdeTests: 9 }))
  ]) {
    const ongeldig = alleVier();
    Object.assign(ongeldig.suite.gemeten, wijziging);
    const r = draai(ronde(ongeldig), ['--eis-bewezen']);
    assert.match(r.uit, /GEZAKT/, JSON.stringify(wijziging));
    assert.equal(r.code, 1);
  }
});

test('ontbrekende of niet-booleaanse uitslagen zijn nooit geleverd bewijs', () => {
  for (const v of VEREIST) for (const waarde of [undefined, null, 'true', 1]) {
    const onbekend = alleVier();
    if (v.id === 'suite') onbekend.suite.gemeten.groen = waarde;
    else onbekend[v.id].geslaagd = waarde;
    const r = draai(ronde(onbekend), ['--eis-bewezen']);
    assert.match(r.uit, /ONBEWEZEN/, v.id + ': ' + waarde);
    assert.equal(r.code, 1);
  }
});

test('een groene meting op gewijzigde code hoort niet bij de gestempelde commit', () => {
  for (const v of VEREIST) {
    const vuil = alleVier();
    vuil[v.id].boomVuil = true;
    const r = draai(ronde(vuil), ['--eis-bewezen']);
    assert.match(r.uit, /ONBEWEZEN/, v.id);
    assert.equal(r.code, 1);
  }
});

/* EEN BEWIJS VAN GISTEREN IS GEEN BEWIJS VAN VANDAAG. Dit is de stille variant:
   alle vier de bestanden zijn er, alles staat op geslaagd, en toch is deze
   commit niet bewezen. */
test('bewijs van een ANDERE commit telt niet mee', () => {
  const oud = alleVier();
  oud.suite = { geslaagd: true, commit: '0123456789abcdef0123456789abcdef01234567' };
  const r = draai(ronde(oud), ['--eis-bewezen']);
  assert.match(r.uit, /ONBEWEZEN/);
  assert.equal(r.code, 1);
  assert.match(r.uit, /hoort bij 01234567/, 'en hij zegt bij welke commit het dan wel hoort');
});

test('een bewijs zonder commit telt als ontbrekend en niet als geleverd', () => {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-afbouw-'));
  fs.mkdirSync(path.join(map, '.release'), { recursive: true });
  for (const v of VEREIST) fs.writeFileSync(path.join(map, v.bestand), JSON.stringify({ geslaagd: true }) + '\n');
  const r = draai(map, ['--eis-bewezen']);
  assert.match(r.uit, /ONBEWEZEN/);
  assert.equal(r.code, 1, 'niet vast te stellen waar het bij hoort, dus geen bewijs van deze commit');
});

/* De vier vereiste bewijzen horen gelijk te lopen met wat `afbouw:software`
   werkelijk draait. Loopt dat uit elkaar, dan bewaakt deze poort een andere
   keten dan er draait. */
test('de vereiste bewijzen komen overeen met de opdrachten van afbouw:software', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  const opdracht = pkg.scripts['afbouw:software'];
  for (const v of VEREIST) {
    assert.ok(opdracht.includes(v.opdracht),
      'afbouw:software hoort "' + v.opdracht + '" te draaien, want dit oordeel eist er bewijs van');
  }
});
