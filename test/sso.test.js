/* ============================================================================
   SSO: de laag waarmee een zakelijke klant met zijn eigen identiteitsprovider
   inlogt. Dit is auth, dus de tests gaan vooral over wat er NIET mag.

   De valse identiteitsprovider hieronder is een echt sleutelpaar; we tekenen er
   echte tokens mee. Geen netwerk nodig: de discovery en de sleutelbos worden
   als functie ingespoten, precies zoals de productiecode dat toelaat.

   Draai los: node --experimental-sqlite --test test/sso.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-sso-'));
process.env.RTG_DATA_DIR = TMP;

const accounts = require('../server/accounts');
accounts.init();

const jwt = require('../server/sso/jwt');
const staat = require('../server/sso/staat');
const koppelingen = require('../server/sso/koppelingen');
const oidc = require('../server/sso/oidc');
const sso = require('../server/sso');
sso.zorgTabel();

test.after(() => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

/* ---------- de valse provider ---------- */
const paar = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const JWK = Object.assign(paar.publicKey.export({ format: 'jwk' }), { kid: 'k1', alg: 'RS256', use: 'sig' });
const JWKS = { keys: [JWK] };
const ISS = 'https://idp.klantje.test';
const CLIENT = 'rtg-client-1';

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const sec = () => Math.floor(Date.now() / 1000);
function tekenToken(claims, kop, sleutel) {
  const stuk = b64(Object.assign({ alg: 'RS256', typ: 'JWT', kid: 'k1' }, kop || {})) + '.' + b64(claims);
  const sig = crypto.sign('sha256', Buffer.from(stuk), sleutel || paar.privateKey).toString('base64url');
  return stuk + '.' + sig;
}
const BASIS = () => ({ iss: ISS, aud: CLIENT, sub: 'idp-user-1', nonce: 'n1',
  email: 'piet@klantje.test', email_verified: true, name: 'Piet Klantje', exp: sec() + 300 });
const EISEN = { iss: ISS, aud: CLIENT, nonce: 'n1' };

/* ================= 1. het token zelf ================= */

test('1. een eerlijk token komt erdoor', () => {
  const c = jwt.verifieer(tekenToken(BASIS()), JWKS, EISEN);
  assert.equal(c.sub, 'idp-user-1');
  assert.equal(c.email, 'piet@klantje.test');
});

test('2. alg:none wordt geweigerd -- anders is een handtekening optioneel', () => {
  const stuk = b64({ alg: 'none', kid: 'k1' }) + '.' + b64(BASIS()) + '.';
  assert.throws(() => jwt.verifieer(stuk, JWKS, EISEN), /staat niet op de lijst/);
});

test('3. algoritme-verwarring: HS256 met de publieke sleutel als geheim', () => {
  /* De klassieker. Wie het alg-veld uit het token overneemt, gebruikt hier de
     PUBLIEKE sleutel als HMAC-geheim -- en die kent iedereen. */
  const kop = { alg: 'HS256', kid: 'k1' };
  const stuk = b64(kop) + '.' + b64(BASIS());
  const pem = paar.publicKey.export({ type: 'spki', format: 'pem' });
  const vals = stuk + '.' + crypto.createHmac('sha256', pem).update(stuk).digest('base64url');
  assert.throws(() => jwt.verifieer(vals, JWKS, EISEN), /staat niet op de lijst/);
});

test('4. geknoeide inhoud onder een echte handtekening valt af', () => {
  const echt = tekenToken(BASIS()).split('.');
  const vals = echt[0] + '.' + b64(Object.assign(BASIS(), { sub: 'de-baas' })) + '.' + echt[2];
  assert.throws(() => jwt.verifieer(vals, JWKS, EISEN), /handtekening klopt niet/);
});

test('5. een vreemde sleutel is geen sleutel', () => {
  const vreemd = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  assert.throws(() => jwt.verifieer(tekenToken(BASIS(), null, vreemd.privateKey), JWKS, EISEN), /handtekening klopt niet/);
});

test('6. verlopen, en zonder exp, allebei weigeren', () => {
  assert.throws(() => jwt.verifieer(tekenToken(Object.assign(BASIS(), { exp: sec() - 3600 })), JWKS, EISEN), /verlopen/);
  const zonder = BASIS(); delete zonder.exp;
  assert.throws(() => jwt.verifieer(tekenToken(zonder), JWKS, EISEN), /wanneer het verloopt/);
});

test('7. een token van een andere uitgever of voor een andere ontvanger', () => {
  assert.throws(() => jwt.verifieer(tekenToken(Object.assign(BASIS(), { iss: 'https://kwaad.test' })), JWKS, EISEN), /andere uitgever/);
  // dit is het geval "andere klant bij dezelfde provider"
  assert.throws(() => jwt.verifieer(tekenToken(Object.assign(BASIS(), { aud: 'andere-klant' })), JWKS, EISEN), /niet voor ons bestemd/);
  assert.throws(() => jwt.verifieer(tekenToken(Object.assign(BASIS(), { aud: [CLIENT, 'x'], azp: 'x' })), JWKS, EISEN), /andere partij aangevraagd/);
});

test('8. de nonce koppelt het token aan DEZE poging (geen replay)', () => {
  assert.throws(() => jwt.verifieer(tekenToken(Object.assign(BASIS(), { nonce: 'oud' })), JWKS, EISEN), /nonce hoort niet/);
});

/* ================= 2. de state van een inlogpoging ================= */

test('9. de state gaat versleuteld mee en komt heel terug', () => {
  const v = staat.maakVerifier();
  const s = staat.inpakken({ org: 'klantje', nonce: 'n1', verifier: v, terug: '/apps/app.html' });
  assert.ok(!s.includes('klantje'), 'de organisatie mag niet leesbaar in de state staan');
  assert.ok(!s.includes(v), 'de PKCE-verifier al helemaal niet');
  const uit = staat.uitpakken(s);
  assert.equal(uit.org, 'klantje');
  assert.equal(uit.verifier, v);
});

test('10. aan de state knoeien maakt hem ongeldig, niet anders', () => {
  const s = staat.inpakken({ org: 'klantje', nonce: 'n1', verifier: 'v', terug: '/' });
  const stuk = Buffer.from(s, 'base64url');
  stuk[stuk.length - 3] ^= 0xff; // een bit omzetten in de cijfertekst
  assert.equal(staat.uitpakken(stuk.toString('base64url')), null, 'GCM hoort dit te merken');
  assert.equal(staat.uitpakken('onzin'), null);
  assert.equal(staat.uitpakken(''), null);
});

test('11. terugkeer alleen naar een eigen pad -- geen open redirect', () => {
  assert.equal(staat.veiligTerug('https://kwaad.test/phish'), '/');
  assert.equal(staat.veiligTerug('//kwaad.test/phish'), '/');
  assert.equal(staat.veiligTerug('/apps\\kwaad'), '/');
  assert.equal(staat.veiligTerug('/apps/app.html?pas=rtg'), '/apps/app.html?pas=rtg');
});

test('12. PKCE: de challenge is de sha256 van de verifier', () => {
  const v = staat.maakVerifier();
  const verwacht = crypto.createHash('sha256').update(v).digest('base64url');
  assert.equal(staat.challengeVan(v), verwacht);
  assert.notEqual(staat.maakVerifier(), staat.maakVerifier(), 'elke poging een eigen verifier');
});

/* ================= 3. de koppelingen ================= */

test('13. een koppeling zonder domeinlijst wordt geweigerd', () => {
  assert.throws(() => koppelingen.zet({ org: 'leeg', issuer: ISS, clientId: CLIENT, domeinen: '' }),
    /minstens een e-maildomein/);
  // "nl" is geen domein: dat zou een half land binnenlaten
  assert.throws(() => koppelingen.zet({ org: 'leeg', issuer: ISS, clientId: CLIENT, domeinen: 'nl' }),
    /minstens een e-maildomein/);
});

test('14. een issuer zonder https wordt geweigerd', () => {
  assert.throws(() => koppelingen.zet({ org: 'x', issuer: 'http://idp.test', clientId: 'c', domeinen: 'x.test' }),
    /https-adres/);
});

test('15. het client-geheim staat versleuteld in de database', () => {
  koppelingen.zet({ org: 'klantje', naam: 'Klantje BV', issuer: ISS, clientId: CLIENT,
    clientSecret: 'zeer-geheim-123', domeinen: 'klantje.test' });
  const rij = require('../server/accounts/state').db
    .prepare('SELECT enc_client_secret FROM sso_koppelingen WHERE org = ?').get('klantje');
  assert.ok(rij.enc_client_secret, 'er staat iets');
  assert.ok(!String(rij.enc_client_secret).includes('zeer-geheim-123'), 'maar niet leesbaar');
  assert.equal(koppelingen.geheimVan('klantje'), 'zeer-geheim-123', 'met de kluissleutel wel terug te halen');
});

test('16. een domein mag bij hoogstens EEN organisatie horen', () => {
  /* Zonder deze regel bepaalt de volgorde in de tabel wie een adres mag claimen,
     en dan is de domeinlijst geen beveiliging maar een suggestie. */
  assert.throws(() => koppelingen.zet({ org: 'kaper', issuer: 'https://idp.kaper.test',
    clientId: 'c', domeinen: 'klantje.test' }), /hoort al bij organisatie "klantje"/);
});

test('17. het overzicht geeft het geheim niet mee', () => {
  const k = koppelingen.lijst().find(x => x.org === 'klantje');
  assert.equal(k.clientSecret, undefined);
  assert.equal(JSON.stringify(k).includes('zeer-geheim'), false);
});

test('18. een e-mailadres vindt zijn eigen koppeling, en alleen die', () => {
  assert.equal(koppelingen.vindVoorEmail('piet@klantje.test').org, 'klantje');
  assert.equal(koppelingen.vindVoorEmail('piet@KLANTJE.TEST').org, 'klantje', 'hoofdletters doen er niet toe');
  assert.equal(koppelingen.vindVoorEmail('piet@ergensanders.test'), null);
  assert.equal(koppelingen.vindVoorEmail('geen-adres'), null);
});

/* ================= 4. wie er binnenkomt, en met welke pas ================= */

test('19. een nieuwe medewerker krijgt een account -- en NOOIT een betaalde pas', async () => {
  /* De merkregel: Lifestyle en Business komen uitsluitend na een menselijk
     besluit. Een inlog bij de provider van een klant is dat niet. */
  const k = koppelingen.vind('klantje');
  const claims = Object.assign(BASIS(), { sub: 'nieuw-1', email: 'nieuw@klantje.test' });
  const r = await sso.aanmelden(accounts, k, claims);
  assert.equal(r.nieuw, true);
  assert.equal(r.user.tier, 'rtg', 'hooguit RTG, net als zelf-registreren');
  assert.notEqual(r.user.tier, 'business');
  assert.notEqual(r.user.tier, 'lifestyle');
  // de echte naam hoort in de kluis, niet in een operationele kolom
  assert.ok(!String(r.user.enc_name).includes('Piet'), 'naam versleuteld');
  assert.equal(accounts.realNameOf(r.user), 'Piet Klantje');
  assert.ok(r.user.codename, 'operationeel draait het op de codenaam');
});

test('20. een niet-bevestigd e-mailadres komt er niet in', async () => {
  const k = koppelingen.vind('klantje');
  const claims = Object.assign(BASIS(), { sub: 'onbevestigd', email: 'x@klantje.test', email_verified: false });
  await assert.rejects(() => sso.aanmelden(accounts, k, claims), /bevestigt dit e-mailadres niet/);
  const zonder = Object.assign(BASIS(), { sub: 'geenveld', email: 'y@klantje.test' });
  delete zonder.email_verified;
  await assert.rejects(() => sso.aanmelden(accounts, k, zonder), /bevestigt dit e-mailadres niet/);
});

test('21. DE OVERNAME-AANVAL: de provider van klant A claimt een adres van klant B', async () => {
  /* Een provider mag in een token elk adres zetten dat hij wil. Zonder de
     domeincontrole zou de provider van klantje hiermee de directeur van een
     ander bedrijf worden. */
  const k = koppelingen.vind('klantje');
  const claims = Object.assign(BASIS(), { sub: 'kaper', email: 'directeur@anderbedrijf.test' });
  await assert.rejects(() => sso.aanmelden(accounts, k, claims), /valt buiten de domeinen/);
});

test('22. een uitgezette koppeling laat niemand meer binnen', async () => {
  const uit = koppelingen.zet({ org: 'klantje', naam: 'Klantje BV', issuer: ISS, clientId: CLIENT,
    domeinen: 'klantje.test', actief: false });
  await assert.rejects(() => sso.aanmelden(accounts, uit, Object.assign(BASIS(), { sub: 'na-uitzetten' })),
    /staat uit/);
  koppelingen.zet({ org: 'klantje', naam: 'Klantje BV', issuer: ISS, clientId: CLIENT,
    domeinen: 'klantje.test', actief: true });
});

test('23. dezelfde persoon komt op hetzelfde account terug, ook na een adreswijziging', async () => {
  const k = koppelingen.vind('klantje');
  const eerst = await sso.aanmelden(accounts, k, Object.assign(BASIS(), { sub: 'vast-1', email: 'oud@klantje.test' }));
  // zelfde sub, ander adres: de provider heeft haar naam gewijzigd
  const later = await sso.aanmelden(accounts, k, Object.assign(BASIS(), { sub: 'vast-1', email: 'nieuwadres@klantje.test' }));
  assert.equal(later.user.id, eerst.user.id, 'op sub matchen, niet op e-mail');
  assert.equal(later.nieuw, false);
});

test('24. een bestaand RTG-account wordt gekoppeld, met behoud van zijn pas', async () => {
  /* Iemand had al een Business Pass en gaat voortaan via SSO naar binnen. Die
     pas moet blijven staan -- en SSO mag hem net zo min afpakken als geven. */
  const bestaand = await accounts.createUser({ email: 'baas@klantje.test', password: 'geheim12345',
    tier: 'rtg', realName: 'De Baas' });
  accounts.setTier(bestaand.id, 'business'); // zoals de goedkeuringsflow dat doet
  const k = koppelingen.vind('klantje');
  const r = await sso.aanmelden(accounts, k, Object.assign(BASIS(), { sub: 'baas-1', email: 'baas@klantje.test' }));
  assert.equal(r.user.id, bestaand.id);
  assert.equal(r.gekoppeld, true);
  assert.equal(r.nieuw, false);
  assert.equal(accounts.getUserById(bestaand.id).tier, 'business', 'de pas blijft ongemoeid');
});

/* ================= 5. de ontdekking van de provider ================= */

test('25. een discovery-document dat een andere issuer noemt, wordt geweigerd', async () => {
  /* Anders wijst een provider ons naar de deuren van een aanvaller, en merken
     we dat pas als er al iemand binnen is. */
  oidc.leegOntdek(ISS);
  const vals = async () => ({ issuer: 'https://iemandanders.test',
    authorization_endpoint: ISS + '/auth', token_endpoint: ISS + '/token', jwks_uri: ISS + '/jwks' });
  await assert.rejects(() => oidc.ontdek(ISS, vals), /andere issuer dan het adres/);
});

test('26. een discovery-document zonder de nodige adressen wordt geweigerd', async () => {
  oidc.leegOntdek(ISS);
  const half = async () => ({ issuer: ISS, authorization_endpoint: ISS + '/auth' });
  await assert.rejects(() => oidc.ontdek(ISS, half), /mist token_endpoint/);
});

test('27. het startadres draagt PKCE, state en nonce mee', async () => {
  oidc.leegOntdek(ISS);
  const doc = await oidc.ontdek(ISS, async () => ({ issuer: ISS,
    authorization_endpoint: ISS + '/auth', token_endpoint: ISS + '/token', jwks_uri: ISS + '/jwks' }));
  const v = staat.maakVerifier();
  const u = new URL(oidc.startAdres(doc, { clientId: CLIENT, redirectUri: 'https://rtg.test/api/sso/terug',
    state: 'st', nonce: 'n1', challenge: staat.challengeVan(v) }));
  assert.equal(u.searchParams.get('response_type'), 'code', 'code flow, niet impliciet');
  assert.equal(u.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(u.searchParams.get('code_challenge'), staat.challengeVan(v));
  assert.equal(u.searchParams.get('nonce'), 'n1');
  assert.ok(!u.searchParams.get('code_challenge').includes(v), 'de verifier zelf gaat niet mee');
});

test('28. een provider op een intern adres wordt niet aangeroepen (SSRF)', async () => {
  const { keurUrl } = require('../server/sso/haal');
  for (const adres of ['https://169.254.169.254/latest/meta-data/', 'https://10.0.0.5/.well-known/openid-configuration',
    'https://localhost/x', 'https://127.0.0.1/x', 'https://[::1]/x'])
    assert.throws(() => keurUrl(adres), /interne netwerk/, adres + ' hoort geweigerd te worden');
  assert.throws(() => keurUrl('http://idp.test/x'), /https/);
  assert.ok(keurUrl('https://idp.klantje.test/x'), 'een gewoon extern https-adres mag wel');
});
