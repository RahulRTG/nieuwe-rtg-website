/* DE BEWIJSAS VAN DE VRIJGAVEPOORT (server/kern/vrijgave/bewijs.js), met
   ingespoten bronnen: iedere manier waarop een bewijs NIET telt (geen eis, geen
   release, een release zonder commit, een dossier dat gooit, ontbreekt of geen
   controles noemt, een controle die niet PASS is of op een andere provider is
   gemeten), de herkomstvelden die in het oordeel meegaan, en de cache die op
   het merk van de bewijsbestanden en op de klok let. Een toets op de echte keten
   dekt het dossier dat er niet is. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { maakBewijs, CACHE_MS } = require('../server/kern/vrijgave/bewijs');
const reg = require('../server/kern/vrijgave/register');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vrijgave-bewijs-takken-'));
test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));
let n = 0;
const map = () => { const d = path.join(TMP, 'm' + (++n)); fs.mkdirSync(d, { recursive: true }); return d; };

const RELEASE = { commit: 'c'.repeat(40), inhoudSha256: 'e'.repeat(64) };
const PASS = (provider) => ({ status: 'PASS', provider });
function bronnen(o = {}) {
  const tel = { release: 0, dossier: 0 };
  return Object.assign({
    tel,
    paden: o.paden || (() => []),
    release: () => { tel.release++; return typeof o.release === 'function' ? o.release() : (o.release === undefined ? RELEASE : o.release); },
    dossier: (commit, controles) => { tel.dossier++; return o.dossier ? o.dossier(commit, controles) : { ok: true, controles: {}, dossierSha256: 'd'.repeat(64) }; }
  });
}
const cap = (controles, provider) => ({ id: 'proef', bewijs: Object.assign({ controles }, provider ? { provider } : {}) });

test('zonder bewijseis (of met een eis zonder lijst) is er geen bewijs', () => {
  const b = maakBewijs({ bronnen: bronnen() });
  for (const c of [null, undefined, {}, { bewijs: null }, { bewijs: { controles: 'reconciliation' } }]) {
    const o = b.oordeel(c);
    assert.equal(o.geverifieerd, false);
    assert.equal(o.reden, 'geen-bewijseis');
  }
});

test('een release die gooit, ontbreekt of geen commit heeft, is geen bewijs', () => {
  for (const release of [() => { throw new Error('stuk'); }, null, { inhoudSha256: 'x' }]) {
    const o = maakBewijs({ bronnen: bronnen({ release }) }).oordeel(cap(['reconciliation']));
    assert.deepEqual(o.geverifieerd, false);
    assert.equal(o.reden, 'releasebewijs-ongeldig');
    assert.equal(o.commit, undefined, 'zonder release geen commit in het oordeel');
  }
});

test('een dossier dat gooit, ontbreekt of afwijst: de reden staat erin en de releaseherkomst gaat mee', () => {
  const geval = [
    [() => { throw new Error('x'); }, 'dossier-dossier-onleesbaar'],
    [() => null, 'dossier-ontbreekt'],
    [() => ({ ok: false }), 'dossier-ontbreekt'],
    [() => ({ ok: false, reden: 'handtekening-ongeldig' }), 'dossier-handtekening-ongeldig']
  ];
  for (const [dossier, reden] of geval) {
    const o = maakBewijs({ bronnen: bronnen({ dossier }) }).oordeel(cap(['reconciliation']));
    assert.equal(o.geverifieerd, false);
    assert.equal(o.reden, reden);
    assert.equal(o.commit, RELEASE.commit);
    assert.equal(o.inhoudSha256, RELEASE.inhoudSha256);
  }
  const zonderHash = maakBewijs({ bronnen: bronnen({ release: { commit: 'a'.repeat(40) }, dossier: () => null }) })
    .oordeel(cap(['reconciliation']));
  assert.equal(zonderHash.inhoudSha256, null);
});

test('een dossier zonder controles of met een controle die niet PASS is: niet geverifieerd, met de naam van de controle', () => {
  const zonder = maakBewijs({ bronnen: bronnen({ dossier: () => ({ ok: true }) }) }).oordeel(cap(['reconciliation']));
  assert.equal(zonder.reden, 'controle-niet-pass:reconciliation');
  const oos = maakBewijs({ bronnen: bronnen({ dossier: () => ({ ok: true, controles: {
    paymentProvider: PASS(), webhookDelivery: { status: 'OUT_OF_SCOPE' } } }) }) })
    .oordeel(cap(['paymentProvider', 'webhookDelivery']));
  assert.equal(oos.geverifieerd, false);
  assert.equal(oos.reden, 'controle-niet-pass:webhookDelivery');
  assert.equal(oos.commit, RELEASE.commit);
});

test('de provider moet kloppen: een andere of ontbrekende gemeten provider is geen bewijs', () => {
  const met = controles => maakBewijs({ bronnen: bronnen({ dossier: () => ({ ok: true, controles }) }) });
  assert.equal(met({ paymentProvider: PASS('mollie') }).oordeel(cap(['paymentProvider'], 'stripe')).reden,
    'provider-wijkt-af:paymentProvider');
  const leeg = met({ paymentProvider: PASS() }).oordeel(cap(['paymentProvider'], 'stripe'));
  assert.equal(leeg.reden, 'provider-wijkt-af:paymentProvider');
  assert.equal(leeg.inhoudSha256, RELEASE.inhoudSha256);
  const ja = met({ paymentProvider: PASS('stripe') }).oordeel(cap(['paymentProvider'], 'stripe'));
  assert.deepEqual(ja, { geverifieerd: true, reden: 'release-gebonden-bewijs', commit: RELEASE.commit,
    inhoudSha256: RELEASE.inhoudSha256, dossierSha256: null });
  /* Zonder providereis telt elke gemeten provider. */
  assert.equal(met({ paymentProvider: PASS('mollie') }).oordeel(cap(['paymentProvider'])).geverifieerd, true);
});

test('geverifieerd zonder inhoudshash of dossierhash: die velden staan op null, niet op undefined', () => {
  const o = maakBewijs({ bronnen: bronnen({ release: { commit: 'a'.repeat(40) },
    dossier: () => ({ ok: true, controles: { reconciliation: PASS() }, dossierSha256: 'f'.repeat(64) }) }) })
    .oordeel(cap(['reconciliation']));
  assert.deepEqual(o, { geverifieerd: true, reden: 'release-gebonden-bewijs', commit: 'a'.repeat(40),
    inhoudSha256: null, dossierSha256: 'f'.repeat(64) });
});

test('de cache: dezelfde eis in een andere volgorde deelt een lezing; een ander merk of het verstrijken van de tijd rekent opnieuw', () => {
  const d = map();
  const bestand = path.join(d, 'bewijs.json');
  fs.writeFileSync(bestand, '1');
  let t = 0;
  const br = bronnen({ paden: () => [bestand, path.join(d, 'weg.json')],
    dossier: () => ({ ok: true, controles: { a: PASS(), b: PASS() } }) });
  const b = maakBewijs({ bronnen: br, nu: () => t });
  assert.equal(b.oordeel(cap(['a', 'b'])).geverifieerd, true);
  assert.equal(b.oordeel(cap(['b', 'a'])).geverifieerd, true);
  assert.equal(br.tel.dossier, 1, 'een sleutel per verzameling controles');
  b.oordeel(cap(['a', 'b'], 'stripe'));
  assert.equal(br.tel.dossier, 2, 'een providereis is een eigen sleutel');
  fs.writeFileSync(bestand, '22');
  b.oordeel(cap(['a', 'b']));
  assert.equal(br.tel.dossier, 3, 'een ander merk van de bewijsbestanden');
  t += CACHE_MS;
  b.oordeel(cap(['a', 'b']));
  assert.equal(br.tel.dossier, 4, 'na de cachetijd');
  b.leeg();
  b.oordeel(cap(['a', 'b']));
  assert.equal(br.tel.dossier, 5, 'na leeg() opnieuw');
});

test('de echte keten op een lege werkboom: geen releasebewijs, dus niets geverifieerd', () => {
  const b = maakBewijs({ root: map() });
  const o = b.oordeel(reg.vind('geld.provider.stripe'));
  assert.equal(o.geverifieerd, false);
  assert.equal(o.reden, 'releasebewijs-ongeldig');
});

test('de echte keten met een geldig releasebewijs maar zonder dossier: dossier-ontbreekt, met de commit erbij', () => {
  const { maakGetekendeVrijgave, COMMIT } = require('./foundation-vrijgave-fixture');
  const root = map();
  maakGetekendeVrijgave(root);
  fs.rmSync(path.join(root, '.release', 'external-release.json'));
  const o = maakBewijs({ root }).oordeel(reg.vind('geld.provider.stripe'));
  assert.equal(o.geverifieerd, false);
  assert.equal(o.reden, 'dossier-ontbreekt');
  assert.equal(o.commit, COMMIT);
  assert.match(o.inhoudSha256, /^[a-f0-9]{64}$/);
});
