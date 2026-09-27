'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const poort = require('../scripts/codecredentials');

test('codecredentialregister is compleet en intern geldig', () => {
  const register = poort.lees();
  const uit = poort.controleer(register);
  assert.deepEqual(uit.fouten, []);
  assert.ok(uit.telling.migrated >= 7);
  assert.ok(uit.telling.closed >= 3);
  assert.ok(uit.telling.remaining > 0, 'onvolwassen deuren worden niet weggepoetst');
  assert.ok(uit.census.aanroepen >= uit.census.verklaringen,
    'de census telt ook dynamische en anders niet parseerbare routeverklaringen');
  assert.ok(uit.census.verklaringen > 100, 'de inventaris komt uit een volledige server-routecensus');
  assert.ok(uit.census.kandidaten > 20, 'credentialachtige paden en velden worden bronafgeleid gevonden');
  assert.ok(uit.census.unclassified.length > 0,
    'nog niet beoordeelde kandidaten blijven zichtbaar en blokkeren');
  assert.ok(uit.census.onleesbaar.length > 0,
    'dynamische routepaden verdwijnen niet stil uit de census');
  assert.ok(uit.blockers.some(x => x.id.startsWith('unparsed-route:')),
    'iedere nog niet statisch herleidbare route is fail-closed een releaseblokkade');
  const kandidaten = poort.bronCensus().kandidaten.map(x => x.route);
  for (const route of ['POST /school/personeel/inloglink', 'POST /api/vastgoed/keyless',
    'POST /api/arrival/pass', 'POST /api/supplier/ticket/checkin'])
    assert.ok(kandidaten.includes(route), route + ' hoort door de census gevonden te worden');
  for (const route of ['POST /api/foundation/gezin/inloggen',
    'POST /api/foundation/school/personeel/inlog/accepteer'])
    assert.ok(poort.REQUIRED_ROUTES.includes(route),
      route + ' is de werkelijk gemounte deur die de releasepoort moet bewaken');
  const ids = new Set(register.deuren.map(x => x.id));
  for (const id of ['foundation.school_access_credentials', 'foundation.family_profile_access',
    'livingos.vastgoed_keyless', 'travelos.activity_ticket_entry',
    'foundation.sport_stadium_ticket', 'travelos.airport_boarding_pass',
    'workos.hospitality_simulation_bridge', 'livingos.invisible_arrival_pass',
    'travelos.mobility_deelcode', 'travelos.mobility_transport_ticket',
    'pay.giftcard_value_code', 'pay.order_pickup_code',
    'foundation.school_physical_pass_identifier', 'workos.payroll_supplier_code_fields',
    'identity.oidc_authorization_code', 'identity.sso_transfer_proof',
    'supplier.central_pda_session', 'platform.zegel_public_key',
    'platform.apps_compatibility_redirect', 'media.public_name_locator'])
    assert.ok(ids.has(id), id + ' hoort expliciet beoordeeld te zijn');
  assert.ok(ids.has('social.contactpin_locator'));
  assert.ok(ids.has('social.live_contactcode'));
  assert.match(uit.bewijs.sha256, /^[a-f0-9]{64}$/);
  assert.ok(uit.bewijs.perDeur.every(d => d.tests.length && d.bron.length &&
    d.tests.every(b => /^[a-f0-9]{64}$/.test(b.sha256)) &&
    d.bron.every(b => /^[a-f0-9]{64}$/.test(b.sha256))),
  'gemigreerde deuren dragen hashes van hun actuele bron en control-tests');
});

test('een routermount kan niet alleen met zijn interne schijnpad groen worden', () => {
  const register = JSON.parse(JSON.stringify(poort.lees()));
  const deur = register.deuren.find(x => x.id === 'foundation.family_profile_access');
  deur.effective_routes = deur.effective_routes.filter(x =>
    x !== 'POST /api/foundation/gezin/inloggen');
  const uit = poort.controleer(register);
  assert.ok(uit.fouten.some(x => x.includes('routermount mist')));
  assert.ok(uit.fouten.some(x => x.includes('/api/foundation/gezin/inloggen')));
});

test('iedere resterende deur blokkeert de release', () => {
  const uit = poort.controleer(poort.lees());
  assert.ok(uit.blockers.length > 0);
  assert.ok(uit.blockers.every(x => x.routes.length && x.eigenaar));
  for (const id of ['pay.kascode_en_vooraf', 'pay.giftcard_value_code',
    'pay.order_pickup_code',
    'travelos.activity_ticket_entry'])
    assert.ok(uit.blockers.some(x => x.id === id), id + ' hoort expliciet te blokkeren');
  assert.ok(!uit.blockers.some(x => x.id === 'travelos.airport_boarding_pass'));
  assert.equal(poort.lees().deuren.find(x =>
    x.id === 'travelos.airport_boarding_pass').status, 'migrated');
  assert.ok(!uit.blockers.some(x => x.id === 'festivalos.groep'));
  assert.ok(!uit.blockers.some(x => x.id === 'livingos.meet_kamer'));
  assert.ok(!uit.blockers.some(x => x.id === 'livingos.samen_kamer'));
  assert.ok(!uit.blockers.some(x => x.id === 'foundationos.samen_kamer'));
  for (const id of ['rtfoundation.club_portaal', 'rtfoundation.stadsraad_partner',
    'rtfos.legacy_organisatieportalen', 'travelos.mobility_deelcode',
    'livinglab.labpas', 'livinglab.labpaspoort',
    'foundation.les_leraar_en_deelnemer', 'foundation.family_profile_access',
    'foundation.school_access_credentials', 'foundation.sport_stadium_ticket']) {
    assert.ok(!uit.blockers.some(x => x.id === id), id + ' is in productie hard gesloten');
    assert.equal(poort.lees().deuren.find(x => x.id === id).status, 'closed');
  }
  assert.ok(!uit.blockers.some(x => x.id === 'workos.hospitality_simulation_bridge'));
  assert.equal(poort.lees().deuren.find(x =>
    x.id === 'workos.hospitality_simulation_bridge').status, 'closed');
  assert.ok(!uit.blockers.some(x => x.id === 'livingos.vastgoed_keyless'));
  assert.equal(poort.lees().deuren.find(x =>
    x.id === 'livingos.vastgoed_keyless').status, 'closed');
  assert.ok(!uit.blockers.some(x => x.id === 'game.projectiescherm'));
  assert.equal(poort.lees().deuren.find(x => x.id === 'game.projectiescherm').status, 'migrated');
  assert.ok(!uit.blockers.some(x => x.id === 'salon.deal_claimcode'));
  assert.equal(poort.lees().deuren.find(x => x.id === 'salon.deal_claimcode').status, 'migrated');
  assert.equal(poort.lees().deuren.find(x => x.id === 'festivalos.groep').status, 'migrated');
  assert.equal(poort.lees().deuren.find(x => x.id === 'livingos.meet_kamer').status, 'migrated');
  assert.equal(poort.lees().deuren.find(x => x.id === 'livingos.samen_kamer').status, 'migrated');
  assert.equal(poort.lees().deuren.find(x => x.id === 'foundationos.samen_kamer').status, 'migrated');
  assert.equal(poort.lees().deuren.find(x => x.id === 'social.contactpin_locator').status, 'closed');
  assert.equal(poort.lees().deuren.find(x => x.id === 'social.live_contactcode').status, 'migrated');
});

test('een niet-bestaand bewijsbestand kan een gemigreerde deur niet groen maken', () => {
  const register = JSON.parse(JSON.stringify(poort.lees()));
  const deur = register.deuren.find(x => x.status === 'migrated' && x.classificatie === 'credential');
  deur.bewijs = ['test/bestaat-bewust-niet.js'];
  const uit = poort.controleer(register);
  assert.ok(uit.fouten.some(fout => fout.includes(deur.id) && fout.includes('testbewijs bestaat niet')));
});

test('releasepoort eindigt non-zero en machineleesbaar zolang blockers bestaan', () => {
  const r = spawnSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'codecredentials.js')],
    { encoding: 'utf8' });
  assert.equal(r.status, 1);
  const uit = JSON.parse(r.stdout);
  assert.equal(uit.status, 'BLOCKED');
  assert.ok(uit.blockers.length > 0);
  assert.deepEqual(uit.fouten, []);
});

test('credentialbewijs weigert exit-nul met skips, todo of ontbrekende TAP-totalen', () => {
  const tap = waarden => Object.entries(waarden)
    .map(([naam, aantal]) => '# ' + naam + ' ' + aantal).join('\n');
  const basis = { tests: 3, pass: 3, fail: 0, cancelled: 0, skipped: 0, todo: 0 };
  assert.equal(poort.testBewijsOordeel({ status: 0, stdout: tap(basis) }).geslaagd, true);
  for (const naam of ['fail', 'cancelled', 'skipped', 'todo']) {
    const telling = { ...basis, pass: 2, [naam]: 1 };
    assert.equal(poort.testBewijsOordeel({ status: 0, stdout: tap(telling) }).geslaagd, false, naam);
  }
  assert.equal(poort.testBewijsOordeel({ status: 0, stdout: '# tests 1\n# pass 1' }).geslaagd,
    false, 'onvolledig TAP-uitvoer is geen bewijs');
  assert.equal(poort.testBewijsOordeel({ status: 1, stdout: tap(basis) }).geslaagd,
    false, 'een rode processtatus blijft rood');
  assert.equal(poort.testBewijsOordeel({ status: 0, stdout: tap({...basis,tests:999}) }).geslaagd,
    false, 'een vervalst totaal is geen geslaagd bewijs');
});

test('de niet-omzeilbare release- en READY-keten voeren deze poort uit', () => {
  const root = path.join(__dirname, '..');
  const release = require('node:fs').readFileSync(path.join(root, 'scripts', 'release-gate.js'), 'utf8');
  const oordeel = require('node:fs').readFileSync(path.join(root, 'scripts', 'lib', 'productie-oordeel.js'), 'utf8');
  assert.match(release, /Codecredentialregister[\s\S]{0,120}scripts\/codecredentials\.js/);
  assert.match(release, /scripts\/codecredentials\.js', '--bewijs'/,
    'de releasegang voert de gehashte control-testbundel echt uit');
  assert.match(oordeel, /'Codecredentialregister'/);
});

test('PG-control-bewijs verifieert oorspronkelijke suitebytes en telt uitsluitend de gevraagde controles', (t) => {
  const fs = require('node:fs'), os = require('node:os'), crypto = require('node:crypto');
  const { TOETSEN, toetslijstSha256 } = require('../scripts/lib/pg-toetslijst');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'credential-pg-binding-'));
  t.after(() => fs.rmSync(root, { recursive:true, force:true }));
  fs.mkdirSync(path.join(root, '.release'));
  const commit = 'a'.repeat(40);
  const fixture = { formaat:'rtg-pg-bewijs-v1',bron:{commit,boomVuil:false},toetslijstSha256,
    geslaagd:true,tapVolledig:true,bestanden:TOETSEN.length,tests:TOETSEN.length,
    geslaagdeTests:TOETSEN.length,mislukt:0,geannuleerd:0,overgeslagen:0,todo:0,
    controles:TOETSEN.map(bestand => ({bestand,tests:1,geslaagd:1,mislukt:0,geannuleerd:0,overgeslagen:0,todo:0})) };
  const bytes = JSON.stringify(fixture);
  const sha = crypto.createHash('sha256').update(bytes).digest('hex');
  const pgPad = path.join(root, '.release/pg-bewijs.json');
  fs.writeFileSync(pgPad,bytes);
  fs.writeFileSync(path.join(root,'SUITE.json'),JSON.stringify({stempel:{commit,boomVuil:false},
    postgres:{pad:'.release/pg-bewijs.json',sha256:sha}}));
  const gevraagd = ['test/boarding-pass.pg.test.js','test/contactpin-live.pg.test.js'];
  const r = poort.pgControlBewijs(root,commit,gevraagd);
  assert.equal(r.status,'PASS');assert.equal(r.sha256,sha);
  assert.deepEqual(r.controles.map(c=>c.bestand),gevraagd);
  assert.deepEqual(r.telling,{tests:2,pass:2,fail:0,cancelled:0,skipped:0,todo:0});
  assert.equal(fs.readFileSync(pgPad,'utf8'),bytes,'bewijs wordt gelezen, nooit vervangen');
  assert.throws(()=>poort.pgControlBewijs(root,'b'.repeat(40),gevraagd));
  assert.throws(()=>poort.pgControlBewijs(root,commit,['test/geen-pg-proef.test.js']));
  fs.writeFileSync(pgPad,bytes+' ');
  assert.throws(()=>poort.pgControlBewijs(root,commit,gevraagd),/wijkt af/);
  fs.writeFileSync(pgPad,bytes);
  fs.unlinkSync(path.join(root,'SUITE.json'));
  assert.throws(()=>poort.pgControlBewijs(root,commit,gevraagd),'zonder oorspronkelijke suitebinding geen PASS');
});
