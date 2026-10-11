/* DE LOKALE SANDBOXREGEL (server/kern/vrijgave/lokaal.js), als tegenstander.

   De regel bestaat om ontwikkelen en toetsen te laten werken ZONDER dat iemand
   in dev "alles op enabled" zet. Het gevaar van zo'n regel is precies omgekeerd:
   dat hij in productie ook geldt, en dat uit dan aan betekent. Daarom staat hier
   vooral wat hij NIET mag:

     - productie zonder vastgelegde stand: elke geldcapability dicht, op elke
       rail, ook op het interne grootboek en de neprails;
     - NODE_ENV=production met een lokaal of privaat APP_URL (een privebeta):
       nog steeds geen sandbox;
     - een standbestand dat in productie `sandbox` zegt: geweigerd -- bij het
       zetten en bij het lezen;
     - development op een adres dat niet de loopback is: geen lokale
       installatie, dus dicht;
     - een openbaar adres, een poortwachter ervoor, een onbekende NODE_ENV: dicht;
     - een echte provider is NOOIT een neprail, lokaal of niet.

   En wat hij wel doet, smal: lokaal, zonder vastgelegde stand, op een rail
   zonder echt geld -- en een besluit over RTG zelf (B3) blijft ook dan gevraagd.
   Wat een mens vastlegde, gaat voor (ook `disabled`). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { maakVrijgave } = require('../server/kern/vrijgave');
const { maakStand, FORMAAT } = require('../server/kern/vrijgave/stand');
const { lokaleInstallatie, sandboxMag } = require('../server/kern/vrijgave/lokaal');
const reg = require('../server/kern/vrijgave/register');
const { LOKAAL_BEVESTIGD } = require('../server/config/omgeving');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vrijgave-lokaal-'));
test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));
let n = 0;
const bestand = () => { const d = path.join(TMP, 'm' + (++n)); fs.mkdirSync(d); return path.join(d, 'vrijgave-stand.json'); };

const BEWEZEN = { oordeel: () => ({ geverifieerd: true, reden: 'proefbewijs' }) };
const MAG = { mag: () => ({ mag: true, via: 'proef' }) };
const GEZOND = () => ({ gezond: true });
/* ALLE ANDERE ASSEN STAAN OPEN: bewijs, bevoegdheid, gezondheid. Wat hier dicht
   blijft, blijft dicht door de stand en de omgeving, en door niets anders. */
const poort = (env, b) => maakVrijgave({ env, stand: maakStand({ bestand: b || bestand() }), bewijs: BEWEZEN, bevoegd: MAG,
  providerGezond: GEZOND });
const RAILS = ['intern', 'simulatie', 'magnaat-test', 'stripe-connect-sandbox', 'stripe', 'mollie', 'adyen', 'stripe_connect', undefined];
const PRODUCTIE_ENVS = {
  'productie zonder adres': { NODE_ENV: 'production' },
  'productie met een lokaal APP_URL (privebeta)': { NODE_ENV: 'production', APP_URL: 'http://localhost:3000', RTG_PRIVATE_BETA: '1' },
  'productie op de loopback': { NODE_ENV: 'production', RTG_BIND: '127.0.0.1' },
  'productie met een privaat adres': { NODE_ENV: 'production', APP_URL: 'http://192.168.1.20:3000' }
};

test('de regel zelf: alleen een niet-openbare test- of ontwikkelinstallatie op de loopback is lokaal', () => {
  assert.equal(lokaleInstallatie({ NODE_ENV: 'test' }).ja, true);
  assert.equal(lokaleInstallatie({ NODE_ENV: 'development' }).ja, true, 'development zonder RTG_BIND luistert op de loopback');
  assert.equal(lokaleInstallatie({}).ja, true, 'niet gezet is development (server/config/omgeving.js)');
  assert.equal(lokaleInstallatie({ NODE_ENV: 'development', RTG_BIND: '127.0.0.1' }).ja, true);
  for (const [naam, env] of Object.entries(PRODUCTIE_ENVS)) {
    assert.equal(lokaleInstallatie(env).ja, false, naam);
    assert.equal(sandboxMag(env).ja, false, naam + ': een sandbox in productie');
  }
  const nee = {
    'development op 0.0.0.0': { NODE_ENV: 'development', RTG_BIND: '0.0.0.0' },
    'development op 0.0.0.0, netwerk bevestigd': { NODE_ENV: 'development', RTG_BIND: '0.0.0.0', RTG_LOKAAL_NETWERK: LOKAAL_BEVESTIGD },
    'development op een openbaar adres': { NODE_ENV: 'development', APP_URL: 'https://rtg.example.com' },
    'development met een poortwachter ervoor': { NODE_ENV: 'development', RTG_DOMAINS: 'member,social' },
    'development met een publiek certificaat': { NODE_ENV: 'development', RTG_ACME: '1', RTG_TLS_DOMAIN: 'rtg.example.com' },
    'development met een publiek certificaat op een openbare naam': { NODE_ENV: 'development', RTG_ACME: '1', RTG_TLS_DOMAIN: 'rtg.nl' },
    'development met eigen TLS': { NODE_ENV: 'development', RTG_TLS: '1' },
    'development met een openbare APP_URL': { NODE_ENV: 'development', APP_URL: 'https://rtg.nl' },
    'een onbekende NODE_ENV': { NODE_ENV: 'staging' },
    'een typefout in NODE_ENV': { NODE_ENV: 'Production' }
  };
  for (const [naam, env] of Object.entries(nee)) assert.equal(lokaleInstallatie(env).ja, false, naam);
  assert.equal(sandboxMag({ NODE_ENV: 'development', APP_URL: 'https://rtg.nl' }).ja, false, 'openbaar kent geen sandbox');
  assert.equal(sandboxMag({ NODE_ENV: 'staging' }).ja, false);
});

test('productie zonder vastgelegde stand: elke geldcapability dicht, op elke rail', () => {
  for (const [naam, env] of Object.entries(PRODUCTIE_ENVS)) {
    const v = poort(env);
    for (const c of reg.REGISTER) for (const rail of RAILS) {
      const o = v.beoordeel(c.id, { recht: true, rail, provider: rail });
      assert.equal(o.beschikbaar, false, naam + ': ' + c.id + ' opende op rail ' + rail);
      assert.equal(o.stand, 'disabled', naam + ': ' + c.id + ' stond niet op de veilige standaard');
      assert.equal(o.standBron, 'veilige-standaard');
    }
    assert.equal(v.overzicht().lokaleInstallatie, false, naam);
  }
});

test('een sandbox in productie: niet te zetten, en met de hand in het bestand gezet geldt hij niet', () => {
  const b = bestand();
  const v = poort({ NODE_ENV: 'production' }, b);
  const z = v.zet('geld.intern_saldo', 'sandbox', { wie: 'user-1', reden: 'sandbox in productie proberen', stapOmhoog: true });
  assert.equal(z.ok, false); assert.equal(z.status, 409);
  /* Iemand schrijft hem toch in het bestand (een herstelde back-up van een
     testmachine, een handmatige bewerking): het oordeel weigert hem. */
  const staat = { formaat: FORMAAT, versie: 7, besluiten: {}, geschiedenis: [],
    standen: Object.fromEntries(reg.REGISTER.map(c => [c.id, { stand: 'sandbox', wie: 'user-1', sinds: 'nu', reden: 'met de hand' }])) };
  fs.writeFileSync(b, JSON.stringify(staat));
  for (const env of Object.values(PRODUCTIE_ENVS)) {
    const w = poort(env, b);
    for (const c of reg.REGISTER) for (const rail of RAILS) {
      const o = w.beoordeel(c.id, { recht: true, rail, provider: rail });
      assert.equal(o.beschikbaar, false, c.id + ' opende op een sandbox in productie (rail ' + rail + ')');
      assert.equal(o.ingeschakeld, false);
    }
    assert.match(w.beoordeel('geld.intern_saldo', { recht: true, rail: 'intern' }).intern, /sandbox-niet-toegestaan/);
  }
});

test('development op een adres dat niet de loopback is: geen lokale standaard, dus dicht', () => {
  const v = poort({ NODE_ENV: 'development', RTG_BIND: '0.0.0.0', RTG_LOKAAL_NETWERK: LOKAAL_BEVESTIGD });
  for (const rail of RAILS) {
    const o = v.beoordeel('geld.intern_saldo', { recht: true, rail });
    assert.equal(o.beschikbaar, false, 'rail ' + rail); assert.equal(o.stand, 'disabled');
  }
  /* Een uitdrukkelijk gezette sandbox mag daar wel (een besloten proefinstallatie),
     maar het interne grootboek is er GEEN neprail: daar staat echt tegoed. */
  const b = bestand();
  const w = poort({ NODE_ENV: 'development', RTG_BIND: '0.0.0.0', RTG_LOKAAL_NETWERK: LOKAAL_BEVESTIGD }, b);
  assert.ok(w.zet('geld.intern_saldo', 'sandbox', { wie: 'user-1', reden: 'sandbox op de proefinstallatie', stapOmhoog: true }).ok);
  assert.equal(w.beoordeel('geld.intern_saldo', { recht: true, rail: 'intern' }).beschikbaar, false, 'intern telde als neprail buiten een lokale installatie');
  assert.equal(w.beoordeel('geld.intern_saldo', { recht: true, rail: 'simulatie' }).beschikbaar, true, 'een echte neprail werkt in een gezette sandbox');
});

test('lokaal: zonder vastgelegde stand op sandbox, op een rail zonder echt geld -- en nooit op een echte provider', () => {
  const v = poort({ NODE_ENV: 'test' });
  const o = v.beoordeel('geld.intern_saldo', { recht: true, rail: 'intern' });
  assert.equal(o.beschikbaar, true, o.intern);
  assert.equal(o.stand, 'sandbox'); assert.equal(o.standBron, 'lokale-standaard');
  for (const echt of reg.ECHTE_PROVIDERS) {
    for (const c of reg.REGISTER) {
      const x = v.beoordeel(c.id, { recht: true, rail: echt, provider: echt });
      assert.equal(x.beschikbaar, false, c.id + ' opende lokaal op de echte provider ' + echt);
    }
  }
  assert.equal(v.beoordeel('geld.intern_saldo', { recht: true }).beschikbaar, false, 'zonder rail geen sandbox');
  /* Wat een mens vastlegt, gaat voor -- ook lokaal, en ook als het `disabled` is. */
  const b = bestand();
  const w = poort({ NODE_ENV: 'test' }, b);
  for (const stand of ['disabled', 'suspended', 'emergency_disabled', 'shadow']) {
    assert.ok(w.zet('geld.intern_saldo', stand, { wie: 'user-1', reden: 'een mens zet ' + stand, stapOmhoog: true }).ok, stand);
    const x = w.beoordeel('geld.intern_saldo', { recht: true, rail: 'intern' });
    assert.equal(x.beschikbaar, false, stand + ' werd door de lokale standaard overschreven');
    assert.equal(x.standBron, 'vastgelegd');
  }
});

test('lokaal blijft B3 gevraagd: zonder besluit geen IBAN-uitbetaling, een providercontract alleen in de sandbox niet', () => {
  const b = bestand();
  const v = poort({ NODE_ENV: 'test' }, b);
  const iban = v.beoordeel('geld.lid_iban_uitbetaling', { recht: true, rail: 'magnaat-test', provider: 'magnaat-test' });
  assert.equal(iban.beschikbaar, false); assert.equal(iban.code, 'compliance-ontbreekt');
  assert.match(iban.intern, /emoney\.b3/);
  assert.ok(v.besluitVastleggen('emoney.b3', { wie: 'user-1', bron: 'proefbesluit-b3', sha256: 'b'.repeat(64), reden: 'B3 in de proef', stapOmhoog: true }).ok);
  assert.equal(v.beoordeel('geld.lid_iban_uitbetaling', { recht: true, rail: 'magnaat-test', provider: 'magnaat-test' }).beschikbaar, true);
  /* Het contract met een provider valt alleen weg in een ACTIEVE sandbox op een
     neprail. Op `enabled` -- ook lokaal -- moet het er gewoon liggen. */
  const sb = v.beoordeel('geld.inkomend', { recht: true, rail: 'simulatie' });
  assert.equal(sb.beschikbaar, true, sb.intern);
  assert.match(sb.intern, /inkomend\.handelaar:niet-van-toepassing-op-neprail/);
  assert.ok(v.zet('geld.inkomend', 'enabled', { wie: 'user-1', reden: 'inkomend aan in de proef', stapOmhoog: true }).ok);
  assert.ok(v.zet('geld.provider.stripe', 'enabled', { wie: 'user-1', reden: 'stripe aan in de proef', stapOmhoog: true }).ok);
  const en = v.beoordeel('geld.inkomend', { recht: true, rail: 'stripe', provider: 'stripe' });
  assert.equal(en.beschikbaar, false, 'op enabled telde een ontbrekend handelaarscontract niet');
  assert.equal(en.code, 'compliance-ontbreekt');
  const nep = v.beoordeel('geld.inkomend', { recht: true, rail: 'simulatie' });
  assert.equal(nep.beschikbaar, false, 'op enabled sloeg een neprail in het verzoek de provider- en contractvraag over');
});

test('de registerkeuring zakt als een echte provider op een neprail-lijst komt', () => {
  const rails = require('../server/kern/vrijgave/rails');
  assert.deepEqual(reg.valideerRegister(reg.REGISTER).fouten, []);
  for (const vals of ['stripe', 'Stripe', 'stripe-connect', 'mollie', 'adyen']) {
    const r = reg.valideerRegister(reg.REGISTER, { rails: Object.assign({}, rails, { LOKALE_NEPRAILS: rails.LOKALE_NEPRAILS.concat([vals]) }) });
    assert.equal(r.ok, false, vals + ' als neprail werd niet gezien');
    const s = reg.valideerRegister(reg.REGISTER, { rails: Object.assign({}, rails, { NEPRAILS: rails.NEPRAILS.concat([vals]) }) });
    assert.equal(s.ok, false, vals + ' als neprail werd niet gezien');
  }
});
