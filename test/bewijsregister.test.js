/* ============================================================================
   ROOD BEWIJS MOET BLIJVEN STAAN.

   Tot 9 september 2026 was BEPROEVING.json tegelijk het VERSLAG van de laatste
   ronde en de INVOER van de prestatieratel. Die twee banen botsen, want norm.js
   weigert terecht een gezakte ronde als lat. Het gevolg was structureel en niet
   incidenteel: een gezakte ronde was niet in te checken, dus bleef de laatste
   GESLAAGDE ronde staan, en kon het register alleen ooit goed nieuws bevatten.
   CI mat die dag tegen een lat van 18 augustus terwijl dezelfde test op de
   huidige commit zakte -- 22 dagen een basislijn die de code niet beschreef.

   De splitsing:
     LAATSTE_METING.json  altijd geschreven, geslaagd of gezakt. Commitbaar,
                          juist als hij rood is.
     BEPROEVING.json      de geaccepteerde basislijn; schuift alleen na een
                          geslaagde ronde.

   DE GEVAARLIJKSTE FOUT BIJ ZO'N SPLITSING is niet dat rood verdwijnt, maar dat
   rood GROEN wordt: als de ratel de basislijn blijft lezen, laat een gezakte
   ronde de vorige geslaagde staan en meldt hij vrolijk groen. Toets 1 hieronder
   is precies die val.

   Draai los: node --test test/bewijsregister.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const norm = require('../scripts/norm.js');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bewijsreg-'));
test.after(() => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

let n = 0;
function schrijf(inhoud) {
  const p = path.join(TMP, 'm' + (++n) + '.json');
  fs.writeFileSync(p, JSON.stringify(inhoud));
  return p;
}
const ronde = (extra) => Object.assign({
  gedraaid: '2026-09-09T01:00:00.000Z',
  modus: 'postgres',
  machine: { kernen: 4, geheugenGB: 15, platform: 'linux' },
  oordeel: 'PASS',
  gezakteDrempels: 0,
  meters: { p99Ms: 144, doorvoerPerSec: 1875, eventLoopP99Ms: 76.3, herstelSeconden: 1,
    verhalenSlaagPctStorm: 75.4, geheugenHellingMBPerMin: 0 }
}, extra || {});

test('1. een verse meting wint van de basislijn -- anders maskeert een oude PASS een nieuwe FAIL', () => {
  assert.equal(norm.prestatiePad(() => true), norm.METINGBESTAND,
    'met een verse meting hoort de ratel die te lezen en niet de basislijn');
  assert.equal(norm.prestatiePad(p => p !== norm.METINGBESTAND), norm.PRESTATIEBESTAND,
    'zonder verse meting valt hij terug op de basislijn');
  assert.notEqual(norm.METINGBESTAND, norm.PRESTATIEBESTAND,
    'meting en basislijn moeten twee verschillende bestanden zijn');
  assert.match(norm.METINGBESTAND, /LAATSTE_METING\.json$/);
});

test('2. een gezakte meting levert zijn cijfers WEL, want bewijs mag niet verdwijnen', () => {
  const m = norm.leesMeting(schrijf(ronde({ oordeel: 'GEZAKT', gezakteDrempels: 5,
    gezakteNamen: ['GEHEUGEN', 'LATENTIE'] })));
  assert.equal(m.gezakt, true);
  assert.equal(m.gezakteDrempels, 5);
  assert.deepEqual(m.gezakteNamen, ['GEHEUGEN', 'LATENTIE'],
    'de rode meting hoort te zeggen WELKE drempels zakten');
  assert.equal(m.meters.p99Ms, 144, 'de getallen van een rode ronde blijven leesbaar');
  assert.equal(m.bron, '4k/15g/linux/postgres');
});

test('3. en toch wordt een gezakte ronde nooit een lat', () => {
  const r = norm.leesPrestatie(schrijf(ronde({ oordeel: 'GEZAKT', gezakteDrempels: 5 })));
  assert.equal(r.cijfers, undefined, 'een gezakte ronde mag de lat niet voeden');
  assert.match(r.reden, /GEZAKT/);
});

test('4. een ontbrekende meting is geen lege meting', () => {
  assert.equal(norm.leesMeting(path.join(TMP, 'bestaat-niet.json')), null);
  assert.equal(norm.leesMeting(schrijf({ oordeel: 'PASS' })), null, 'zonder meters is het geen meting');
});

test('5. beproeving.js schrijft de meting altijd en de basislijn alleen na PASS', () => {
  const bron = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'beproeving.js'), 'utf8');
  assert.match(bron, /schrijf\('LAATSTE_METING\.json', cijfers\)/,
    'de actuele meting hoort onvoorwaardelijk geschreven te worden');
  const naPass = bron.slice(bron.indexOf("cijfers.oordeel === 'PASS'"));
  assert.match(naPass.slice(0, 300), /schrijf\('BEPROEVING\.json', cijfers\)/,
    'de basislijn hoort binnen de PASS-tak te staan, niet erbuiten');
});
