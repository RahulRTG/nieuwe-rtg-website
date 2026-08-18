/* ============================================================================
   SCIM: de IdP van een klant mag zelf accounts aanmaken en uitzetten.

   Dat is de gevaarlijkste bevoegdheid die we buiten de deur geven, want de
   sleutel ligt bij de klant. De meeste tests hieronder gaan dus over de GRENS:
   wat mag de sleutel van organisatie A NIET doen bij organisatie B.

   Draai los: node --test test/scim.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-scim-'));
process.env.RTG_DATA_DIR = TMP;

const accounts = require('../server/accounts');
accounts.init();

const koppelingen = require('../server/sso/koppelingen');
const sso = require('../server/sso');
const scim = require('../server/scim');
const filter = require('../server/scim/filter');
const vorm = require('../server/scim/vorm');
sso.zorgTabel();
scim.zorgTabel();

test.after(() => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

/* Twee organisaties met een eigen domein. Zo is elke grensovertreding zichtbaar. */
koppelingen.zet({ org: 'alfa', naam: 'Alfa BV', issuer: 'https://idp.alfa.test',
  clientId: 'c-alfa', clientSecret: 'g1', domeinen: 'alfa.test' });
koppelingen.zet({ org: 'beta', naam: 'Beta NV', issuer: 'https://idp.beta.test',
  clientId: 'c-beta', clientSecret: 'g2', domeinen: 'beta.test' });

/* ================= 1. de sleutel ================= */

test('1. een sleutel wordt gehasht bewaard, niet leesbaar', () => {
  const s = scim.sleutels.draai('alfa');
  assert.ok(s.sleutel.startsWith('rtgscim_'));
  const rij = require('../server/accounts/state').db
    .prepare('SELECT hash, hint FROM scim_sleutels WHERE org = ?').get('alfa');
  assert.ok(!rij.hash.includes(s.sleutel), 'de sleutel zelf mag er niet staan');
  assert.equal(rij.hash.length, 64, 'sha256 in hex');
  assert.ok(rij.hint.length < s.sleutel.length, 'de hint is korter dan de sleutel');
  assert.equal(scim.sleutels.vanSleutel(s.sleutel), 'alfa');
});

test('2. onzin, een lege sleutel of een sleutel van niemand geeft null', () => {
  assert.equal(scim.sleutels.vanSleutel(''), null);
  assert.equal(scim.sleutels.vanSleutel('rtgscim_' + 'a'.repeat(43)), null);
  assert.equal(scim.sleutels.vanSleutel('zomaarwat'), null);
  assert.equal(scim.sleutels.vanSleutel(null), null);
});

test('3. een nieuwe sleutel draaien maakt de oude meteen dood', () => {
  const oud = scim.sleutels.draai('beta');
  const nieuw = scim.sleutels.draai('beta');
  assert.notEqual(oud.sleutel, nieuw.sleutel);
  assert.equal(scim.sleutels.vanSleutel(oud.sleutel), null, 'de oude werkt niet meer');
  assert.equal(scim.sleutels.vanSleutel(nieuw.sleutel), 'beta');
});

test('4. de stand toont de hint, nooit de sleutel', () => {
  const st = scim.sleutels.stand('alfa');
  assert.ok(st.hint);
  assert.equal(st.sleutel, undefined);
  assert.equal(st.hash, undefined);
});

/* ================= 2. aanmaken (in dienst) ================= */

test('5. een medewerker in dienst krijgt een account -- en NOOIT een betaalde pas', async () => {
  const r = await scim.maak(accounts, 'alfa', { userName: 'nieuw@alfa.test', name: { formatted: 'Nieuw Persoon' } });
  assert.equal(r.bestond, false);
  assert.equal(r.user.tier, 'rtg');
  assert.notEqual(r.user.tier, 'business');
  assert.equal(r.user.actief, 1);
  assert.equal(accounts.realNameOf(r.user), 'Nieuw Persoon');
  assert.ok(!String(r.user.enc_name).includes('Nieuw'), 'de naam gaat versleuteld de kluis in');
});

test('6. DE GRENS: alfa mag geen account op het domein van beta maken', async () => {
  await assert.rejects(() => scim.maak(accounts, 'alfa', { userName: 'iemand@beta.test' }),
    /valt buiten de domeinen/);
});

test('7. een tweede keer aanmaken geeft hetzelfde account terug, geen dubbele', async () => {
  const a = await scim.maak(accounts, 'alfa', { userName: 'nieuw@alfa.test' });
  assert.equal(a.bestond, true);
  const alle = scim.accountsVan(accounts, 'alfa').filter(u => accounts.emailOf(u) === 'nieuw@alfa.test');
  assert.equal(alle.length, 1, 'geen tweede account voor hetzelfde adres');
});

test('8. userName is verplicht', async () => {
  await assert.rejects(() => scim.maak(accounts, 'alfa', {}), /userName is verplicht/);
});

/* ================= 3. uit dienst ================= */

test('9. uit dienst zetten haalt ELKE lopende sessie meteen weg', async () => {
  /* Dit is de kern van SCIM. Een sessietoken is staatloos; we bewaren niet welke
     er zijn uitgegeven. De vlag op het account is daarom de enige plek waar dit
     sluitend kan. */
  const r = await scim.maak(accounts, 'alfa', { userName: 'vertrekker@alfa.test' });
  const token = accounts.issueToken(r.user.id);
  assert.ok(accounts.verifyToken(token), 'de sessie werkt zolang hij in dienst is');

  scim.zetActief(accounts, 'alfa', r.user.id, false);
  assert.equal(accounts.verifyToken(token), null, 'en is weg op het moment van uitdiensttreding');

  // maar het account bestaat nog: facturen en boekingen blijven staan
  const nog = accounts.getUserById(r.user.id);
  assert.ok(nog, 'uit dienst is geen wissen');
  assert.equal(nog.actief, 0);
});

test('10. weer in dienst laat de sessie weer werken', async () => {
  const u = scim.zoekOpEmail(accounts, 'alfa', 'vertrekker@alfa.test');
  scim.zetActief(accounts, 'alfa', u.id, true);
  const token = accounts.issueToken(u.id);
  assert.ok(accounts.verifyToken(token));
});

test('11. DE GRENS: beta mag een account van alfa niet uitzetten', async () => {
  const u = scim.zoekOpEmail(accounts, 'alfa', 'nieuw@alfa.test');
  assert.throws(() => scim.zetActief(accounts, 'beta', u.id, false), /Onbekende gebruiker/);
  assert.equal(accounts.getUserById(u.id).actief, 1, 'en het account blijft gewoon actief');
});

test('12. DE GRENS: beta mag een account van alfa niet eens LEZEN', () => {
  const u = scim.zoekOpEmail(accounts, 'alfa', 'nieuw@alfa.test');
  assert.throws(() => scim.lees(accounts, 'beta', u.id), /Onbekende gebruiker/);
  assert.equal(scim.zoekOpEmail(accounts, 'beta', 'nieuw@alfa.test'), null);
});

test('13. een account met een betaalde pas houdt die pas, ook bij uit/in dienst', async () => {
  const r = await scim.maak(accounts, 'alfa', { userName: 'directeur@alfa.test' });
  accounts.setTier(r.user.id, 'business'); // zoals de menselijke goedkeuring dat doet
  scim.zetActief(accounts, 'alfa', r.user.id, false);
  scim.zetActief(accounts, 'alfa', r.user.id, true);
  assert.equal(accounts.getUserById(r.user.id).tier, 'business', 'SCIM raakt de pas nooit aan');
});

/* ================= 4. de lijst en het filter ================= */

test('14. de lijst van een organisatie bevat alleen die organisatie', () => {
  const alfa = scim.accountsVan(accounts, 'alfa').map(u => accounts.emailOf(u));
  assert.ok(alfa.includes('nieuw@alfa.test'));
  assert.ok(alfa.every(e => e.endsWith('@alfa.test')), 'niets van een andere klant: ' + alfa.join(', '));
  assert.equal(scim.accountsVan(accounts, 'beta').length, 0, 'beta heeft nog niemand');
});

test('15. het filter begrijpt userName eq, en zegt het als het iets niet snapt', () => {
  assert.deepEqual(filter.ontleed('userName eq "a@b.test"'), { soort: 'gelijk', attribuut: 'userName', waarde: 'a@b.test' });
  assert.deepEqual(filter.ontleed("userName Eq 'A@B.TEST'"), { soort: 'gelijk', attribuut: 'userName', waarde: 'a@b.test' });
  assert.equal(filter.ontleed('').soort, 'alles');
  /* Een filter dat we niet snappen MOET een fout worden, geen lege lijst: bij
     een lege lijst denkt de IdP "bestaat nog niet" en maakt hij een tweede
     account aan. */
  assert.equal(filter.ontleed('userName co "test"').soort, 'onbekend');
  assert.equal(filter.ontleed('active eq true').soort, 'onbekend');
  assert.equal(filter.ontleed('userName eq "a" and active eq true').soort, 'onbekend');
});

/* ================= 5. de vorm naar buiten ================= */

test('16. de SCIM-gebruiker lekt geen codenaam, pas of dossier', () => {
  const u = scim.zoekOpEmail(accounts, 'alfa', 'nieuw@alfa.test');
  const j = JSON.stringify(vorm.gebruiker(u, accounts.emailOf(u), '/api/scim/v2'));
  assert.ok(!j.includes(u.codename), 'de codenaam is van ons, niet van de IdP van de klant');
  assert.ok(!j.includes('password'), 'geen wachtwoordhash');
  assert.ok(!/"tier"/.test(j), 'de pas gaat de klant niet aan');
  assert.ok(!/member_state|enc_name|enc_email/.test(j), 'geen ruwe kolommen');
  assert.ok(j.includes('nieuw@alfa.test'), 'het adres mag wel: dat is wat de IdP zelf stuurde');
});

test('17. de provider-config belooft niets wat we niet kunnen', () => {
  const c = vorm.providerConfig('/api/scim/v2');
  assert.equal(c.bulk.supported, false);
  assert.equal(c.sort.supported, false);
  assert.equal(c.changePassword.supported, false, 'wachtwoorden lopen niet via SCIM');
  assert.equal(c.patch.supported, true);
  assert.equal(c.filter.supported, true);
});

/* ================= 6. de PATCH-vormen die IdPs echt sturen ================= */

test('18. alle drie de PATCH-vormen voor active worden herkend', () => {
  const vormen = [
    { Operations: [{ op: 'replace', path: 'active', value: false }] },
    { Operations: [{ op: 'replace', value: { active: false } }] },
    { Operations: [{ op: 'Replace', path: 'active', value: 'False' }] }
  ];
  for (const v of vormen) {
    const r = scim.uitPatch(v);
    assert.equal(r.herkend, 1, JSON.stringify(v));
    assert.equal(r.actief, false, JSON.stringify(v));
  }
  const aan = scim.uitPatch({ Operations: [{ op: 'replace', path: 'active', value: true }] });
  assert.equal(aan.actief, true);
});

test('19. een PATCH op iets anders dan active verandert niets', () => {
  /* Bewust smal: mocht de IdP de naam of het adres willen overschrijven, dan
     zou dat de identiteitskluis raken. Dat laten we niet toe. */
  const r = scim.uitPatch({ Operations: [{ op: 'replace', path: 'userName', value: 'anders@alfa.test' }] });
  assert.equal(r.herkend, 0);
  assert.equal(r.actief, undefined);
});

/* ================= 7. de inlogkant ================= */

test('20. een uitgezet account komt ook met het juiste wachtwoord niet binnen', async () => {
  const u = await accounts.createUser({ email: 'wachtwoord@alfa.test', password: 'echtgeheim123',
    tier: 'rtg', realName: 'Met Wachtwoord' });
  sso.legVast('alfa', 'scim:wachtwoord@alfa.test', u.id);
  assert.ok(await accounts.verifyPassword('echtgeheim123', u.password_hash), 'het wachtwoord klopt');
  assert.equal(accounts.isActief(u), true);

  scim.zetActief(accounts, 'alfa', u.id, false);
  const na = accounts.getUserById(u.id);
  assert.ok(await accounts.verifyPassword('echtgeheim123', na.password_hash), 'het wachtwoord klopt nog steeds');
  assert.equal(accounts.isActief(na), false, 'maar de deur zit dicht -- routes/auth.js weigert hierop');
});
