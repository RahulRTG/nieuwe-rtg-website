'use strict';

function hoortBij(commit, kort) {
  const c = String(commit || '').toLowerCase();
  const k = String(kort || '').toLowerCase();
  return /^[a-f0-9]{40,64}$/.test(c) && /^[a-f0-9]{7,64}$/.test(k) && c.startsWith(k);
}

function beoordeel(invoer) {
  const { commit, codeSchoon, suite, suiteVerwachting, schermsuite,
    schermVerwachting, pg, releaseGate, staging, golive, bronReleaseBewijs, releaseBewijs,
    externControle, kandidaatControle } = invoer;
  const blokkades = [];
  const eis = (goed, tekst) => { if (!goed) blokkades.push(tekst); };
  eis(/^[a-f0-9]{40,64}$/i.test(String(commit || '')), 'Releasecommit is onbekend.');
  eis(codeSchoon === true, 'De releasecode wijkt af van de commit.');

  eis(!!suite, 'Volledige-suitebewijs ontbreekt.');
  if (suite) {
    eis(String(suite.stempel && suite.stempel.commit) === String(commit || ''),
      'Volledige suite hoort niet exact bij deze commit.');
    eis(suite.stempel && suite.stempel.boomVuil === false, 'Volledige suite is op gewijzigde code gemeten.');
    eis(suite.gemeten && suite.gemeten.groen === true && suite.gemeten.afsluitcode === 0 &&
      suite.gemeten.tapVolledig === true && suite.gemeten.tests > 0 &&
      suite.gemeten.mislukt === 0 && suite.gemeten.geannuleerd === 0 &&
      suite.gemeten.overgeslagen === 0 && suite.gemeten.todo === 0,
    'Volledige suite is niet groen met een volledige TAP-telling en nul skips/todo.');
    eis(suite.gemeten && suite.gemeten.volledig === true, 'Suitebewijs is niet als volledige ronde vastgelegd.');
    eis(!!suiteVerwachting && suite.gemeten &&
      suite.gemeten.bestanden === suiteVerwachting.bestanden &&
      suite.gemeten.bestandenSha256 === suiteVerwachting.bestandenSha256,
    'Suitebewijs omvat niet exact alle huidige testbestanden.');
  }

  eis(!!schermsuite, 'Volledige-schermsuitebewijs ontbreekt.');
  if (schermsuite) {
    eis(schermsuite.formaat === 'rtg-schermsuite-bewijs-v1' && schermsuite.geslaagd === true &&
      schermsuite.afsluitcode === 0 && schermsuite.tests > 0 && schermsuite.mislukt === 0 &&
      schermsuite.geannuleerd === 0 && schermsuite.overgeslagen === 0 && schermsuite.todo === 0,
    'Volledige schermsuite is niet groen met nul overgeslagen tests.');
    eis(String(schermsuite.bron && schermsuite.bron.commit) === String(commit || ''),
      'Schermsuite hoort niet exact bij deze commit.');
    eis(schermsuite.bron && schermsuite.bron.boomVuil === false,
      'Schermsuite is op gewijzigde code gemeten.');
    eis(!!schermVerwachting && schermsuite.bestanden === schermVerwachting.bestanden &&
      schermsuite.bestandenSha256 === schermVerwachting.bestandenSha256,
    'Schermsuite omvat niet exact alle huidige .e2e.js-bestanden.');
  }

  eis(!!pg, 'PostgreSQL/Redis-bewijs ontbreekt.');
  if (pg) {
    const pgLijst = require('./pg-toetslijst');
    eis(pg.geslaagd === true && pg.tapVolledig === true && pg.tests > 0 &&
      pg.mislukt === 0 && pg.geannuleerd === 0 && pg.overgeslagen === 0 && pg.todo === 0,
      'PostgreSQL/Redis-proef is niet volledig groen.');
    eis(String(pg.bron && pg.bron.commit) === String(commit || ''),
      'PostgreSQL/Redis-proef hoort niet exact bij deze commit.');
    eis(pg.bron && pg.bron.boomVuil === false, 'PostgreSQL/Redis-proef is op gewijzigde code gemeten.');
    eis(pg.bestanden === pgLijst.TOETSEN.length && pg.toetslijstSha256 === pgLijst.toetslijstSha256,
      'PostgreSQL/Redis-proef omvat niet exact de verplichte bestanden.');
  }

  eis(!!releaseGate, 'Releasepoortbewijs ontbreekt.');
  if (releaseGate) {
    eis(releaseGate.geslaagd === true, 'Releasepoort is niet groen.');
    eis(String(releaseGate.bron && releaseGate.bron.commit) === String(commit || ''),
      'Releasepoort hoort niet exact bij deze commit.');
    eis(releaseGate.bron && releaseGate.bron.boomVuil === false, 'Releasepoort is op gewijzigde code gemeten.');
    const namen = new Set((releaseGate.controles || []).filter(x => x && x.geslaagd).map(x => x.naam));
    for (const naam of ['Bron- en securityregels', 'Accountschrijfgrens', 'Servicebevoegdheden', 'Codecredentialregister', 'Mutatiecontracten',
      'Dependency-audit', 'Backup en herstel', 'Releasebewijs terugverifiëren'])
      eis(namen.has(naam), 'Releasepoort mist groen bewijs: ' + naam + '.');
  }

  eis(!!staging, 'Stagingbewijs ontbreekt.');
  if (staging) {
    eis(staging.geslaagd === true, 'Stagingrepetitie is niet groen.');
    eis(String(staging.bron && staging.bron.commit) === String(commit || ''),
      'Stagingrepetitie hoort niet exact bij deze commit.');
    eis(staging.bron && staging.bron.boomVuil === false, 'Stagingrepetitie is op gewijzigde code gemeten.');
    eis(staging.tijdelijkeDataVerwijderd === true, 'Staging liet tijdelijke productiegegevens achter.');
    for (const naam of ['schermen', 'spelers', 'gameplay', 'economie', 'belasting', 'failover', 'sentinel'])
      eis(!!(staging.controles && staging.controles[naam]), 'Staging mist controle: ' + naam + '.');
  }

  eis(!!golive, 'Go-livebewijs ontbreekt.');
  if (golive) {
    const uitgangen = require('./golive-uitgangen');
    eis(golive.geslaagd === true && golive.blokkers === 0, 'Go-live heeft nog blokkades.');
    eis(String(golive.bron && golive.bron.commit) === String(commit || ''),
      'Go-live hoort niet exact bij deze commit.');
    eis(golive.bron && golive.bron.boomVuil === false, 'Go-live is op gewijzigde code gemeten.');
    eis(golive.accounts && golive.accounts.gereed === true &&
      golive.accounts.transactioneel === true && golive.accounts.productieMutaties === 'duurzaam',
    'Accountmutaties zijn niet aan dezelfde gedeelde PostgreSQL-requesttransactie gebonden.');
    eis(golive.geld && golive.geld.inkomendGeconfigureerd === true,
      'De echte inkomende betaalprovider is niet geconfigureerd.');
    eis(golive.geld && golive.geld.uitgaandGeconfigureerd === true,
      'Er is geen productie-uitbetaalrail geconfigureerd.');
    eis(golive.geld && golive.geld.foundationRekeningGeconfigureerd === true,
      'De rekening voor Foundation-settlement ontbreekt.');
    eis(uitgangen.redisBewijsGeldig(golive.redis),
      'Redis pub/sub en de atomische instancebrede rate limit zijn niet actief bewezen.');
    eis(uitgangen.mediaBewijsGeldig(golive.gedeeldeMedia),
      'Gedeelde media is niet met put/get/hash/delete over twee instanties bewezen.');
    eis(uitgangen.alarmBewijsGeldig(golive.alarmering),
      'De externe foutalarmering heeft geen actuele 2xx-zelfproef bewezen.');
    eis(golive.geldMotor && golive.geldMotor.modus === 'motor' &&
      golive.geldMotor.bereikbaar === true &&
      ['pay-grootboek', 'bank-grootboek'].every(n => golive.geldMotor.native.includes(n)) &&
      golive.geldMotor.duurzaam && golive.geldMotor.duurzaam.gereed === true &&
      golive.geldMotor.duurzaam.snapshotGeladen === true &&
      golive.geldMotor.duurzaam.snapshotGeldig === true &&
      golive.geldMotor.duurzaam.versleuteld === true &&
      golive.geldMotor.duurzaam.algoritme === 'XChaCha20-Poly1305' &&
      /^g-[a-f0-9]{32}$/.test(String(golive.geldMotor.duurzaam.genesisId || '')) &&
      golive.geldMotor.duurzaam.genesisId === golive.geldMotor.verwachtGenesis &&
      /^[A-Za-z0-9._-]{1,40}$/.test(String(golive.geldMotor.duurzaam.keyId || '')) &&
      Number.isSafeInteger(golive.geldMotor.duurzaam.huidigeRevisie) &&
      golive.geldMotor.duurzaam.huidigeRevisie === golive.geldMotor.duurzaam.laatsteDuurzameRevisie &&
      golive.geldMotor.duurzaam.laatsteSchrijfFout === null &&
      golive.geldMotor.bank && golive.geldMotor.bank.klopt === true &&
      Number.isSafeInteger(golive.geldMotor.bank.som) && golive.geldMotor.bank.som === 0,
    'Echte geldrails zijn niet aan de bereikbare duurzame geldmotor gebonden.');
  }

  eis(!!bronReleaseBewijs, 'CI-bronbewijs ontbreekt.');
  if (bronReleaseBewijs) {
    eis(bronReleaseBewijs.formaat === 'rtg-bron-release-bewijs-v1' &&
      String(bronReleaseBewijs.commit || '') === String(commit || '') &&
      /^[a-f0-9]{40,64}$/.test(String(bronReleaseBewijs.boom || '')) &&
      Number.isSafeInteger(bronReleaseBewijs.bestandAantal) && bronReleaseBewijs.bestandAantal > 0 &&
      /^[a-f0-9]{64}$/.test(String(bronReleaseBewijs.inventarisSha256 || '')),
    'CI-bronbewijs hoort niet bij exact deze commit en Git-boom.');
  }

  eis(!!releaseBewijs, 'Inhoudsbewijs ontbreekt.');
  if (releaseBewijs) {
    eis(releaseBewijs.formaat === 'rtg-release-bewijs-v1', 'Inhoudsbewijs heeft een onbekend formaat.');
    eis(String(releaseBewijs.bron && releaseBewijs.bron.commit) === String(commit),
      'Inhoudsbewijs hoort niet exact bij deze commit.');
    eis(releaseBewijs.bron && releaseBewijs.bron.gewijzigd === false,
      'Inhoudsbewijs bevat code buiten de releasecommit.');
    eis(/^[a-f0-9]{64}$/.test(String(releaseBewijs.inhoudSha256 || '')),
      'Inhoudsbewijs heeft geen geldige verzamelhash.');
  }

  const pin = waarde => /^[a-f0-9]{64}$/.test(String(waarde || ''));
  const vereisteExtern = (() => {
    try { return require('../../server/config/external-release').ALLE_CONTROLES; }
    catch (e) { return []; }
  })();
  const externeNamen = new Set(((externControle && externControle.bewijsBestanden) || [])
    .filter(x => x && pin(x.sha256) && Number.isSafeInteger(x.bytes) && x.bytes > 0)
    .map(x => x.controle));
  const externGepind = !!externControle && externControle.ok === true &&
    pin(externControle.dossierSha256) && pin(externControle.handtekeningSha256) &&
    pin(externControle.sleutelSha256) && vereisteExtern.every(naam => externeNamen.has(naam));
  eis(externGepind,
    'Extern vrijgavedossier mist een geldige Ed25519-handtekening of gemounte bewijsbytes' +
      (externControle && externControle.reden ? ' (' + externControle.reden + ')' : '') + '.');
  if (externGepind)
    eis(String(externControle.commit || '') === String(commit || ''),
      'Cryptografisch extern bewijs hoort niet exact bij de releasecommit.');
  if (externGepind)
    for (const blokkade of require('../../server/config/external-release')
      .foundationReleaseBlokkades(externControle, golive && golive.foundation))
      eis(false, blokkade);
  const keten = kandidaatControle;
  eis(!!keten && keten.ok === true && keten.commit === commit && pin(keten.bewijsSha256) &&
      geldigKandidaatDeel(keten.image, false) && geldigKandidaatDeel(keten.backup, true),
    'Een getekende CI-kandidaat met volledige SBOM, registrydigest en probereis ontbreekt' +
      (keten && keten.reden ? ' (' + keten.reden + ')' : '') + '.');
  return { status: blokkades.length ? 'BLOCKED' : 'READY', blokkades };
}

function geldigKandidaatDeel(deel, backup = false) {
  const soort = backup ? 'candidate-backup-' : 'candidate-';
  const verwijzing = String(deel && deel.verwijzing || '');
  const uniekeRegistryRef = new RegExp('^ghcr\\.io/[a-z0-9][a-z0-9._/-]*:' +
    soort + '[a-f0-9]{12}-[1-9][0-9]*$').test(verwijzing);
  return !!deel && /^sha256:[a-f0-9]{64}$/.test(String(deel.id || '')) &&
    /^sha256:[a-f0-9]{64}$/.test(String(deel.digest || '')) &&
    uniekeRegistryRef && String(deel.immutable || '') === verwijzing + '@' + deel.digest &&
    /^[a-f0-9]{64}$/.test(String(deel.herkomstSha256 || '')) &&
    /^[a-f0-9]{64}$/.test(String(deel.sbomSha256 || ''));
}

module.exports = { hoortBij, geldigKandidaatDeel, beoordeel };
