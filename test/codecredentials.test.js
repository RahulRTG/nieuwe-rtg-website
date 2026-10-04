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
  /* Sinds 29 september 2026 (B14-B17) is er geen deur meer `remaining`. Wat niet
     gemigreerd is staat er nog, als `closed` met zijn eigen productiesluiting:
     een onvolwassen deur wordt dicht gezet en niet weggepoetst. */
  assert.ok(uit.telling.closed > 0, 'onvolwassen deuren worden niet weggepoetst');
  assert.equal(uit.telling.migrated + uit.telling.closed + uit.telling.remaining,
    register.deuren.length, 'elke deur heeft een stand');
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
  // office.gedeelde_kantoorcode is in productie gesloten (B10), identity.sso_client_secret per tenant
  // versleuteld (B16), en partnerkanaal (B14), link.capability_aanvaarden (B15) en beide
  // Foundation-tokens (B17) gemigreerd: zie de toetsen hieronder
  const echte = ['travelos.ov_incheckcode',
    'mode.bezorgcode', 'festivalos.toegangspas',
    'rtfos.activiteit_incheckcode'];
  // gemigreerd op 27 september 2026 (B9, de vier restdeuren): zie de toets hieronder
  const restdeuren = new Set(['travelos.ov_incheckcode', 'mode.bezorgcode', 'festivalos.toegangspas',
    'rtfos.activiteit_incheckcode']);
  for (const id of echte.filter(x => !restdeuren.has(x))) {
    const d = register.deuren.find(x => x.id === id);
    assert.ok(d, id + ' hoort geregistreerd te zijn');
    assert.equal(d.status, 'remaining', id + ' is niet gemigreerd');
    assert.ok(Array.isArray(d.huidige_risicos) && d.huidige_risicos.length, id + ' noemt zijn risico');
    assert.ok(uit.blockers.some(x => x.id === id), id + ' hoort de release te blokkeren');
    for (const route of poort.effectieveRoutes(d))
      assert.ok(poort.REQUIRED_ROUTES.includes(route), route + ' hoort bewaakt te zijn');
  }
});

/* B14 (29 september 2026): het partnerkanaal is gesplitst. De personeelscode is
   een gemigreerde credential per medewerker; de partnercode een openbare
   attributie die niets opent. */
test('het partnerkanaal is gesplitst: personeelscode gemigreerd, partnercode een openbare attributie', () => {
  const register = poort.lees();
  const uit = poort.controleer(register);
  const d = register.deuren.find(x => x.id === 'partnerkanaal.personeels_en_partnercode');
  assert.equal(d.status, 'migrated');
  assert.equal(d.release_blocker, false);
  assert.ok(!uit.blockers.some(x => x.id === d.id), 'blokkeert niet meer');
  for (const c of poort.CONTROLES) assert.equal(d.controls[c], true, c);
  assert.equal(d.controls.entropy_bits, 128);
  assert.ok(d.bewijs.includes('test/partnerpersoneelscode.pg.test.js'), 'de atomaire claim over twee instances');
  for (const route of poort.effectieveRoutes(d))
    assert.ok(poort.REQUIRED_ROUTES.includes(route), route + ' hoort bewaakt te zijn');
  const a = register.deuren.find(x => x.id === 'partnerkanaal.partnercode_attributie');
  assert.equal(a.classificatie, 'public_identifier');
  assert.equal(a.status, 'closed');
  assert.ok(a.routes.includes('POST /api/partner'));
  assert.ok(String(a.notitie).length >= 40);
});

/* B15 (29 september 2026): de RTG Link-drager is gemigreerd -- 128 bits, hash-only,
   een eenmalige claim in een collectietransactie -- en daarom is ook zijn
   productiegrendel weg. Beide helften horen samen: een gemigreerde deur die in
   productie nog dicht staat liegt niet, maar een open deur die niet gemigreerd is wel. */
test('de Link-drager is gemigreerd met alle controls, en de grendel is eraf', () => {
  const register = poort.lees();
  const uit = poort.controleer(register);
  const d = register.deuren.find(x => x.id === 'link.capability_aanvaarden');
  assert.equal(d.status, 'migrated');
  assert.equal(d.release_blocker, false);
  assert.ok(!uit.blockers.some(x => x.id === d.id), 'blokkeert niet meer');
  assert.equal(d.controls.entropy_bits, 128);
  for (const c of ['hash_only_at_rest', 'issuer_doel_scope', 'issued_at_expires_at', 'max_gebruik_gebruik',
    'server_side_intrekken_roteren', 'constant_time_lookup', 'atomic_claim', 'raw_once'])
    assert.equal(d.controls[c], true, c);
  for (const t of ['test/linkcap-credential.test.js', 'test/linkcap-credential.pg.test.js', 'test/linkcap-productie.test.js'])
    assert.ok(d.bewijs.includes(t), t);
  assert.equal(d.huidige_risicos, undefined, 'een gemigreerde deur noemt geen open risico meer');
  const grendel = require('../server/middleware/money-credential-productiepoort');
  assert.equal([...grendel.EXACT.values()].includes(d.id), false, 'niet meer in de HTTP-grendel');
  const kassacode = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'server/kern/pay/kassacode.js'), 'utf8');
  assert.doesNotMatch(kassacode, /blokkade\(/, 'en kern/pay/kassacode.js weigert niet meer zelf');
  for (const route of poort.effectieveRoutes(d)) assert.ok(poort.REQUIRED_ROUTES.includes(route), route);
});

/* B17 (29 september 2026): de lescredentials van onderwijs zijn gemigreerd. De deur
   draagt alle controls, blokkeert niet meer, zijn nieuwe beheerroutes staan in de
   inventaris, en de lesfamilie is uit NOG_GESLOTEN gehaald. */
test('de lescredentials van onderwijs zijn gemigreerd en staan niet meer blijvend dicht', () => {
  const register = poort.lees();
  const uit = poort.controleer(register);
  const d = register.deuren.find(x => x.id === 'foundation.onderwijs_les_tokens');
  assert.equal(d.status, 'migrated');
  assert.equal(d.release_blocker, false);
  assert.equal(d.controls.entropy_bits, 128);
  for (const c of poort.CONTROLES) assert.equal(d.controls[c], true, c);
  assert.ok(!uit.blockers.some(x => x.id === d.id), 'blokkeert niet meer');
  assert.ok(!uit.fouten.some(f => f.startsWith(d.id)), 'geen fout op de deur');
  assert.ok(d.bewijs.includes('test/foundation-lescredential.pg.test.js'), 'de claim is over twee instances beproefd');
  const vrijgave = require('../server/middleware/foundation-productiepoort');
  for (const route of poort.effectieveRoutes(d)) {
    assert.ok(poort.REQUIRED_ROUTES.includes(route), route + ' hoort bewaakt te zijn');
    const [methode, pad] = route.split(' ');
    assert.equal(vrijgave.isNogGeslotenCredentialroute(methode, pad, {}), false, route + ' staat nog in NOG_GESLOTEN');
  }
});

/* B17 (29 september 2026): het gezinsprofieltoken is gemigreerd. B18 (4 oktober
   2026): de gezinsdeur zelf ook -- de gezinscode is 128 bits en hash-only, en de
   social-stream opent met een eenmalig stroomticket. Geen van beide staat nog in
   NOG_GESLOTEN, en de controls zeggen het. */
test('het gezinsprofieltoken en de gezinsdeur zelf zijn gemigreerd', () => {
  const register = poort.lees();
  const uit = poort.controleer(register);
  const d = register.deuren.find(x => x.id === 'foundation.family_profile_token_buiten_harde_poort');
  assert.equal(d.status, 'migrated');
  assert.equal(d.release_blocker, false);
  assert.ok(!uit.blockers.some(x => x.id === d.id), 'blokkeert niet meer');
  for (const b of ['test/gezinstoken.test.js', 'test/gezinssessie.test.js',
    'test/foundation-gezinstoken-productie.test.js', 'test/gezinsuitnodiging.pg.test.js'])
    assert.ok(d.bewijs.includes(b), b);
  assert.equal(d.controls.gezinsdeur_zelf_gemigreerd, true, 'de gezinsdeur is sinds B18 gemigreerd, en dat staat er');
  assert.ok(String(d.notitie).length >= 200);
  const vrijgave = require('../server/middleware/foundation-productiepoort');
  for (const route of poort.effectieveRoutes(d)) {
    const [methode, pad] = route.split(' ');
    assert.equal(vrijgave.isNogGeslotenCredentialroute(methode, pad, {}), false, route + ' hoort niet meer in NOG_GESLOTEN');
  }
  const deur = register.deuren.find(x => x.id === 'foundation.family_profile_access');
  assert.equal(deur.status, 'migrated');
  assert.equal(deur.release_blocker, false);
  assert.ok(!uit.blockers.some(x => x.id === deur.id));
  assert.equal(deur.controls.entropy_bits, 128);
  for (const c of ['geen_sessie_in_url', 'oude_zes_tekencode_opent_niets', 'rem_per_ip_en_per_gezin',
    'stroomticket_eenmalig_en_per_kanaal', 'sessie_zeven_dagen_verlengen_met_passkey'])
    assert.equal(deur.controls[c], true, c);
  for (const b of ['test/gezinsdeur.test.js', 'test/gezinscode.test.js', 'test/gezinsuitnodiging.pg.test.js'])
    assert.ok(deur.bewijs.includes(b), b);
  assert.ok(Array.isArray(deur.restrisico) && deur.restrisico.length >= 3, 'wat niet af is, staat er');
  for (const route of ['POST /api/foundation/gezin/maak', 'POST /api/foundation/gezin/inloggen',
    'POST /api/foundation/gezin/profiel/kies', 'POST /api/foundation/gezin/code/roteer',
    'POST /api/foundation/gezin/stroom/ticket', 'GET /api/foundation/gezin/:code/kanaal', 'GET /api/rtf/social/stream',
    'POST /api/foundation/gezin/sessie/verleng', 'POST /api/rtf/gezin/passkey'])
    assert.ok(poort.REQUIRED_ROUTES.includes(route) && poort.effectieveRoutes(deur).includes(route), route + ' hoort bewaakt te zijn');
  for (const route of poort.effectieveRoutes(deur)) {
    const [methode, pad] = route.split(' ');
    assert.equal(vrijgave.isNogGeslotenCredentialroute(methode, pad, {}), false, route + ' staat nog in NOG_GESLOTEN');
  }
  const { ROUTES } = require('../server/lib/eenmalig-geheim-routes');
  for (const route of ['POST /api/foundation/gezin/maak', 'POST /api/foundation/gezin/code/roteer',
    'POST /api/foundation/gezin/stroom/ticket', 'POST /api/foundation/gezin/sessie/verleng'])
    assert.ok(ROUTES.has(route), route + ' staat buiten elke antwoordcache');
  /* Fail-closed: zet de deur terug op closed of haal een control weg, en de proef ziet het. */
  const terug = JSON.parse(JSON.stringify(register));
  terug.deuren.find(x => x.id === deur.id).controls.hash_only_at_rest = false;
  assert.ok(poort.controleer(terug).fouten.some(f => f.includes('foundation.family_profile_access') && f.includes('hash_only_at_rest')));
});

/* B10 (27 september 2026): de gedeelde kantoorcode is in productie gesloten. Dat
   is geen migratie van de code -- die blijft buiten productie gedeeld en niet
   hash-only, en dat staat er eerlijk bij -- maar de deur opent in productie niets. */
test('de gedeelde kantoorcode is in productie gesloten, met eerlijke controls en een proef op een productieserver', () => {
  const register = poort.lees();
  const uit = poort.controleer(register);
  const d = register.deuren.find(x => x.id === 'office.gedeelde_kantoorcode');
  assert.equal(d.status, 'closed');
  assert.equal(d.release_blocker, false);
  assert.ok(!uit.blockers.some(x => x.id === d.id), 'blokkeert niet meer');
  assert.ok(d.bewijs.includes('test/kantoordeur-productie.test.js'), 'bewezen op een echte productieserver');
  for (const c of ['productie_code_opent_niets', 'productie_passkey_per_kantoorsessie', 'fail_closed_zonder_passkeyconfig'])
    assert.equal(d.controls[c], true, c);
  for (const c of ['code_zelf_hash_only', 'code_zelf_persoonsgebonden'])
    assert.equal(d.controls[c], false, c + ': de code zelf is niet gemigreerd, en dat staat er');
  assert.ok(String(d.notitie).length >= 40);
  const pd = require('../server/kern/kantoor/productiedeur');
  assert.equal(pd.codeDicht({ NODE_ENV: 'production' }).code, pd.CODE_DICHT, 'de bron sluit hem echt');
});

/* B16 (29 september 2026): het SSO-clientgeheim moet omkeerbaar blijven voor de
   tokenruil, dus hash_only en raw_once staan eerlijk op false; de deur is
   gemigreerd naar versleuteling per tenant met verval, rotatie met overlap en
   een inlog die dicht gaat zonder geldig geheim. */
test('het SSO-clientgeheim is per tenant versleuteld, met eerlijke controls en een proef op een productieserver', () => {
  const register = poort.lees();
  const uit = poort.controleer(register);
  const d = register.deuren.find(x => x.id === 'identity.sso_client_secret');
  assert.equal(d.status, 'migrated');
  assert.equal(d.release_blocker, false);
  assert.ok(!uit.blockers.some(x => x.id === d.id), 'blokkeert niet meer');
  assert.ok(d.bewijs.includes('test/sso-clientgeheim-routes.test.js'), 'bewezen op een echte (productie)server');
  for (const c of ['omkeerbaar_versleuteld_per_tenant', 'nooit_terug_via_route', 'issued_at_expires_at',
    'rotatie_met_begrensde_overlap', 'fail_closed_zonder_sleutel', 'fail_closed_inlog_bij_ongeldig_geheim',
    'oude_opslag_herzegeld_bij_laden'])
    assert.equal(d.controls[c], true, c);
  for (const c of ['hash_only_at_rest', 'raw_once'])
    assert.equal(d.controls[c], false, c + ': kan voor een omkeerbaar protocolgeheim niet, en dat staat er');
  for (const route of d.routes) assert.ok(poort.REQUIRED_ROUTES.includes(route), route + ' hoort bewaakt te zijn');
  const { ROUTES } = require('../server/lib/eenmalig-geheim-routes');
  for (const route of d.routes) assert.ok(ROUTES.has(route), route + ' staat buiten elke antwoordcache');
});

test('de vier restdeuren zijn gemigreerd, en de korte bezorgcode alleen met haar grenzen', () => {
  const uit = poort.controleer(poort.lees());
  for (const id of ['travelos.ov_incheckcode', 'mode.bezorgcode', 'festivalos.toegangspas', 'rtfos.activiteit_incheckcode']) {
    const d = poort.lees().deuren.find(x => x.id === id);
    assert.equal(d.status, 'migrated', id);
    assert.ok(!uit.blockers.some(x => x.id === id), id + ' blokkeert niet meer');
    for (const route of d.routes) assert.ok(poort.REQUIRED_ROUTES.includes(route), route + ' hoort bewaakt te zijn');
  }
  assert.equal(poort.lees().deuren.find(x => x.id === 'mode.bezorgcode').controls.entropy_bits, false,
    'vier cijfers halen de 128 bits niet, en dat staat er eerlijk');
  /* Haal een compenserende grens weg, of maak er geld van, en de uitzondering
     vervalt: dan is het weer een gemigreerde credential zonder 128 bits. */
  for (const wijzig of [d => { d.korte_code.rem_met_vergrendeling = false; }, d => { delete d.korte_code; },
    d => { d.korte_code.max_fout = 50; }, d => { d.korte_code.reden = 'kort'; },
    d => { d.classificatie = 'money_credential'; }, d => { d.controls.entropy_bits = 13; }]) {
    const register = JSON.parse(JSON.stringify(poort.lees()));
    wijzig(register.deuren.find(x => x.id === 'mode.bezorgcode'));
    assert.ok(poort.controleer(register).fouten.some(f => f.startsWith('mode.bezorgcode: gemigreerde credential mist minimaal 128-bit')));
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
  assert.ok(uit.blockers.every(x => x.routes.length && x.eigenaar));
  /* Er staat vandaag geen deur meer op `remaining` (B14-B17). Dat mag de regel
     niet leeg maken: een deur die terugvalt naar `remaining` blokkeert weer. */
  const terug = JSON.parse(JSON.stringify(poort.lees()));
  const d = terug.deuren.find(x => x.id === 'foundation.family_profile_token_buiten_harde_poort');
  d.status = 'remaining'; d.release_blocker = true;
  d.huidige_risicos = d.huidige_risicos && d.huidige_risicos.length ? d.huidige_risicos : ['terug naar remaining'];
  assert.ok(poort.controleer(terug).blockers.some(x => x.id === d.id), 'een teruggevallen deur blokkeert de release');
  for (const id of ['pay.tegoedbon', 'pay.kascode_en_vooraf', 'pay.tikcode', 'pay.giftcard_value_code',
    'travelos.activity_ticket_entry', 'travelos.mobility_transport_ticket']) {
    assert.ok(!uit.blockers.some(x => x.id === id), id + ' is gemigreerd (27 september 2026)');
    assert.equal(poort.lees().deuren.find(x => x.id === id).status, 'migrated');
  }
  assert.ok(!uit.blockers.some(x => x.id === 'pay.order_pickup_code'),
    'de afhaalcode is gemigreerd en blokkeert niet meer');
  assert.equal(poort.lees().deuren.find(x => x.id === 'pay.order_pickup_code').status, 'migrated');
  assert.ok(!uit.blockers.some(x => x.id === 'pay.giftcard_value_code'),
    'de cadeaukaart is gemigreerd (27 september 2026) en blokkeert niet meer');
  assert.equal(poort.lees().deuren.find(x => x.id === 'pay.giftcard_value_code').status, 'migrated');
  /* Besluiten B11 en B13 (27 september 2026): de horecabon is gemigreerd, de
     kortingscode van RTG Eten is een promotiecode -- geen geheim, wel begrensd. */
  assert.ok(!uit.blockers.some(x => x.id === 'horeca.bon_en_polsbandsaldo'));
  assert.equal(poort.lees().deuren.find(x => x.id === 'horeca.bon_en_polsbandsaldo').status, 'migrated');
  const promo = poort.lees().deuren.find(x => x.id === 'eten.kortingscode');
  assert.ok(!uit.blockers.some(x => x.id === 'eten.kortingscode'));
  assert.deepEqual([promo.status, promo.classificatie, promo.release_blocker], ['closed', 'public_identifier', false]);
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
    'foundation.les_leraar_en_deelnemer',
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
