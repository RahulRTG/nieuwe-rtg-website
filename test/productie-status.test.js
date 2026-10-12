'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { beoordeel, hoortBij } = require('../scripts/productie-status');
const geld = require('../server/config/productie-geld');
const pgLijst = require('../scripts/lib/pg-toetslijst');
const external = require('../server/config/external-release');

const COMMIT = 'a'.repeat(40);
function groen() {
  const bron = { commit: COMMIT, boomVuil: false };
  const suiteVerwachting = { bestanden: 1420, bestandenSha256: 'c'.repeat(64) };
  const schermVerwachting = { bestanden: 203, bestandenSha256: 'd'.repeat(64) };
  return {
    commit: COMMIT,
    codeSchoon: true,
    suiteVerwachting,
    schermVerwachting,
    suite: { stempel: bron, gemeten: { volledig: true, groen: true, afsluitcode: 0,
      tapVolledig:true, tests:4200, geslaagdeTests:4200, mislukt:0, geannuleerd:0,
      overgeslagen:0, todo:0, bestanden: suiteVerwachting.bestanden,
      bestandenSha256: suiteVerwachting.bestandenSha256 } },
    schermsuite: { formaat: 'rtg-schermsuite-bewijs-v1', geslaagd: true,
      bron: { ...bron, commit: COMMIT }, afsluitcode: 0, tests: 900, mislukt: 0,
      geannuleerd: 0, overgeslagen: 0, todo: 0, ...schermVerwachting },
    pg: { formaat: 'rtg-pg-bewijs-v1', geslaagd: true, tapVolledig:true,
      bron: { ...bron, commit: COMMIT }, bestanden: pgLijst.TOETSEN.length,
      tests:37, mislukt:0, geannuleerd:0, overgeslagen:0, todo:0,
      toetslijstSha256: pgLijst.toetslijstSha256 },
    releaseGate: { geslaagd: true, bron, controles: [
      'Bron- en securityregels', 'Accountschrijfgrens', 'Servicebevoegdheden', 'Codecredentialregister', 'Mutatiecontracten',
      'Dependency-audit', 'Backup en herstel', 'Releasebewijs terugverifiëren'
    ].map(naam => ({ naam, geslaagd: true })) },
    staging: { geslaagd: true, bron, tijdelijkeDataVerwijderd: true,
      controles: Object.fromEntries(['schermen', 'spelers', 'gameplay', 'economie',
        'belasting', 'failover', 'sentinel'].map(k => [k, { ok: true }])) },
    golive: { geslaagd: true, blokkers: 0, bron,
      accounts: { code:'PG_ACCOUNTS_ATOMAIR_BEVESTIGD', gereed:true,
        transactioneel:true, productieMutaties:'duurzaam', vereist:'gedeelde-pg-requesttransactie' },
      geld: { inkomendGeconfigureerd: true, uitgaandGeconfigureerd: true,
        foundationRekeningGeconfigureerd: true },
      redis: { ok:true, tweeInstanties:true, pubsub:true, atomischeRateLimit:true,
        toegestaan:1, geweigerd:1, teller:2, opgeruimd:true, doelSha256:'6'.repeat(64) },
      gedeeldeMedia: { ok:true, tweeInstanties:true, verwijderd:true, bytes:96,
        sha256:'7'.repeat(64), doelSha256:'8'.repeat(64) },
      alarmering: { ok:true, status:204, doelSha256:'9'.repeat(64) },
      foundation: { aangevraagd:false, vrijgegeven:false, reden:'standaard-gesloten' },
      vrijgave: { ok:true, modus:'baseline', baseline:'V1', bron:'proef', fouten:[], regels:[] },
      geldMotor: { modus: 'motor', bereikbaar: true, native: ['pay-grootboek', 'bank-grootboek'],
        verwachtGenesis:'g-0123456789abcdef0123456789abcdef',
        duurzaam:{ gereed:true, snapshotGeldig:true, snapshotGeladen:true, versleuteld:true,
          algoritme:'XChaCha20-Poly1305', genesisId:'g-0123456789abcdef0123456789abcdef', keyId:'k-1',
          huidigeRevisie:7, laatsteDuurzameRevisie:7, laatsteSchrijfFout:null },
        bank:{ ok:true, klopt:true, som:0, vingerafdruk:'bank-v1' } } },
    bronReleaseBewijs: { formaat:'rtg-bron-release-bewijs-v1', commit:COMMIT,
      boom:'f'.repeat(40), bestandAantal:100, inventarisSha256:'a'.repeat(64) },
    releaseBewijs: { formaat: 'rtg-release-bewijs-v1', bron: { commit: COMMIT, gewijzigd: false },
      inhoudSha256: 'b'.repeat(64) },
    externControle: { ok:true, reden:'ondertekend-bewijs-geldig', commit:COMMIT,
      dossierSha256:'1'.repeat(64), handtekeningSha256:'2'.repeat(64),
      sleutelSha256:'3'.repeat(64), moneyMode:'LIVE',
      bewijsBestanden:external.ALLE_CONTROLES.map(controle => ({
        controle, bestand:controle + '.bewijs', sha256:'e'.repeat(64), bytes:123
      })), foundation:{ vrijgave:'GESLOTEN', leeftijdscontrole:'NIET_VRIJGEGEVEN',
        moderatie:'NIET_VRIJGEGEVEN' } },
    kandidaatControle: { ok:true, commit:COMMIT, bewijsSha256:'4'.repeat(64),
      image:kandidaatDeel('app'), backup:kandidaatDeel('backup') }
  };
}

function kandidaatDeel(naam) {
  const digest = 'sha256:' + (naam === 'app' ? '5' : '6').repeat(64);
  const soort = naam === 'app' ? 'candidate-' : 'candidate-backup-';
  const verwijzing = 'ghcr.io/rtg/app:' + soort + COMMIT.slice(0, 12) + '-123';
  return { id:'sha256:' + (naam === 'app' ? '7' : '8').repeat(64), digest, verwijzing,
    immutable:verwijzing + '@' + digest, herkomstSha256:'9'.repeat(64), sbomSha256:'a'.repeat(64) };
}

function nativeGroen() {
  const v = groen(); v.artifactSoort = 'native';
  v.kandidaatControle = { ok:true, soort:'native', commit:COMMIT, bewijsSha256:'4'.repeat(64),
    artifact:{ platform:'darwin', arch:'arm64', digest:'sha256:' + '5'.repeat(64), manifestSha256:'6'.repeat(64),
      runtimeProofSha256:'7'.repeat(64), attestationSha256:'8'.repeat(64) },
    rollback:{ previousDigest:'sha256:' + '9'.repeat(64), proofSha256:'a'.repeat(64), externalEvidenceBound:true } };
  return v;
}
test('native kandidaat vervangt alleen de artifactpoort; alle productiegates blijven vereist', () => {
  assert.equal(beoordeel(nativeGroen()).status, 'READY');
  for (const field of ['suite', 'schermsuite', 'pg', 'releaseGate', 'staging', 'golive', 'externControle']) {
    const v = nativeGroen(); v[field] = null;
    assert.equal(beoordeel(v).status, 'BLOCKED', field);
  }
  const money = nativeGroen(); money.golive.geld.inkomendGeconfigureerd = false;
  assert.equal(beoordeel(money).status, 'BLOCKED');
});
test('native runtimeherstart, onbekende artifactsoort en onbeoordeelde rollback geven geen READY', () => {
  const same = nativeGroen(); same.kandidaatControle.rollback.previousDigest = same.kandidaatControle.artifact.digest;
  assert.equal(beoordeel(same).status, 'BLOCKED');
  const unknown = groen(); unknown.artifactSoort = 'anything';
  assert.equal(beoordeel(unknown).status, 'BLOCKED');
  const unsigned = nativeGroen(); unsigned.kandidaatControle.rollback.externalEvidenceBound = false;
  assert.equal(beoordeel(unsigned).status, 'BLOCKED');
});

test('alleen vier verse groene poorten op exact dezelfde code geven READY', () => {
  const uit = beoordeel(groen());
  assert.deepEqual(uit, { status: 'READY', blokkades: [], zonderRail: false });
  assert.equal(hoortBij(COMMIT, COMMIT.slice(0, 7)), true);
  assert.equal(hoortBij(COMMIT, 'abc'), false, 'een te korte stempel is geen commitbewijs');
});

test('dirty code, stale suite en een ontbrekende controle kunnen niet worden weggemiddeld', () => {
  const invoer = groen();
  invoer.codeSchoon = false;
  invoer.suite.stempel.commit = 'c'.repeat(9);
  invoer.releaseGate.controles = invoer.releaseGate.controles.filter(x => x.naam !== 'Servicebevoegdheden');
  const uit = beoordeel(invoer);
  assert.equal(uit.status, 'BLOCKED');
  assert.ok(uit.blokkades.some(x => /code wijkt af/.test(x)));
  assert.ok(uit.blokkades.some(x => /suite hoort niet/.test(x)));
  assert.ok(uit.blokkades.some(x => /Servicebevoegdheden/.test(x)));
});

test('gesloten accountwrites zijn een machineleesbare releaseblokkade, de transactionele stand niet', () => {
  /* De rode kant blijft beproefd met de vorm die duurzaamheid.js teruggeeft als
     het deelnemersprotocol ontbreekt; de groene kant is de echte releaseStand. */
  const invoer = groen();
  invoer.golive.accounts = { code: 'PG_ACCOUNTS_ATOMAIR_ONTBREEKT', gereed: false, transactioneel: false,
    productieMutaties: 'gesloten', vereist: 'gedeelde-pg-requesttransactie' };
  const uit = beoordeel(invoer);
  assert.equal(uit.status, 'BLOCKED');
  assert.ok(uit.blokkades.some(x => /Accountmutaties.*PostgreSQL-requesttransactie/.test(x)));
  const echt = groen();
  echt.golive.accounts = require('../server/accounts/duurzaamheid').releaseStand();
  assert.ok(!beoordeel(echt).blokkades.some(x => /Accountmutaties/.test(x)),
    'de transactionele accountlaag blokkeert de release niet');
});

test('een groene selectie of een suite van vóór een nieuw testbestand is nooit volledig bewijs', () => {
  const invoer = groen();
  invoer.suite.gemeten.volledig = false;
  invoer.suite.gemeten.bestanden -= 1;
  const uit = beoordeel(invoer);
  assert.equal(uit.status, 'BLOCKED');
  assert.ok(uit.blokkades.some(x => /volledige ronde/.test(x)));
  assert.ok(uit.blokkades.some(x => /exact alle huidige testbestanden/.test(x)));
});

test('exitcode nul met een skip, todo of ontbrekende TAP-samenvatting is geen suitebewijs', () => {
  for (const verander of [
    g => { g.overgeslagen = 1; },
    g => { g.todo = 1; },
    g => { g.tapVolledig = false; }
  ]) {
    const invoer = groen();
    verander(invoer.suite.gemeten);
    invoer.suite.gemeten.groen = true;
    const uit = beoordeel(invoer);
    assert.equal(uit.status, 'BLOCKED');
    assert.ok(uit.blokkades.some(x => /TAP-telling.*skips\/todo/.test(x)));
  }
});

test('een schermsuite met een skip, oude inhoud of alleen een commitprefix blijft rood', () => {
  const invoer = groen();
  invoer.schermsuite.overgeslagen = 1;
  invoer.schermsuite.bestandenSha256 = 'e'.repeat(64);
  invoer.schermsuite.bron.commit = COMMIT.slice(0, 12);
  const uit = beoordeel(invoer);
  assert.equal(uit.status, 'BLOCKED');
  assert.ok(uit.blokkades.some(x => /nul overgeslagen/.test(x)));
  assert.ok(uit.blokkades.some(x => /exact bij deze commit/.test(x)));
  assert.ok(uit.blokkades.some(x => /exact alle huidige \.e2e/.test(x)));
});

test('PostgreSQL zonder Redis of met een ingekorte bestandslijst blijft rood', () => {
  const invoer = groen();
  invoer.pg.overgeslagen = 1;
  invoer.pg.bestanden -= 1;
  const uit = beoordeel(invoer);
  assert.equal(uit.status, 'BLOCKED');
  assert.ok(uit.blokkades.some(x => /niet volledig groen/.test(x)));
  assert.ok(uit.blokkades.some(x => /exact de verplichte bestanden/.test(x)));
});

test('config alleen is geen bewijs voor gedeelde media of externe alarmering', () => {
  const invoer = groen();
  invoer.golive.gedeeldeMedia = { ok:true };
  invoer.golive.alarmering = { ok:false, status:500 };
  const uit = beoordeel(invoer);
  assert.equal(uit.status, 'BLOCKED');
  assert.ok(uit.blokkades.some(x => /Gedeelde media/.test(x)));
  assert.ok(uit.blokkades.some(x => /foutalarmering/.test(x)));
});

test('een Redis-PING zonder pubsub en atomische limiter is geen operationeel bewijs', () => {
  const invoer = groen();
  invoer.golive.redis = { ok:true, ping:'PONG' };
  const uit = beoordeel(invoer);
  assert.equal(uit.status, 'BLOCKED');
  assert.ok(uit.blokkades.some(x => /Redis pub\/sub/.test(x)));
});

test('geld-in zonder payout en settlement blijft P2 BLOCKED', () => {
  const invoer = groen();
  invoer.golive.geld.uitgaandGeconfigureerd = false;
  invoer.golive.geld.foundationRekeningGeconfigureerd = false;
  const uit = beoordeel(invoer);
  assert.equal(uit.status, 'BLOCKED');
  assert.ok(uit.blokkades.some(x => /uitbetaalrail/.test(x)));
  assert.ok(uit.blokkades.some(x => /Foundation-settlement/.test(x)));
});

test('echte geldrails met JS-schaduw of een onbereikbare motor blijven P2 BLOCKED', () => {
  const invoer = groen();
  invoer.golive.geldMotor = { modus: 'schaduw', bereikbaar: false, native: [] };
  const uit = beoordeel(invoer);
  assert.equal(uit.status, 'BLOCKED');
  assert.ok(uit.blokkades.some(x => /duurzame geldmotor/.test(x)));
});

test('een niet-geladen of niet-versleutelde geldsnapshot kan nooit READY zijn', () => {
  for (const wijzig of [
    d => { d.snapshotGeladen = false; },
    d => { d.versleuteld = false; },
    d => { d.genesisId = null; },
    d => { d.laatsteDuurzameRevisie--; }
  ]) {
    const invoer = groen(); wijzig(invoer.golive.geldMotor.duurzaam);
    const uit = beoordeel(invoer);
    assert.equal(uit.status, 'BLOCKED');
    assert.ok(uit.blokkades.some(x => /duurzame geldmotor/.test(x)));
  }
});

test('externe productievoorwaarden vragen bewijs en geen vinkje zonder bron', () => {
  const invoer = groen();
  invoer.externControle = { ok:false, reden:'handtekening-klopt-niet' };
  const uit = beoordeel(invoer);
  assert.equal(uit.status, 'BLOCKED');
  assert.ok(uit.blokkades.some(x => /Ed25519/.test(x)));
  assert.ok(uit.blokkades.some(x => /handtekening-klopt-niet/.test(x)));
});

test('gesloten minderjarigenfuncties blokkeren de volwassen release niet', () => {
  const invoer = groen();
  assert.equal(beoordeel(invoer).status, 'READY');
  invoer.golive.foundation = { aangevraagd:true, vrijgegeven:false, reden:'voorwaarden-niet-pass' };
  const uit = beoordeel(invoer);
  assert.equal(uit.status, 'BLOCKED');
  assert.ok(uit.blokkades.some(x => /Foundation-functies.*zonder volledige externe vrijgave/.test(x)));
});

test('open Foundation vereist servergate plus leeftijds- en moderatiebewijs', () => {
  const invoer = groen();
  invoer.externControle.foundation = { vrijgave:'OPEN', leeftijdscontrole:'PASS', moderatie:'PASS' };
  invoer.golive.foundation = { aangevraagd:true, vrijgegeven:true, reden:'ondertekend-bewijs-geldig' };
  assert.equal(beoordeel(invoer).status, 'READY');
  invoer.externControle.foundation.moderatie = 'OPEN';
  assert.equal(beoordeel(invoer).status, 'BLOCKED');
});

test('een geldig ogend rauw dossier of losse PASS-velden hebben nooit gezag', () => {
  const invoer = groen();
  invoer.extern = { formaat:external.FORMAAT, geslaagd:true, commit:COMMIT,
    controles:Object.fromEntries(external.ALLE_CONTROLES.map(naam => [naam, { status:'PASS' }])) };
  invoer.externControle = { ok:true, commit:COMMIT };
  const uit = beoordeel(invoer);
  assert.equal(uit.status, 'BLOCKED');
  assert.ok(uit.blokkades.some(x => /gemounte bewijsbytes/.test(x)));
});

test('READY vereist de getekende CI-kandidaat en niet alleen groene hostbewijzen', () => {
  const invoer = groen();
  invoer.kandidaatControle = { ok:false, reden:'SBOM ontbreekt' };
  const uit = beoordeel(invoer);
  assert.equal(uit.status, 'BLOCKED');
  assert.ok(uit.blokkades.some(x => /CI-kandidaat.*SBOM/.test(x)));
});

test('een beweegbare of handmatig benoemde imagetag is geen releasekandidaat', () => {
  const invoer = groen();
  invoer.kandidaatControle.image.verwijzing = 'ghcr.io/rtg/app:latest';
  invoer.kandidaatControle.image.immutable = invoer.kandidaatControle.image.verwijzing + '@' +
    invoer.kandidaatControle.image.digest;
  assert.equal(beoordeel(invoer).status, 'BLOCKED');
});

test('de huidige configuratiemeter noemt een betaalsleutel nooit een uitbetaalrail', () => {
  const stand = geld.stand({ STRIPE_SECRET_KEY: 'sk_live_x', RTF_IBAN: 'NL11TEST0123456789' });
  assert.equal(stand.inkomendGeconfigureerd, true);
  assert.equal(stand.uitgaandGeconfigureerd, false);
  assert.equal(stand.foundationRekeningGeconfigureerd, false,
    'een IBAN-achtig voorbeeld is nog geen geldige settlementconfiguratie');
  assert.match(stand.uitgaandWaarom, /geen productie-uitbetaalprovider/);
});

test('Foundation-settlement vraagt een echt mod-97-geldig IBAN', () => {
  assert.equal(geld.geldigIban('NL91 ABNA 0417 1643 00'), true);
  assert.equal(geld.geldigIban('NL91 ABNA 0417 1643 01'), false);
  assert.equal(geld.geldigIban('ingevuld'), false);
});

/* DE BEPERKTE RELEASE ZONDER KAARTRAIL (besluit B2a, RELEASEKANDIDAAT.md).
   Alles moet even groen zijn, alleen de rails en de geldmotor vallen weg -- en
   de uitkomst is dan nooit READY maar READY_ZONDER_RAIL. */
function zonderRail() {
  const invoer = groen();
  invoer.golive.geld = { betalingenUit: true, releaseZonderRail: true,
    inkomendGeconfigureerd: false, uitgaandGeconfigureerd: false, foundationRekeningGeconfigureerd: true };
  delete invoer.golive.geldMotor;
  invoer.golive.vrijgave = { ok:true, modus:'zonder-rail', baseline:'V1', bron:'proef', fouten:[], regels:[] };
  invoer.externControle.moneyMode = 'RAIL_DISABLED';
  return invoer;
}

test('zonder kaartrail, maar verder alles groen: READY_ZONDER_RAIL en nooit READY', () => {
  const uit = beoordeel(zonderRail());
  assert.equal(uit.status, 'READY_ZONDER_RAIL');
  assert.deepEqual(uit.blokkades, []);
});

test('money-bewijsmodus moet exact overeenkomen met READY of READY_ZONDER_RAIL', () => {
  const beperktMetLive = zonderRail(); beperktMetLive.externControle.moneyMode = 'LIVE';
  assert.equal(beoordeel(beperktMetLive).status, 'BLOCKED');
  const volledigMetUit = groen(); volledigMetUit.externControle.moneyMode = 'RAIL_DISABLED';
  assert.equal(beoordeel(volledigMetUit).status, 'BLOCKED');
});

test('de beperkte stand wist geen enkele andere blokkade', () => {
  const invoer = zonderRail();
  invoer.golive.geld.foundationRekeningGeconfigureerd = false;
  invoer.releaseGate.geslaagd = false;
  const uit = beoordeel(invoer);
  assert.equal(uit.status, 'BLOCKED');
  assert.ok(uit.blokkades.some(x => /Foundation-settlement/.test(x)));
});

test('een vlag zonder dat betalen echt uit staat, is geen beperkte release', () => {
  const invoer = zonderRail();
  invoer.golive.geld.betalingenUit = false;
  const uit = beoordeel(invoer);
  assert.equal(uit.status, 'BLOCKED');
  assert.ok(uit.blokkades.some(x => /inkomende betaalprovider/.test(x)));
  assert.ok(uit.blokkades.some(x => /geldrails zijn niet aan de bereikbare duurzame geldmotor/.test(x)));
});

test('de geldstand leidt de beperkte release alleen af uit BEIDE vlaggen', () => {
  const { stand } = require('../server/config/productie-geld');
  assert.equal(stand({ RTG_BETALEN_UIT: '1', RTG_RELEASE_ZONDER_RAIL: '1' }).releaseZonderRail, true);
  assert.equal(stand({ RTG_RELEASE_ZONDER_RAIL: '1' }).releaseZonderRail, false);
  assert.equal(stand({ RTG_BETALEN_UIT: '1' }).releaseZonderRail, false);
});

/* DE V1-VRIJGAVEBASELINE IN DE RELEASE-UITSPRAAK (scripts/lib/vrijgave-baseline.js).
   Een go-livebewijs zonder het blok, met een gezakte baseline of met het
   verkeerde soort oordeel voor de releasestand, maakt de release nooit READY. */
test('de V1-vrijgavebaseline: ontbreekt het blok, zakt hij, of past de modus niet, dan BLOCKED', () => {
  const zonderBlok = groen(); delete zonderBlok.golive.vrijgave;
  assert.equal(beoordeel(zonderBlok).status, 'BLOCKED', 'een go-livebewijs van voor de baseline las als gehaald');
  const gezakt = groen();
  gezakt.golive.vrijgave = { ok:false, modus:'baseline', baseline:'V1', bron:'proef',
    fouten:['geld.inkomend: hoort in de V1-baseline beschikbaar te zijn, maar niet: geverifieerd'], regels:[] };
  const g = beoordeel(gezakt);
  assert.equal(g.status, 'BLOCKED');
  assert.ok(g.blokkades.some(b => /V1-vrijgavebaseline/.test(b)), g.blokkades.join(' | '));
  const okMaarFouten = groen(); okMaarFouten.golive.vrijgave.fouten = ['een fout'];
  assert.equal(beoordeel(okMaarFouten).status, 'BLOCKED', 'ok:true met een fout erin opende');
  const verkeerdeModus = zonderRail(); verkeerdeModus.golive.vrijgave.modus = 'baseline';
  assert.equal(beoordeel(verkeerdeModus).status, 'BLOCKED', 'een baselineoordeel telde voor een release zonder rail');
  const volledigMetRailModus = groen(); volledigMetRailModus.golive.vrijgave.modus = 'zonder-rail';
  assert.equal(beoordeel(volledigMetRailModus).status, 'BLOCKED', 'een zonder-railoordeel telde voor READY');
});
