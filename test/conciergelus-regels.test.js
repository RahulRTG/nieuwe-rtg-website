/* De regels van de concierge-lus zonder server (kern/bureau/lus-regels.js en
   lus-intake.js). Elke toets hoort te zakken als zijn regel sneuvelt; bij de
   dragende regels staat de mutatie erbij die hem laat zakken.

   Draai los: node --test test/conciergelus-regels.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const R = require('../server/kern/bureau/lus-regels');
const { intake } = require('../server/kern/bureau/lus-intake');

const nu = Date.parse('2026-10-01T18:00:00Z');

test('een aanbod vervalt BEREKEND: na zijn tijd is het verlopen zonder dat iemand opruimt (CON-09)', () => {
  const a = { geldigTot: '2026-10-01T18:12:00Z' };
  assert.equal(R.aanbodStand(a, nu), 'vastgehouden');
  assert.equal(R.aanbodStand(a, Date.parse('2026-10-01T18:12:00Z')), 'verlopen');
  assert.equal(R.aanbodStand({ geldigTot: '' }, nu), 'zonder-termijn');
  assert.equal(R.aanbodStand({ geldigTot: '2020-01-01T00:00:00Z', gekozen: true }, nu), 'gekozen');
});

test('een zaak ziet een POSITIEVE lijst velden, ook als de case er meer draagt (CON-02)', () => {
  const c = { id: 'c1', van: '2026-10-01', personen: 2, harde: ['geen noten'], gelegenheid: 'verjaardag',
    verrassing: true, wat: 'Mijn vrouw is jarig', plaats: 'Hotel X kamer 412', geheim: 'x',
    onderdelen: [
      { id: 'o1', wat: 'Diner', van: '21:15', duurMin: 120, deelnemer: { soort: 'zaak', code: 'KIKUNOI' }, stand: 'bevestigd' },
      { id: 'o2', wat: 'Boot', van: '19:00', duurMin: 90, deelnemer: { soort: 'zaak', code: 'ESVEDRA' }, stand: 'bevestigd' }
    ] };
  const b = R.deelnemerBeeld(c, 'KIKUNOI');
  assert.equal(b.length, 1, 'alleen het eigen onderdeel');
  assert.deepEqual(Object.keys(b[0]).sort(),
    ['caseRef', 'datum', 'discreet', 'duurMin', 'gelegenheid', 'onderdeel', 'personen', 'stand', 'van', 'wat', 'wensen'].sort());
  const tekst = JSON.stringify(b);
  for (const lek of ['412', 'Hotel X', 'Boot', 'ESVEDRA', 'Mijn vrouw', 'geheim']) {
    assert.ok(!tekst.includes(lek), 'de zaak ziet "' + lek + '"');
  }
  assert.equal(b[0].discreet, true);
});

test('een verrassing weigert het gezin en elk gedeeld kanaal, en verder niemand (CON-08)', () => {
  const v = { verrassing: true };
  assert.equal(R.magBereiken(v, { soort: 'gezin' }).ok, false);
  assert.equal(R.magBereiken(v, { soort: 'gedeeld' }).ok, false);
  assert.ok(R.magBereiken(v, { soort: 'gezin' }).reden.includes('verrassing'));
  assert.equal(R.magBereiken(v, { soort: 'zaak', code: 'KIKUNOI' }).ok, true);
  assert.equal(R.magBereiken(v, { soort: 'lid' }).ok, true);
  assert.equal(R.magBereiken({ verrassing: false }, { soort: 'gezin' }).ok, true);
});

test('de lus heeft geen weg naar het gezin: geen agenda, geen ontvanger, geen gezinssleutel (CON-08)', () => {
  const map = path.join(__dirname, '..', 'server', 'kern', 'bureau');
  for (const f of fs.readdirSync(map).filter(x => /^lus.*\.js$/.test(x))) {
    const bron = fs.readFileSync(path.join(map, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    for (const verboden of [/require\([^)]*agenda/, /require\([^)]*ontvanger/, /gezin:/, /notify\(\s*['"]gezin/]) {
      assert.ok(!verboden.test(bron), f + ' bevat ' + verboden + ': een weg langs de verrassing heen');
    }
  }
});

test('"alles is geregeld" alleen als het waar is', () => {
  const half = { onderdelen: [{ wat: 'Boot', stand: 'bevestigd' }, { wat: 'Diner', stand: 'gepland' }] };
  assert.equal(R.gastBericht(half).alles, false);
  assert.ok(!R.gastBericht(half).tekst.includes('Alles is geregeld'));
  assert.ok(R.gastBericht(half).tekst.includes('Diner'));
  const heel = { herstel: true, onderdelen: [{ wat: 'Boot', stand: 'bevestigd' },
    { id: 'x', wat: 'Diner A', stand: 'kapot', vervangenDoor: 'y' }, { id: 'y', wat: 'Diner B', stand: 'bevestigd' }] };
  assert.equal(R.gastBericht(heel).alles, true);
  assert.equal(R.gastBericht(heel).tekst, 'Wij hebben het programma iets aangepast. Alles is geregeld.');
});

test('een vertraging schuift door en zet per deelnemer een bericht klaar, niet voor wie niet verschuift', () => {
  const c = { onderdelen: [
    { id: 'boot', wat: 'Boot', van: '19:00', duurMin: 90, vertragingMin: 25, deelnemer: { soort: 'zaak', code: 'ESVEDRA' } },
    { id: 'rit', wat: 'Chauffeur', van: '20:40', duurMin: 20, reisMin: 0, deelnemer: { soort: 'zaak', code: 'TRANSIT' } },
    { id: 'diner', wat: 'Diner', van: '22:00', duurMin: 120, deelnemer: { soort: 'zaak', code: 'KIKUNOI' } }
  ] };
  const t = R.tijdlijn(c);
  assert.deepEqual(t.map(r => r.van), ['19:25', '20:55', '22:00']);
  const g = R.gevolgen(c);
  assert.deepEqual(g.map(x => x.onderdeel), ['boot', 'rit'], 'het diner om 22:00 verschuift niet en krijgt geen bericht');
  assert.equal(g[1].nieuw, '20:55');
});

test('afsluiten weigert zolang er iets niet bevestigd is of een voorstel openstaat', () => {
  assert.equal(R.afsluitbaar({ werkwijze: 'voorstel', onderdelen: [] }).ok, false);
  assert.equal(R.afsluitbaar({ werkwijze: 'voorstel', onderdelen: [{ wat: 'Diner', stand: 'gepland' }] }).ok, false);
  assert.equal(R.afsluitbaar({ werkwijze: 'voorstel', voorstel: { aanbod: 'a' }, onderdelen: [{ wat: 'Diner', stand: 'bevestigd' }] }).ok, false);
  assert.equal(R.afsluitbaar({ werkwijze: 'voorstel', onderdelen: [{ wat: 'Diner', stand: 'bevestigd' }] }).ok, true);
  assert.equal(R.afsluitbaar({ onderdelen: [] }).ok, true, 'een case buiten de lus valt er niet onder');
});

test('de uitkomst telt beloften, herstel en opnieuw vertellen, en noemt wat hij niet meet', () => {
  const u = R.uitkomst({ werkwijze: 'voorstel',
    onderdelen: [{ id: 'x', stand: 'kapot', vervangenDoor: 'y' }, { id: 'y', stand: 'bevestigd' }],
    tijdlijn: [{ door: 'lid', soort: 'toelichting', tijdensHerstel: true }] });
  assert.deepEqual(u.beloften, { totaal: 1, nagekomen: 1, open: 0 });
  assert.equal(u.herstelmomenten, 1);
  assert.equal(u.opnieuwVerteld, 1);
  assert.ok(u.nietGemeten.some(x => x.wat === 'tevredenheid'));
});

test('de intake haalt de wens uit een zin en vraagt wat er niet in staat', () => {
  const r = intake('Mijn vrouw is morgen jarig. We zijn in Amsterdam, ze weet van niets. Diner om 20 uur, geen noten.', '2026-09-30');
  assert.equal(r.velden.van, '2026-10-01');
  assert.equal(r.velden.tijd, '20:00');
  assert.equal(r.velden.plaats, 'Amsterdam');
  assert.equal(r.velden.personen, 2);
  assert.equal(r.velden.verrassing, true);
  assert.equal(r.velden.gelegenheid, 'verjaardag');
  assert.deepEqual(r.velden.harde, ['geen noten']);
  const leeg = intake('Iets bijzonders graag.', '2026-09-30');
  assert.deepEqual(leeg.vragen.map(v => v.veld).sort(), ['grensCenten', 'personen', 'plaats', 'van'].sort(),
    'wat niet in de zin staat, wordt een vraag en geen gok');
  assert.equal(leeg.velden.verrassing, false);
  assert.ok(intake('').fout);
});
