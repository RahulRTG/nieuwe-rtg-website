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
      sleutelSha256:'3'.repeat(64), bewijsBestanden:external.ALLE_CONTROLES.map(controle => ({
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

test('alleen vier verse groene poorten op exact dezelfde code geven READY', () => {
  const uit = beoordeel(groen());
  assert.deepEqual(uit, { status: 'READY', blokkades: [] });
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

test('tijdelijk gesloten accountwrites blijven een machineleesbare releaseblokkade', () => {
  const invoer = groen();
  invoer.golive.accounts = require('../server/accounts/duurzaamheid').releaseStand();
  const uit = beoordeel(invoer);
  assert.equal(uit.status, 'BLOCKED');
  assert.ok(uit.blokkades.some(x => /Accountmutaties.*PostgreSQL-requesttransactie/.test(x)));
  assert.equal(invoer.golive.accounts.code, 'PG_ACCOUNTS_ATOMAIR_ONTBREEKT');
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
