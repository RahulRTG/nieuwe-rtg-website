/* ============================================================================
   TOKEN-DOMEINSCHEIDING — regressie voor RTG-V1-RELEASE blocker 1.

   DE FOUT (bewezen in de audit): `verifyToken` onderscheidde een SESSIEtoken
   (body `id.exp.uitgegeven.sid`) niet van een ACTIEtoken (body
   `id.purpose.exp.nonce`). Beide tekenden met dezelfde sessiesleutel, en
   `Number('inlog2') < Date.now()` is false — dus het 2FA-bewijs (en elk ander
   actietoken: verify-email, mailwissel, sso-overdracht) werkte als volwaardige
   Bearer-sessie. Volledige 2FA-bypass + sessie uit een gelekte e-maillink.

   DE FIX: actietokens tekenen met een per-doel afgeleide sleutel
   (`kluis.signMet(kluis.sleutelVoor('actie:'+purpose), …)`), zodat een
   sessieverifier ze cryptografisch nooit accepteert en een actieverifier voor
   doel A nooit een token voor doel B. Plus een defense-in-depth-grens:
   een sessietoken heeft een NUMERIEKE exp.

   Deze toets zou VÓÓR de fix zakken (actietoken → user) en slaagt erna.

   Draai los: node --test test/token-domeinscheiding.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

/* Verse, geisoleerde datamap VÓÓR de modules laden (zoals accounts.test.js). */
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-tokengrens-'));
process.env.RTG_DATA_DIR = TMP;
process.env.NODE_ENV = 'test';
process.env.RTG_MAGNAAT_TEST = '1';

const accounts = require('../server/accounts');
const kluis = require('../server/accounts/kluis');
accounts.init();

const { startServer, stop, postJson } = require('./helper');
const { totpCode } = require('../server/kern/totp');

test.after(() => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

async function versLid(suffix) {
  return accounts.createUser({
    email: 'tokengrens' + suffix + '@voorbeeld.test', password: 'geheim12',
    tier: 'rtg', realName: 'Doel ' + suffix, phone: '+3161111' + suffix });
}

/* ---------------------------------------------------------------------------
   DEEL A — de sessieverifier (unit, zonder server).
   ------------------------------------------------------------------------- */

test('A1. een geldig SESSIE-token wordt geaccepteerd', async () => {
  const u = await versLid('1');
  const sess = accounts.issueToken(u.id, 30);
  const uit = accounts.verifyToken(sess);
  assert.ok(uit && uit.id === u.id, 'een vers sessietoken hoort de gebruiker terug te geven');
});

test('A2. een VERLOPEN sessie-token wordt geweigerd', async () => {
  const u = await versLid('2');
  const sess = accounts.issueToken(u.id, -1); // exp een dag in het verleden
  assert.equal(accounts.verifyToken(sess), null);
});

test('A3. een inlog2-ACTIEtoken wordt NIET als sessie geaccepteerd (2FA-bypass dicht)', async () => {
  const u = await versLid('3');
  const bewijs = accounts.issueActionToken(u.id, 'inlog2', 5 * 60 * 1000);
  assert.equal(accounts.verifyToken(bewijs), null,
    'het 2FA-bewijs mag nooit door de sessieverifier komen');
});

test('A4. een verify-email-ACTIEtoken wordt NIET als sessie geaccepteerd', async () => {
  const u = await versLid('4');
  const t = accounts.issueActionToken(u.id, 'verify-email', 3 * 86400000);
  assert.equal(accounts.verifyToken(t), null,
    'een gelekte e-mailverificatielink mag geen sessie worden');
});

test('A5. mailwissel- en sso-overdracht-actietokens worden NIET als sessie geaccepteerd', async () => {
  const u = await versLid('5');
  for (const purpose of ['mailwissel', 'sso-overdracht']) {
    const t = accounts.issueActionToken(u.id, purpose, 10 * 60 * 1000);
    assert.equal(accounts.verifyToken(t), null, purpose + ' mag geen sessie worden');
  }
});

test('A6. een actietoken voor doel A wordt niet aanvaard als doel B (cross-purpose)', async () => {
  const u = await versLid('6');
  const inlog2 = accounts.issueActionToken(u.id, 'inlog2', 5 * 60 * 1000);
  assert.equal(accounts.verifyActionToken(inlog2, 'verify-email'), null,
    'een inlog2-token mag niet als verify-email verifieren');
  assert.equal(accounts.verifyActionToken(inlog2, 'inlog2').id, u.id,
    'maar met het juiste doel werkt hij nog wel');
});

test('A7. een gemanipuleerd token wordt geweigerd (handtekening + body)', async () => {
  const u = await versLid('7');
  const sess = accounts.issueToken(u.id, 30);
  const [b64, sig] = sess.split('.');
  // sig aangepast
  const anderSig = (sig[0] === 'a' ? 'b' : 'a') + sig.slice(1);
  assert.equal(accounts.verifyToken(b64 + '.' + anderSig), null, 'andere handtekening → null');
  // body aangepast (id opgehoogd), oude sig: dekt de nieuwe body niet
  const body = Buffer.from(b64, 'base64url').toString().split('.');
  body[0] = String(Number(body[0]) + 1);
  const andereBody = Buffer.from(body.join('.')).toString('base64url');
  assert.equal(accounts.verifyToken(andereBody + '.' + sig), null, 'gewijzigde body → null');
});

test('A8. een ingetrokken sessie wordt geweigerd', async () => {
  const u = await versLid('8');
  const sess = accounts.issueToken(u.id, 30);
  const sid = accounts.sessieVan(sess);
  assert.ok(sid, 'het sessietoken draagt een sid');
  // trekInSessie wil de vervaldatum weten (een sid draagt geen tijd); ruim na de 30d van het token.
  await accounts.trekInSessie(sid, Date.now() + 40 * 86400000);
  if (accounts.wachtIntrekkingen) await accounts.wachtIntrekkingen();
  assert.equal(accounts.verifyToken(sess), null, 'na intrekken van de sessie: geen toegang meer');
});

test('A9. DEFENSE-IN-DEPTH: een met de sessiesleutel getekend blob met niet-numerieke exp wordt geweigerd', async () => {
  const u = await versLid('9');
  /* Bouw exact de OUDE actietoken-vorm na: body `id.purpose.exp.nonce`, getekend
     met de SESSIEsleutel (kluis.sign). Dit is precies wat de pre-fix code
     uitgaf; de handtekening klopt dus, en alleen de numerieke-exp-grens houdt
     hem tegen. Zakt deze toets, dan is de oude bypass terug. */
  const body = u.id + '.inlog2.' + (Date.now() + 300000) + '.' + require('crypto').randomBytes(16).toString('base64url');
  const nepToken = Buffer.from(body).toString('base64url') + '.' + kluis.sign(body);
  assert.equal(accounts.verifyToken(nepToken), null,
    'een S.SECRET-getekend blob met purpose op de exp-positie mag geen sessie worden');
});

test('A10. de 2FA-flow blijft werken: verifyActionToken(inlog2) geeft de gebruiker', async () => {
  const u = await versLid('10');
  const bewijs = accounts.issueActionToken(u.id, 'inlog2', 5 * 60 * 1000);
  const uit = accounts.verifyActionToken(bewijs, 'inlog2');
  assert.ok(uit && uit.id === u.id, 'het 2FA-bewijs hoort met het juiste doel te verifieren');
});

/* ---------------------------------------------------------------------------
   DEEL B — end-to-end securitytest tegen een echte server.

   password → 2FA-challenge (bewijs) → bewijs als Bearer op een ledenroute
   MOET 401 geven, nooit accounttoegang. En de echte tweede stap moet wel
   werken en een bruikbaar sessietoken opleveren.
   ------------------------------------------------------------------------- */
test('B1. e2e: het 2FA-challenge-bewijs werkt NIET als Bearer-sessie, de echte stap wel', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-tokengrens-e2e-'));
  const srv = await startServer({ env: { RTG_DATA_DIR: dir } });
  const base = srv.base;
  const post = postJson(base);
  try {
    const email = 'e2e-2fa@voorbeeld.test';
    const wachtwoord = 'geheim12';
    // 1. registreren → sessietoken
    const reg = await post('/api/auth/register', { name: 'E2E Doel', email, password: wachtwoord, geboortedatum: '1990-01-01' });
    const token = reg.token;
    assert.ok(token, 'registratie hoort een sessietoken te geven: ' + JSON.stringify(reg).slice(0, 160));

    // 2. tweede factor aanzetten (begin met wachtwoord, dan bevestigen met TOTP)
    const begin = await post('/api/mijn/tweefactor/begin', { huidig: wachtwoord }, token);
    assert.ok(begin.geheim, 'begin() hoort een geheim te geven: ' + JSON.stringify(begin).slice(0, 160));
    const code = totpCode(begin.geheim, Date.now(), 30);
    const bevestig = await post('/api/mijn/tweefactor/bevestig', { code }, token);
    assert.ok(bevestig.ok, 'bevestigen van de tweede factor moet slagen: ' + JSON.stringify(bevestig).slice(0, 160));

    // 3. opnieuw inloggen met wachtwoord → nu een BEWIJS i.p.v. een token
    const login = await post('/api/auth/login', { login: email, password: wachtwoord, pasApp: 'rtg' });
    assert.ok(login.bewijs && !login.token,
      'met 2FA aan hoort login een bewijs te geven en GEEN token: ' + JSON.stringify(login).slice(0, 160));

    // 4. DE AANVAL: het bewijs als Bearer op een ledenroute → MOET 401
    const aanval = await fetch(base + '/api/mijn/tweefactor', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + login.bewijs },
      body: '{}' });
    assert.equal(aanval.status, 401,
      'het 2FA-bewijs mag als Bearer nooit toegang geven (kreeg ' + aanval.status + ')');

    // 5. de ECHTE tweede stap levert een bruikbaar sessietoken.
    //    Een ANDER venster dan 'bevestig' hierboven: totpOk accepteert -1/0/+1
    //    maar onthoudt een gebruikte code 90s, dus de huidige-venstercode is al
    //    verbruikt. De +1-venstercode valt binnen de tolerantie en is distinct.
    const code2 = totpCode(begin.geheim, Date.now() + 30000, 30);
    const tweede = await post('/api/auth/tweede', { bewijs: login.bewijs, code: code2 });
    assert.ok(tweede.token, 'de echte tweede stap hoort een sessietoken te geven: ' + JSON.stringify(tweede).slice(0, 160));
    const ok = await fetch(base + '/api/mijn/tweefactor', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tweede.token },
      body: '{}' });
    assert.equal(ok.status, 200, 'het echte sessietoken hoort wel toegang te geven (kreeg ' + ok.status + ')');
  } finally {
    await stop(srv);
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
  }
});
