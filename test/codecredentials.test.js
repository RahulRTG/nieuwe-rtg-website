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
  const census = poort.bronCensus(undefined, register);
  assert.equal(census.aanroepen, census.letterlijk + census.doorRouter +
    census.verklaardDynamisch.length + census.onleesbaar.length,
  'elke routeaanroep is letterlijk, door de router opgelost, verklaard of onleesbaar -- niets valt ertussen');
  assert.ok(uit.census.verklaringen > 100, 'de inventaris komt uit een volledige server-routecensus');
  assert.ok(uit.census.kandidaten > 20, 'credentialachtige paden en velden worden bronafgeleid gevonden');
  /* Dat een onbeoordeelde kandidaat en een onleesbare route BLOKKEREN, stond hier
     als "er zijn er nu meer dan nul" -- een bewering over de achterstand, niet
     over de poort, en die zakt zodra de achterstand is weggewerkt. De poort zelf
     wordt beproefd in de fixtureproef hieronder. */
  assert.deepEqual(uit.census.unclassified.map(x => x.route), [],
    'iedere bronafgeleide kandidaat is na lezing aan een deur toegewezen');
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

/* De classificatieronde van 27 september 2026 bracht `unclassified` op nul.
   Dat mag geen stille nul worden: haal een route uit haar deur en de census
   moet hem weer als releaseblokkade melden. */
test('een kandidaat zonder deur wordt weer een ongeclassificeerde releaseblokkade', () => {
  const register = JSON.parse(JSON.stringify(poort.lees()));
  const deur = register.deuren.find(x => x.id === 'geen.woord_en_buurtreffers');
  deur.routes = deur.routes.filter(x => x !== 'POST /api/supplier/horeca/pas/pak');
  const uit = poort.controleer(register);
  assert.deepEqual(uit.census.unclassified.map(x => x.route), ['POST /api/supplier/horeca/pas/pak']);
  assert.ok(uit.blockers.some(x => x.id === 'unclassified:POST /api/supplier/horeca/pas/pak'));
});

test('geen_credential is alleen een gesloten, onderbouwd oordeel', () => {
  for (const wijzig of [d => { d.status = 'remaining'; d.release_blocker = true; },
    d => { d.release_blocker = true; }, d => { d.notitie = 'record-id'; }]) {
    const register = JSON.parse(JSON.stringify(poort.lees()));
    const deur = register.deuren.find(x => x.id === 'geen.record_ids_randombytes');
    wijzig(deur);
    const uit = poort.controleer(register);
    assert.ok(uit.fouten.some(f => f.startsWith('geen.record_ids_randombytes: geen_credential')),
      'een goedkoop geen-credential-oordeel wordt geweigerd');
  }
});

test('de echte credentials uit de classificatieronde blokkeren de release', () => {
  const register = poort.lees();
  const uit = poort.controleer(register);
  const echte = ['office.gedeelde_kantoorcode', 'partnerkanaal.personeels_en_partnercode',
    'horeca.bon_en_polsbandsaldo', 'link.capability_aanvaarden', 'travelos.ov_incheckcode',
    'mode.bezorgcode', 'workos.concern_uitnodiging', 'festivalos.toegangspas',
    'magnaat.teamkamer_toegangscode', 'identity.algpin_herstelsleutel',
    'command.api_machinesleutel', 'devices.zaakdoos_sleutel', 'devices.stadsdoos_sleutel',
    'identity.sso_client_secret', 'identity.scim_bearer_sleutel', 'rtmail.imap_apparaatsleutel',
    'rtfos.activiteit_incheckcode', 'office.kantooruitnodiging', 'service.balie_bevestigingscode',
    'foundation.onderwijs_les_tokens', 'foundation.family_profile_token_buiten_harde_poort',
    'eten.kortingscode'];
  for (const id of echte) {
    const d = register.deuren.find(x => x.id === id);
    assert.ok(d, id + ' hoort geregistreerd te zijn');
    assert.equal(d.status, 'remaining', id + ' is niet gemigreerd');
    assert.ok(Array.isArray(d.huidige_risicos) && d.huidige_risicos.length, id + ' noemt zijn risico');
    assert.ok(uit.blockers.some(x => x.id === id), id + ' hoort de release te blokkeren');
    for (const route of poort.effectieveRoutes(d))
      assert.ok(poort.REQUIRED_ROUTES.includes(route), route + ' hoort bewaakt te zijn');
  }
  /* Elke consumer en uitgever van het niet-gemigreerde gezinsprofieltoken en de
     onderwijslesfamilie zit sinds 27 september 2026 in NOG_GESLOTEN: in productie
     dicht, ook met een geslaagd extern dossier. De deuren blijven remaining omdat
     de credential zelf niet gemigreerd is. */
  const vrijgave = require('../server/middleware/foundation-productiepoort');
  for (const id of ['foundation.family_profile_token_buiten_harde_poort', 'foundation.onderwijs_les_tokens'])
    for (const route of poort.effectieveRoutes(register.deuren.find(x => x.id === id))) {
      const [methode, pad] = route.split(' ');
      assert.equal(vrijgave.isNogGeslotenCredentialroute(methode, pad, {}) ||
        vrijgave.VEILIGE_UITGANGEN.includes(route), true, route + ' hoort in NOG_GESLOTEN');
    }
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
  for (const id of ['pay.kascode_en_vooraf', 'pay.tikcode'])
    assert.ok(uit.blockers.some(x => x.id === id), id + ' hoort expliciet te blokkeren');
  for (const id of ['travelos.activity_ticket_entry', 'travelos.mobility_transport_ticket']) {
    assert.ok(!uit.blockers.some(x => x.id === id), id + ' is gemigreerd (27 september 2026)');
    assert.equal(poort.lees().deuren.find(x => x.id === id).status, 'migrated');
  }
  assert.ok(!uit.blockers.some(x => x.id === 'pay.tegoedbon'), 'de tegoedbon is gemigreerd (27 september 2026)');
  assert.ok(!uit.blockers.some(x => x.id === 'pay.order_pickup_code'),
    'de afhaalcode is gemigreerd en blokkeert niet meer');
  assert.equal(poort.lees().deuren.find(x => x.id === 'pay.order_pickup_code').status, 'migrated');
  assert.ok(!uit.blockers.some(x => x.id === 'pay.giftcard_value_code'),
    'de cadeaukaart is gemigreerd (27 september 2026) en blokkeert niet meer');
  assert.equal(poort.lees().deuren.find(x => x.id === 'pay.giftcard_value_code').status, 'migrated');
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

/* DE CENSUS OP EEN WEGWERPBOOM. Beproeft de poort zelf, los van hoe groot de
   achterstand in de echte bron nu is:
     - een onbekende credentialachtige route blokkeert;
     - een dynamisch pad dat niemand kent blokkeert;
     - een `app.post(` en een "Authorization" in COMMENTAAR tellen niet;
     - een dynamisch pad dat de ROUTER op die regel kent (ROUTEBRON.json) wordt
       gewoon gekeurd, en een verklaarde dynamische aanroep blokkeert niet;
     - een verklaring die niet meer klopt en een geen_credential-deur zonder
       reden zijn fouten. */
test('de census blokkeert wat hij niet kent, en laat zich niet door commentaar misleiden', () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-codecred-'));
  try {
    fs.mkdirSync(path.join(root, 'server'), { recursive: true });
    fs.writeFileSync(path.join(root, 'server', 'x.js'), [
      "app.post('/api/x/toegangscode', (req, res) => res.json({ ok: req.body.toegangscode }));",
      "// app.post('/api/y/iets', h) -- een uitleg, geen route",
      "/* Authorization: Bearer ... staat hier alleen in commentaar */",
      "app.get('/api/x/lijst', (req, res) => res.json([]));",
      "app.post(BASIS + '/onbekend', h);",
      "app.post(BASIS + '/bekend', (req, res) => res.json({ token: req.body.token }));",
      "app.get(bundelPad, bundel(DIR));"
    ].join('\n') + '\n');
    fs.writeFileSync(path.join(root, 'ROUTEBRON.json'), JSON.stringify({ perRoute: {
      0: { route: 'POST /api/x/bekend', bestand: 'server/x.js', regel: 6, samengesteld: true } } }));
    const register = { schema: 1, beleid: { credential_min_entropy_bits: 128 }, deuren: [
      { id: 'proef.leeg', classificatie: 'geen_credential', status: 'closed', release_blocker: false,
        routes: ['GET /api/x/lijst'], bron: ['server/x.js'], notitie: 'te kort' }],
      dynamische_aanroepen: [
        { bron: 'server/x.js', aanroep: 'app.get(bundelPad, bundel(DIR));', classificatie: 'geen_credential',
          notitie: 'levert een gebundeld openbaar bestand uit, zonder sessie, code of geheim erin of eruit' },
        { bron: 'server/x.js', aanroep: 'app.get(weg, h);', classificatie: 'geen_credential',
          notitie: 'deze aanroep bestaat niet meer en moet dus als verouderd gemeld worden' }] };
    const uit = poort.controleer(register, root);
    const ids = uit.blockers.map(b => b.id);
    assert.ok(ids.includes('unclassified:POST /api/x/toegangscode'), 'onbekende credentialroute blokkeert');
    assert.ok(ids.includes('unclassified:POST /api/x/bekend'), 'een door de router opgelost dynamisch pad wordt gekeurd');
    assert.ok(ids.includes('unparsed-route:server/x.js:5'), 'een dynamisch pad dat niemand kent blokkeert');
    assert.equal(ids.filter(x => x.startsWith('unparsed-route:')).length, 1, 'commentaar en de verklaarde aanroep blokkeren niet');
    assert.ok(!ids.some(x => /api\/y\/iets|x\/lijst/.test(x)), 'commentaar maakt geen route en geen kandidaat');
    assert.ok(uit.fouten.some(f => /proef\.leeg: geen_credential/.test(f)), 'geen_credential zonder reden is een fout');
    assert.ok(uit.fouten.some(f => /app\.get\(weg, h\);: deze aanroep bestaat niet meer/.test(f)), 'een verouderde verklaring is een fout');
    assert.ok(!uit.fouten.some(f => /bundelPad/.test(f)), 'de geldige verklaring is geen fout');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
