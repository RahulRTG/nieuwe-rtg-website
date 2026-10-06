/* DE VRIJGAVEPOORT (server/kern/vrijgave/) -- tegenstandertoetsen op de laag
   zelf.

   De belofte die hier wordt nagetrokken is die van de eigenaar: UIT MAG NOOIT
   PER ONGELUK AAN BETEKENEN. Dus niet "werkt het als alles goed staat" maar:
   valt ieder van de vijf assen afzonderlijk weg, dan staat hij dicht, met de
   juiste veilige code -- en een onbekende id, een onbekende stand, een
   teruggezet bestand, een sleutel zonder bewijs en een dossier dat zegt dat er
   GEEN rail is, openen allemaal niets.

   Het bewijs is ECHT waar het kan: test/foundation-vrijgave-fixture.js maakt een
   volledig ondertekend releasedossier (Ed25519, runnergetekende geldmetingen,
   een geverifieerd release-bewijs.json), en de bewijsas leest dat via dezelfde
   keten als de productiepoort. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { maakVrijgave } = require('../server/kern/vrijgave');
const { maakStand } = require('../server/kern/vrijgave/stand');
const { maakBewijs } = require('../server/kern/vrijgave/bewijs');
const reg = require('../server/kern/vrijgave/register');
const { maakGetekendeVrijgave } = require('./foundation-vrijgave-fixture');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vrijgave-'));
test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));
let n = 0;
const map = () => { const d = path.join(TMP, 'm' + (++n)); fs.mkdirSync(d, { recursive: true }); return d; };

const BEWEZEN = { oordeel: () => ({ geverifieerd: true, reden: 'proefbewijs', commit: 'c'.repeat(40), inhoudSha256: 'e'.repeat(64) }) };
const MAG = { mag: () => ({ mag: true, via: 'proef' }) };
const ZET = { wie: 'user-1', reden: 'proef van de vrijgavepoort', stapOmhoog: true };
const BESLUIT = { wie: 'user-1', bron: 'proefdossier-1', sha256: 'a'.repeat(64), reden: 'proef van een besluit', stapOmhoog: true };

/* Een poort waarin `geld.provider.stripe` volledig beschikbaar is, en per
   toets een as om weg te halen. */
function opstelling(o = {}) {
  const bestand = o.bestand || path.join(map(), 'vrijgave-stand.json');
  const v = maakVrijgave({ stand: maakStand({ bestand, nu: o.nu }), openbaar: o.openbaar || (() => false),
    bewijs: o.bewijs || BEWEZEN, bevoegd: o.bevoegd === undefined ? MAG : o.bevoegd,
    providerGezond: o.providerGezond || (() => ({ gezond: true })) });
  if (!o.zonderBesluit) assert.ok(v.besluitVastleggen('provider.stripe', BESLUIT).ok);
  if (!o.zonderStand) assert.ok(v.zet('geld.provider.stripe', 'enabled', ZET).ok);
  return { v, bestand };
}
const RECHT = { recht: true };

test('het register is kringvrij en volledig, en de validatie zakt op elke soort fout', () => {
  const ok = reg.valideerRegister(reg.REGISTER, { vermogens: require('../server/kern/bevoegdheid/lijst').VERMOGENS,
    controles: require('../server/config/external-release').ALLE_CONTROLES });
  assert.deepEqual(ok.fouten, []);
  const ids = reg.REGISTER.map(c => c.id);
  for (const id of ['geld.inkomend', 'geld.opwaarderen', 'geld.terugbetaling', 'geld.partnerafrekening',
    'geld.provider.stripe', 'geld.provider.stripe_connect', 'geld.provider.mollie', 'geld.provider.adyen',
    'geld.intern_saldo', 'geld.terugstortbaar_saldo', 'geld.lid_iban_uitbetaling']) assert.ok(ids.includes(id), id);
  assert.equal(ids.some(id => /money_enabled|geld\.alles/i.test(id)), false, 'er is geen generieke geldschakelaar');
  const kopie = c => JSON.parse(JSON.stringify(c));
  const breek = (fn) => { const l = reg.REGISTER.map(kopie); fn(l); return reg.valideerRegister(l, { controles: ['paymentProvider', 'webhookDelivery', 'payoutProvider', 'refundPayoutSettlement', 'reconciliation'] }); };
  assert.equal(breek(l => { l[0].veiligeStand = 'enabled'; }).ok, false, 'geld standaard aan');
  assert.equal(breek(l => { l[0].afhankelijk = ['geld.bestaatniet']; }).ok, false, 'afhankelijkheid naar niets');
  assert.equal(breek(l => { l[0].afhankelijk = ['geld.opwaarderen']; }).ok, false, 'kring');
  assert.equal(breek(l => { l[0].bewijs.controles = ['verzonnen']; }).ok, false, 'onbekende controle');
  assert.equal(breek(l => { l[0].standen = ['disabled', 'aan']; }).ok, false, 'onbekende stand');
  assert.equal(breek(l => { l[0].bevoegdheid = {}; }).ok, false, 'zonder autorisatiebeleid');
  assert.equal(breek(l => { l.push(kopie(l[0])); }).ok, false, 'dubbel id');
});

test('alle vijf assen plus gezondheid en recht: precies dan beschikbaar, en ieder ontbrekend deel sluit met zijn eigen code', () => {
  const { v } = opstelling();
  const ja = v.beoordeel('geld.provider.stripe', RECHT);
  assert.equal(ja.beschikbaar, true, ja.intern);
  assert.equal(v.beoordeel('geld.provider.stripe', {}).code, 'geen-recht', 'zonder vastgesteld recht van de actor');
  assert.equal(v.beoordeel('geld.provider.stripe', { recht: 'ja' }).beschikbaar, false, 'alleen precies true telt');
  const geval = (naam, o, code) => {
    const x = opstelling(o).v.beoordeel('geld.provider.stripe', RECHT);
    assert.equal(x.beschikbaar, false, naam + ' opende');
    assert.equal(x.code, code, naam + ': ' + x.intern);
  };
  geval('niet ingeschakeld', { zonderStand: true }, 'bestaat-niet-voor-dit-product');
  geval('geen bewijs', { bewijs: { oordeel: () => ({ geverifieerd: false, reden: 'dossier-ontbreekt' }) } }, 'compliance-ontbreekt');
  geval('geen besluit', { zonderBesluit: true }, 'compliance-ontbreekt');
  geval('provider ongezond', { providerGezond: () => ({ gezond: false, reden: 'weg' }) }, 'provider-niet-beschikbaar');
  geval('gezondheid gooit', { providerGezond: () => { throw new Error('kapot'); } }, 'provider-niet-beschikbaar');
  // een vermogen-geautoriseerde capability: zonder gekoppelde bevoegdheidslaag dicht
  const z = opstelling({ bevoegd: null });
  assert.ok(z.v.zet('geld.intern_saldo', 'enabled', ZET).ok);
  assert.equal(z.v.beoordeel('geld.intern_saldo', RECHT).code, 'niet-geautoriseerd');
  const nee = opstelling({ bevoegd: { mag: () => ({ mag: false, reden: 'geen' }) } });
  assert.ok(nee.v.zet('geld.intern_saldo', 'enabled', ZET).ok);
  assert.equal(nee.v.beoordeel('geld.intern_saldo', RECHT).code, 'niet-geautoriseerd');
});

test('een onbekende id is dicht, en eis() gooit een veilige fout zonder interne details in de tekst', () => {
  const { v } = opstelling();
  const o = v.beoordeel('geld.alles', RECHT);
  assert.equal(o.beschikbaar, false); assert.equal(o.code, 'bestaat-niet-voor-dit-product');
  assert.throws(() => v.eis('geld.alles', RECHT), e => e.code === 'VRIJGAVE_DICHT' && e.status === 503 && e.nietVerstuurd === true);
  try { v.eis('geld.inkomend', { recht: true, provider: 'stripe' }); assert.fail('opende'); }
  catch (e) {
    assert.doesNotMatch(e.message, /dossier|controle|versie|stand|disabled|besluit/i, 'de klanttekst lekt configuratie');
    assert.ok(e.intern, 'de interne reden staat wel op de fout, voor het log');
  }
  assert.throws(() => v.eis('geld.provider.stripe', {}), e => e.status === 403 && e.vrijgaveCode === 'geen-recht');
});

test('een onbekende stand in het bestand is een configuratiefout: alles dicht, en de opstartcontrole zakt', () => {
  const { v, bestand } = opstelling();
  const s = JSON.parse(fs.readFileSync(bestand, 'utf8'));
  s.standen['geld.provider.stripe'].stand = 'aan';
  s.versie += 1;
  fs.writeFileSync(bestand, JSON.stringify(s));
  const o = v.beoordeel('geld.provider.stripe', RECHT);
  assert.equal(o.beschikbaar, false); assert.equal(o.code, 'tijdelijk-uit'); assert.match(o.intern, /configuratiefout/);
  assert.equal(v.valideer().ok, false);
  fs.writeFileSync(bestand, '{kapot');
  assert.equal(v.beoordeel('geld.provider.stripe', RECHT).beschikbaar, false, 'een kapot bestand opende');
  // schakelen over een kapot bestand heen kan alleen uitdrukkelijk
  assert.equal(v.zet('geld.provider.stripe', 'disabled', ZET).reden, 'configuratiefout');
  assert.ok(v.zet('geld.provider.stripe', 'disabled', Object.assign({ versie: 'herstel' }, ZET)).ok);
});

test('sleutels zijn geen schakelaar: alles op aan met een gezonde provider, maar zonder bewijs blijft het dicht', () => {
  const { v } = opstelling({ bewijs: maakBewijs({ root: map() }) });  // een lege map: geen release-bewijs, geen dossier
  const o = v.beoordeel('geld.provider.stripe', RECHT);
  assert.equal(o.beschikbaar, false); assert.equal(o.code, 'compliance-ontbreekt');
  assert.match(o.intern, /releasebewijs-ongeldig/);
});

test('de bewijsas op een echt ondertekend dossier: PASS opent, OUT_OF_SCOPE niet, een andere provider niet, geknoei niet', () => {
  const root = map();
  maakGetekendeVrijgave(root);
  const b = maakBewijs({ root });
  const stripe = b.oordeel(reg.vind('geld.provider.stripe'));
  assert.equal(stripe.geverifieerd, true, stripe.uitleg || stripe.reden);
  assert.match(stripe.inhoudSha256, /^[a-f0-9]{64}$/, 'gebonden aan de inhoud van de release');
  assert.equal(stripe.commit, 'a'.repeat(40));
  const mollie = b.oordeel(reg.vind('geld.provider.mollie'));
  assert.equal(mollie.geverifieerd, false, 'een Stripe-meting gaf Mollie vrij');
  assert.match(mollie.reden, /provider-wijkt-af/);
  // een release ZONDER rail: de dossierlaag aanvaardt OUT_OF_SCOPE, de vrijgavepoort niet
  const zonder = map();
  maakGetekendeVrijgave(zonder, { moneyDisabled: true });
  const o = maakBewijs({ root: zonder }).oordeel(reg.vind('geld.partnerafrekening'));
  assert.equal(o.geverifieerd, false, 'OUT_OF_SCOPE opende een geldrail');
  assert.match(o.reden, /controle-niet-pass:payoutProvider/);
  // geknoei aan een bewijsbestand na het tekenen
  const bestand = path.join(root, '.release', 'external-evidence', 'payout-provider.bewijs');
  fs.appendFileSync(bestand, ' ');
  const na = b.oordeel(reg.vind('geld.partnerafrekening'));
  assert.equal(na.geverifieerd, false, 'geknoeid bewijs telde nog');
  // een dossier voor een andere commit dan de draaiende code
  const ander = map();
  maakGetekendeVrijgave(ander, { runtimeCommit: 'f'.repeat(40) });
  assert.equal(maakBewijs({ root: ander }).oordeel(reg.vind('geld.provider.stripe')).geverifieerd, false, 'dossier van een andere release');
});

test('terugzetten van een oud standbestand: tijdens het draaien dicht, en na een herstart opent het niets zonder bewijs', () => {
  const { v, bestand } = opstelling();
  const oud = fs.readFileSync(bestand);                         // versie met stripe AAN
  assert.ok(v.zet('geld.provider.stripe', 'emergency_disabled', ZET).ok);
  fs.writeFileSync(bestand, oud);                               // iemand zet de oude stand terug
  const o = v.beoordeel('geld.provider.stripe', RECHT);
  assert.equal(o.beschikbaar, false, 'een teruggezet bestand heropende de capability');
  assert.match(o.intern, /teruggezet/);
  // een verse instantie (herstart) kent de hoogste versie niet -- maar zonder bewijs blijft het dicht
  const vers = maakVrijgave({ stand: maakStand({ bestand }), openbaar: () => false, bewijs: maakBewijs({ root: map() }),
    bevoegd: MAG, providerGezond: () => ({ gezond: true }) });
  assert.equal(vers.beoordeel('geld.provider.stripe', RECHT).beschikbaar, false);
});

test('twee instanties op dezelfde datamap: de noodstop van de een is bij het volgende oordeel van de ander dicht', () => {
  let klok = 1000;
  const nu = () => klok;                      // de klok staat STIL: het is het bestandsmerk, niet de TTL
  const a = opstelling({ nu });
  const b = maakVrijgave({ stand: maakStand({ bestand: a.bestand, nu }), openbaar: () => false, bewijs: BEWEZEN,
    bevoegd: MAG, providerGezond: () => ({ gezond: true }) });
  assert.equal(a.v.beoordeel('geld.provider.stripe', RECHT).beschikbaar, true);
  assert.equal(b.beoordeel('geld.provider.stripe', RECHT).beschikbaar, true);
  assert.ok(b.zet('geld.provider.stripe', 'emergency_disabled', { wie: 'user-2', reden: 'noodstop van instantie b' }).ok);
  assert.equal(a.v.beoordeel('geld.provider.stripe', RECHT).beschikbaar, false, 'instantie a zag de noodstop niet');
  assert.throws(() => a.v.eis('geld.provider.stripe', RECHT), e => e.vrijgaveCode === 'tijdelijk-uit');
});

test('een bestaande sessie: hetzelfde verzoek dat zojuist mocht, mag na het uitzetten niet meer', () => {
  const { v } = opstelling();
  const sessie = { recht: true, actor: { soort: 'lid', sessie: 'zelfde' } };
  assert.ok(v.eis('geld.provider.stripe', sessie));
  assert.ok(v.zet('geld.provider.stripe', 'suspended', { wie: 'user-1', reden: 'even stilzetten in de proef' }).ok);
  assert.throws(() => v.eis('geld.provider.stripe', sessie), e => e.code === 'VRIJGAVE_DICHT');
});

test('gelijktijdig schakelen: wie op een oude versie schakelt, botst en ziet wat er intussen gebeurde', () => {
  const { v } = opstelling();
  const versie = v.beoordeel('geld.inkomend', {}).standVersie;
  assert.ok(v.zet('geld.inkomend', 'suspended', Object.assign({ versie }, ZET)).ok);
  const tweede = v.zet('geld.inkomend', 'enabled', Object.assign({ versie }, ZET));
  assert.equal(tweede.ok, false); assert.equal(tweede.reden, 'botsing');
  // en een slot van een gecrashte schrijver blokkeert niet voor altijd
  const s = opstelling();
  const slot = s.bestand + '.slot';
  fs.writeFileSync(slot, 'x');
  const oud = (Date.now() - 60000) / 1000;
  fs.utimesSync(slot, oud, oud);
  assert.ok(s.v.zet('geld.inkomend', 'suspended', ZET).ok, 'een oud slot hield de schakeling tegen');
});

test('aanzetten van geld vraagt een verse passkey en een mens op naam; uitzetten vraagt alleen een mens en een reden', () => {
  const { v } = opstelling({ zonderStand: true });
  const r = v.zet('geld.provider.stripe', 'enabled', { wie: 'user-1', reden: 'zonder passkey proberen' });
  assert.equal(r.ok, false); assert.equal(r.status, 401);
  assert.equal(v.zet('geld.provider.stripe', 'shadow', { wie: 'user-1', reden: 'schaduw is ook activeren' }).status, 401);
  assert.equal(v.zet('geld.provider.stripe', 'enabled', Object.assign({}, ZET, { wie: 'boardroom' })).status, 403, 'een gedeelde naam');
  assert.equal(v.zet('geld.provider.stripe', 'enabled', Object.assign({}, ZET, { reden: 'kort' })).status, 400);
  assert.ok(v.zet('geld.provider.stripe', 'emergency_disabled', { wie: 'user-1', reden: 'noodstop zonder passkey' }).ok);
  assert.equal(v.besluitVastleggen('provider.stripe', Object.assign({}, BESLUIT, { stapOmhoog: false })).status, 401);
  assert.equal(v.besluitVastleggen('verzonnen.besluit', BESLUIT).status, 404);
  assert.ok(v.besluitIntrekken('provider.stripe', { wie: 'user-1', reden: 'contract opgezegd in de proef' }).ok);
});

test('schaduw meet en laat niets door; sandbox alleen op een neprail en nooit openbaar', () => {
  const { v } = opstelling({ zonderStand: true });
  assert.ok(v.zet('geld.provider.stripe', 'shadow', ZET).ok);
  const o = v.beoordeel('geld.provider.stripe', RECHT);
  assert.equal(o.beschikbaar, false);
  assert.equal(v.schaduwTelling()['geld.provider.stripe'].zouDoor, 1, 'de schaduw telde wat er zou zijn gebeurd');
  // sandbox: intern saldo op de simulatiebank, zonder extern bewijs
  const s = opstelling({ bewijs: maakBewijs({ root: map() }) });
  assert.ok(s.v.zet('geld.intern_saldo', 'sandbox', ZET).ok);
  assert.equal(s.v.beoordeel('geld.intern_saldo', { recht: true, rail: 'simulatie' }).beschikbaar, true);
  assert.equal(s.v.beoordeel('geld.intern_saldo', { recht: true, rail: 'stripe' }).beschikbaar, false, 'sandbox opende een echte rail');
  assert.equal(s.v.beoordeel('geld.intern_saldo', { recht: true }).beschikbaar, false, 'sandbox zonder rail');
  const openbaar = opstelling({ openbaar: () => true, bestand: s.bestand });
  assert.equal(openbaar.v.beoordeel('geld.intern_saldo', { recht: true, rail: 'simulatie' }).beschikbaar, false, 'sandbox in een openbare installatie');
  assert.equal(openbaar.v.zet('geld.inkomend', 'sandbox', ZET).status, 409);
});

test('terugstortbaar saldo (B3) blijft niet geautoriseerd zonder extern besluit, ook als de bevoegdheid ja zegt', () => {
  const { v } = opstelling();
  assert.ok(v.zet('geld.intern_saldo', 'enabled', ZET).ok);
  assert.ok(v.zet('geld.terugstortbaar_saldo', 'enabled', ZET).ok);
  const o = v.beoordeel('geld.terugstortbaar_saldo', RECHT);
  assert.equal(o.beschikbaar, false); assert.equal(o.code, 'compliance-ontbreekt'); assert.match(o.intern, /emoney\.b3/);
  assert.ok(v.besluitVastleggen('emoney.b3', BESLUIT).ok);
  assert.equal(v.beoordeel('geld.terugstortbaar_saldo', RECHT).beschikbaar, true);
  // en het lid-IBAN hangt er weer aan: terugstortbaar saldo uit, uitbetalen dicht
  assert.ok(v.zet('geld.lid_iban_uitbetaling', 'enabled', ZET).ok);
  assert.equal(v.beoordeel('geld.lid_iban_uitbetaling', RECHT).beschikbaar, true);
  assert.ok(v.zet('geld.terugstortbaar_saldo', 'disabled', { wie: 'user-1', reden: 'terug naar gesloten circuit' }).ok);
  assert.equal(v.beoordeel('geld.lid_iban_uitbetaling', RECHT).code, 'tijdelijk-uit');
});

test('per verzoek de provider: inkomend via Stripe kan aan terwijl inkomend via Mollie dicht is', () => {
  const { v } = opstelling();
  assert.ok(v.besluitVastleggen('inkomend.handelaar', BESLUIT).ok);
  assert.ok(v.zet('geld.inkomend', 'enabled', ZET).ok);
  assert.equal(v.beoordeel('geld.inkomend', { recht: true, provider: 'stripe' }).beschikbaar, true);
  assert.equal(v.beoordeel('geld.inkomend', { recht: true, provider: 'mollie' }).code, 'provider-niet-beschikbaar');
  assert.equal(v.beoordeel('geld.inkomend', { recht: true }).code, 'provider-niet-beschikbaar', 'zonder provider');
  assert.equal(v.beoordeel('geld.inkomend', { recht: true, provider: 'verzonnen' }).beschikbaar, false);
});

test('weigering(): dezelfde evaluator in de vorm van kern/pay -- null als het mag, anders { status, error, code }', () => {
  const { weigering } = require('../server/kern/vrijgave');
  const { v } = opstelling();
  assert.equal(weigering('geld.provider.stripe', RECHT, v), null);
  const w = weigering('geld.intern_saldo', RECHT, v);
  assert.equal(w.status, 503); assert.equal(w.code, 'bestaat-niet-voor-dit-product'); assert.equal(w.capability, 'geld.intern_saldo');
  assert.doesNotMatch(w.error, /stand|disabled|dossier/);
});

test('bij het starten: een configuratiefout weigert een openbare installatie, en waarschuwt elders', () => {
  const { keurBijStart } = require('../server/kern/vrijgave');
  const stil = { warn: () => {} };
  const bestand = path.join(map(), 'vrijgave-stand.json');
  fs.writeFileSync(bestand, JSON.stringify({ formaat: 'rtg-vrijgave-stand-v1', versie: 1, standen: { 'geld.inkomend': { stand: 'aan' } }, besluiten: {}, geschiedenis: [] }));
  const maak = openbaar => maakVrijgave({ stand: maakStand({ bestand }), openbaar: () => openbaar, bewijs: BEWEZEN, bevoegd: MAG });
  assert.throws(() => keurBijStart(maak(true), stil), e => e.code === 'VRIJGAVE_CONFIGURATIEFOUT' && /onbekende stand/.test(e.message));
  assert.equal(keurBijStart(maak(false), stil).ok, false, 'buiten productie: geen weigering, wel een fout');
  assert.equal(keurBijStart(opstelling({ openbaar: () => true }).v, stil).ok, true, 'een goede stand start gewoon');
});
