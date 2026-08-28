/* HET ACTIEBEWIJS, NAGETROKKEN. Een bon is pas een bon als elke regel ergens
   vandaan komt en de gaten erop staan. Dit bestand houdt vier dingen vast:
   de bon zegt WAT er gebeurde en dat een MENS bevestigde, hij haalt de
   bewijsstand uit het echte register, hij zwijgt niet over wat hij niet weet,
   en hij draagt geen persoonsgegevens.

   Draai los: node --experimental-sqlite --test test/bon.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { maakBon, NIET_GEMETEN } = require('../server/kern/stuur/bon');
const vervalstaat = require('../server/lib/vervalstaat');

test('de bon zegt wat er gebeurde, dat een mens bevestigde, en of het lukte', () => {
  const bon = maakBon({ pad: '/api/pay/stuur', wereld: 'member', niveau: 'voorstel',
    voorstelId: 'abcdefghijklmnopqrst', status: 200, staat: null, op: '2026-08-20T10:00:00.000Z' });
  assert.equal(bon.wat, 'POST /api/pay/stuur');
  assert.equal(bon.wereld, 'member');
  assert.equal(bon.bevestigd.door, 'mens');
  assert.equal(bon.bevestigd.voorstel, 'abcdefghij', 'alleen een kort kenmerk, nooit het hele token');
  assert.equal(bon.bevestigd.op, '2026-08-20T10:00:00.000Z');
  assert.equal(bon.uitkomst.gelukt, true);
  assert.equal(maakBon({ pad: '/x', status: 403, staat: null }).uitkomst.gelukt, false);
  assert.equal(maakBon({ pad: '/x', status: 0, staat: null }).uitkomst.gelukt, false,
    'een actie die niet aankwam is niet gelukt');
});

test('de bewijsstand komt uit het echte register, en "onbekend" is een geldig antwoord', () => {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bon-'));
  const reg = path.join(map, 'vertrouwen.json');
  const oud = process.env.RTG_VERTROUWEN;
  try {
    fs.writeFileSync(reg, JSON.stringify({ perRoute: {
      'POST /api/pay/stuur': { staat: 'verzwakt', reden: 'een schakel nooit gemeten' } } }));
    process.env.RTG_VERTROUWEN = reg;
    vervalstaat.vergeet();

    const bon = maakBon({ pad: '/api/pay/stuur', wereld: 'member', niveau: 'voorstel', status: 200 });
    assert.equal(bon.bewijs.vervalstaat, 'verzwakt', 'de stand komt uit VERTROUWEN.json, niet uit een verhaal');
    assert.match(bon.bewijs.reden, /nooit gemeten/);

    /* Een route die het register niet kent, krijgt geen verzonnen groen. */
    const zonder = maakBon({ pad: '/api/kent-het-register-niet', wereld: 'member', status: 200 });
    assert.equal(zonder.bewijs.vervalstaat, 'onbekend');
    assert.match(zonder.bewijs.reden, /geen gemeten vervalstaat/);
  } finally {
    if (oud === undefined) delete process.env.RTG_VERTROUWEN; else process.env.RTG_VERTROUWEN = oud;
    vervalstaat.vergeet();
    try { fs.rmSync(map, { recursive: true, force: true }); } catch (e) {}
  }
});

test('de gaten staan OP de bon, niet eraf', () => {
  /* Een bon die zwijgt over wat hij niet weet, leest als volledigheid. Twee
     dingen weten we per handeling niet, en allebei met een reden. */
  const bon = maakBon({ pad: '/api/pay/stuur', wereld: 'member', status: 200, staat: null });
  assert.equal(bon.nietGemeten.length, 2);
  assert.ok(bon.nietGemeten.some(t => /gewijzigd/.test(t)), 'de wijzigingen zijn niet gemeten, en dat staat er');
  assert.ok(bon.nietGemeten.some(t => /terug te draaien/.test(t)), 'een terugweg wordt niet beloofd');
  bon.nietGemeten.push('rommel');
  assert.equal(NIET_GEMETEN.length, 2, 'de bron-lijst is niet vanuit een bon te wijzigen');
});

test('de bon draagt geen persoonsgegevens', () => {
  /* Privacy by design (CLAUDE.md): dit huis draait op codenamen, en een
     actiebewijs is geen uitzondering. De hele bon als tekst mag geen naam,
     e-mailadres of volledig token bevatten. */
  const bon = maakBon({ pad: '/api/pay/stuur', wereld: 'member', niveau: 'voorstel',
    voorstelId: 'GEHEIMTOKENGEHEIMTOKEN', status: 200, staat: null });
  const tekst = JSON.stringify(bon);
  assert.ok(!/@/.test(tekst), 'geen e-mailadres');
  assert.ok(!/GEHEIMTOKENGEHEIMTOKEN/.test(tekst), 'nooit het hele voorstel-token');
  assert.ok(!/\bnaam\b/i.test(tekst), 'geen naamveld');
});

test('geen bon zonder handeling: een verlopen voorstel levert er geen op', async () => {
  /* De keten zelf: stuurBevestig hangt de bon aan de UITKOMST, en bij een
     goedkeuringsfout is er geen uitkomst geweest. Papier voor iets dat niet is
     gebeurd, is precies wat vertrouwen ondermijnt. */
  const maakBevestiging = require('../server/kern/stuur/bevestiging');
  let geroepen = 0;
  const fout = maakBevestiging({
    goedkeuring: { neem: () => ({ status: 404, error: 'Dit voorstel bestaat niet meer of is verlopen.' }) },
    stuurRoep: async () => { geroepen++; return { status: 200, antwoord: {} }; },
    interneGoedkeuring: Symbol('x')
  });
  const uit = await fout({}, 'weg', 'member');
  assert.equal(uit.status, 404);
  assert.ok(!uit.bon, 'een geweigerde bevestiging krijgt geen bon');
  assert.equal(geroepen, 0, 'en de actie is niet uitgevoerd');

  const goed = maakBevestiging({
    goedkeuring: { neem: () => ({ status: 200, voorstel: { pad: '/api/pay/stuur', body: {}, wereld: 'member' } }) },
    stuurRoep: async () => ({ status: 200, antwoord: { ok: true } }),
    interneGoedkeuring: Symbol('x')
  });
  const ok = await goed({}, 'abcdefghijklmnop', 'member');
  assert.equal(ok.status, 200, 'de uitkomst zelf verandert niet door de bon');
  assert.deepEqual(ok.antwoord, { ok: true });
  assert.equal(ok.bon.wat, 'POST /api/pay/stuur');
  assert.equal(ok.bon.bevestigd.door, 'mens');
});
