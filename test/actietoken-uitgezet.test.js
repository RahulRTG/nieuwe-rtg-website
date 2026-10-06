/* ============================================================================
   EEN ACTIETOKEN VAN EEN UITGEZET ACCOUNT GELDT NIET -- regressie voor N20 uit
   de V1-audit (RTG-V1-RELEASE-READINESS-AUDIT.md).

   DE FOUT: verifyActionToken keek niet naar `actief`. Een sessietoken valt af
   zodra het account op non-actief staat (uit dienst gemeld door de organisatie,
   via SCIM); een actietoken niet. De herkeuringen van N12 zagen het: bij een
   uitgezet account gaven alle vijf de doelen (inlog2, tech2, mailwissel,
   verify-email, sso-overdracht) de gebruiker terug. Een openstaande mailwissel
   zette dus het inlogadres van een uit dienst gemeld account om, en een bewijs
   uit stap een leverde na SCIM gewoon een inlog op.

   DE FIX (besluit van de eigenaar, keuze a): verifyActionToken weigert een
   uitgezet account, net als verifyToken. Er is EEN opvatting van "uitgezet"
   (server/accounts/sessiegrens.js `uitgezet`), en verifyToken,
   verifyActionToken en accounts.isActief lezen alle drie die. Uitzetten is geen
   wissen: staat het account weer aan, dan telt een token dat nog niet verlopen
   of ingetrokken is weer, zoals bij een sessie. "Sluit alle andere sessies"
   (N21) blijft bewust buiten deze grens en wordt hier niet getoetst.

   Deel A is per doel, zonder server, ook voor een mailboxlink in de oude vorm
   en voor een account met sessiegrens. Deel B houdt de opvatting op een plek,
   en de lijst van eigen vergelijkingen buiten server/accounts/ in
   sessiegrens.js tegen de bron. Deel C is inlog2 tegen een echte server, met
   een echte SCIM-PATCH tussen stap een en stap twee. A en C zakken zonder de
   fix.

   Draai los: node --test test/actietoken-uitgezet.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

/* Verse, geisoleerde datamap VOOR de modules laden (zoals accounts.test.js). */
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-actieuit-'));
process.env.RTG_DATA_DIR = TMP;
process.env.NODE_ENV = 'test';
process.env.RTG_MAGNAAT_TEST = '1';

const accounts = require('../server/accounts');
const kluis = require('../server/accounts/kluis');
accounts.init();

const { startServer, stop } = require('./helper');
const { totpCode } = require('../server/kern/totp');
const { zwaarApi } = require('./zwaarpasskey');

test.after(() => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

const TTL = { 'inlog2': 5 * 60 * 1000, 'tech2': 5 * 60 * 1000, 'sso-overdracht': 60000,
  'mailwissel': 24 * 3600 * 1000, 'verify-email': 3 * 86400000 };

let teller = 0;
async function nieuwLid() {
  const n = ++teller;
  return accounts.createUser({
    email: 'actieuit' + n + '@voorbeeld.test', password: 'geheim12',
    tier: 'rtg', realName: 'Uit ' + n, phone: '+3162333' + String(n).padStart(4, '0') });
}

/* ---------------------------------------------------------------------------
   DEEL A -- per doel: uitgeven, uitzetten, weigeren, weer aanzetten, geldig.
   ------------------------------------------------------------------------- */
for (const [doel, ttl] of Object.entries(TTL)) {
  test('A. ' + doel + ': een uitgezet account heeft geen geldig token, weer aan en het telt weer', async () => {
    const u = await nieuwLid();
    const tok = accounts.issueActionToken(u.id, doel, ttl);
    assert.equal(accounts.verifyActionToken(tok, doel).id, u.id, 'voorwaarde: actief werkt het token');

    const uit = accounts.zetActief(u.id, false);
    assert.equal(uit.actief, 0, 'voorwaarde: het account staat op non-actief');
    assert.equal(Number(uit.sessies_vanaf || 0), 0,
      'voorwaarde: uitzetten zet de sessiegrens niet, dus alleen "uitgezet" kan het token tegenhouden');
    assert.equal(accounts.verifyActionToken(tok, doel), null,
      'een ' + doel + '-token van een uitgezet account telt niet, net als een sessie');
    assert.equal(accounts.verifyActionToken(accounts.issueActionToken(u.id, doel, ttl), doel), null,
      'ook een token dat NA het uitzetten is uitgegeven, telt niet: het gaat over het account en niet over het moment');

    accounts.zetActief(u.id, true);
    const weer = accounts.verifyActionToken(tok, doel);
    assert.ok(weer && weer.id === u.id,
      'weer aan: uitzetten is geen wissen of intrekken, dus het token telt tot zijn eigen exp');
  });
}

test('A. tegenproef: een sessietoken weigert een uitgezet account op dezelfde manier', async () => {
  const u = await nieuwLid();
  const sessie = accounts.issueToken(u.id);
  const actie = accounts.issueActionToken(u.id, 'inlog2', TTL.inlog2);
  accounts.zetActief(u.id, false);
  assert.equal(accounts.verifyToken(sessie), null, 'de sessie valt af');
  assert.equal(accounts.verifyActionToken(actie, 'inlog2'), null, 'en het actietoken ook');
  assert.equal(accounts.isActief(accounts.getUserById(u.id)), false, 'en isActief zegt hetzelfde');
  accounts.zetActief(u.id, true);
  assert.equal(accounts.verifyToken(sessie).id, u.id);
  assert.equal(accounts.verifyActionToken(actie, 'inlog2').id, u.id);
  assert.equal(accounts.isActief(accounts.getUserById(u.id)), true);
});

/* DE TWEE VORMEN DIE DE GEVALLEN HIERBOVEN NIET RAKEN. Die geven alleen tokens
   in de nieuwe vorm uit, op accounts zonder sessiegrens. Een mutatie die
   "uitgezet" alleen liet gelden voor een token met een uitgiftemoment, of
   alleen voor een account zonder grens, overleefde ze daardoor allebei (de
   herkeuring van N20). Uitgezet gaat over het ACCOUNT: niet over de vorm van
   het token en niet over de grens ernaast. */

/* Een token in de OUDE vorm (`id.doel.exp.nonce`, zonder uitgiftemoment),
   getekend met de echte per-doel sleutel, zoals oudeVorm() in
   actietoken-sessiegrens.test.js. Alleen de mailboxlinks dragen die vorm nog
   (als moment 0, zie server/accounts/actietokens.js); de inlogbewijzen zijn in
   de oude vorm al dicht, dus daar valt voor "uitgezet" niets te toetsen. */
function mailboxlinkOudeVorm(userId, doel) {
  const body = userId + '.' + doel + '.' + (Date.now() + TTL[doel]) + '.' +
    crypto.randomBytes(16).toString('base64url');
  return Buffer.from(body).toString('base64url') + '.' +
    kluis.signMet(kluis.sleutelVoor('actie:' + doel), body);
}

for (const doel of ['verify-email', 'mailwissel']) {
  test('A. ' + doel + ' in de oude vorm: een uitgezet account heeft ook dan geen geldige link, weer aan en hij telt weer', async () => {
    const u = await nieuwLid();
    const oud = mailboxlinkOudeVorm(u.id, doel);
    assert.equal(Buffer.from(oud.split('.')[0], 'base64url').toString().split('.').length, 4,
      'voorwaarde: het lichaam heeft geen vijfde deel, dus geen uitgiftemoment');
    assert.equal(accounts.verifyActionToken(oud, doel).id, u.id,
      'voorwaarde: zonder grens werkt een link in de oude vorm (moment 0)');

    accounts.zetActief(u.id, false);
    assert.equal(accounts.verifyActionToken(oud, doel), null,
      'een link zonder uitgiftemoment van een uitgezet account telt niet: uitgezet gaat niet over de vorm');

    accounts.zetActief(u.id, true);
    const weer = accounts.verifyActionToken(oud, doel);
    assert.ok(weer && weer.id === u.id, 'weer aan: de link telt weer tot zijn eigen exp');
  });
}

for (const [doel, ttl] of Object.entries(TTL)) {
  test('A. ' + doel + ' bij een account MET sessiegrens: uitgezet weigert ook dan, weer aan en het telt weer', async () => {
    const u = await nieuwLid();
    const grens = accounts.zetSessiegrens(u.id);
    assert.ok(Number(grens.sessies_vanaf) > 0, 'voorwaarde: de sessiegrens staat');
    const tok = accounts.issueActionToken(u.id, doel, ttl);
    assert.equal(accounts.verifyActionToken(tok, doel).id, u.id,
      'voorwaarde: een token van NA de grens werkt, dus alleen "uitgezet" kan het hierna tegenhouden');

    accounts.zetActief(u.id, false);
    assert.equal(accounts.verifyActionToken(tok, doel), null,
      'een ' + doel + '-token van een uitgezet account telt niet, ook als er een sessiegrens staat');

    accounts.zetActief(u.id, true);
    const weer = accounts.verifyActionToken(tok, doel);
    assert.ok(weer && weer.id === u.id, 'weer aan: het token telt weer');
  });
}

/* ---------------------------------------------------------------------------
   DEEL B -- EEN opvatting van "uitgezet".
   ------------------------------------------------------------------------- */
test('B. uitgezet: alleen de waarde 0 is uit, en zonder account gooit hij niet', () => {
  const { uitgezet } = require('../server/accounts/sessiegrens');
  assert.equal(uitgezet({ actief: 0 }), true);
  assert.equal(uitgezet({ actief: 1 }), false);
  assert.equal(uitgezet({}), false, 'een account van voor de kolom is niet uitgezet');
  assert.equal(uitgezet(null), false, 'of het account bestaat, beslist de aanroeper');
  assert.equal(uitgezet(undefined), false);
});

/* Een tweede kopie van de vergelijking geeft op een dag een ander antwoord op
   "is dit account uit dienst" (LAT.md regel 4), en dan merkt niemand het tot een
   deur iemand binnenlaat die de andere buiten houdt. Daarom: in server/accounts/
   vergelijkt alleen sessiegrens.js `actief` met 0, gelezen ZONDER commentaar,
   en de drie lezers roepen uitgezet() aan. Buiten server/accounts/ staan nog
   lezers met een eigen vergelijking; dat die uitgezet() gaan lezen valt buiten
   N20, maar sessiegrens.js NOEMT ze, en de toets hieronder houdt die lijst
   tegen de bron. */
test('B. in server/accounts/ vergelijkt alleen sessiegrens.js `actief` met 0, en de drie lezers roepen hem aan', () => {
  const { zonderCommentaar } = require('../scripts/lib/bron');
  const MAP = path.join(__dirname, '..', 'server', 'accounts');
  const vergelijkers = [];
  for (const naam of fs.readdirSync(MAP).filter(n => n.endsWith('.js')).sort()) {
    const code = zonderCommentaar(fs.readFileSync(path.join(MAP, naam), 'utf8'));
    if (/\.actief\s*[!=]==?\s*0\b|\b0\s*[!=]==?\s*\w+\.actief\b/.test(code)) vergelijkers.push(naam);
  }
  assert.deepEqual(vergelijkers, ['sessiegrens.js'],
    'een tweede opvatting van "uitgezet" in server/accounts/: lees uitgezet() uit sessiegrens.js');
  for (const naam of ['tokens.js', 'actietokens.js', 'users.js']) {
    const code = zonderCommentaar(fs.readFileSync(path.join(MAP, naam), 'utf8'));
    assert.match(code, /\buitgezet\s*\(\s*u\s*\)/, naam + ' leest uitgezet() uit sessiegrens.js');
  }
});

/* DE KOP VAN sessiegrens.js BEWEERT NIET MEER DAN ER STAAT. Hij zei eerst dat
   "uit dienst" door de drie lezers nergens iets anders kon betekenen, terwijl
   buiten server/accounts/ zes eigen vergelijkingen stonden (de herkeuring van
   N20). Nu noemt hij ze, en een lijst die niemand natelt is na de eerstvolgende
   nieuwe deur weer te breed. Dus: elk bestand buiten server/accounts/ dat
   `actief` met 0 vergelijkt staat in het blok "NIET DE ENIGE LEZER, ook hier
   niet", met het juiste aantal, en wat er staat vergelijkt ook echt. Een
   vergelijking met 1 (routes/scim.js logt er een) hoort er ook bij genoemd. */
test('B. de kop van sessiegrens.js noemt precies de eigen vergelijkingen van `actief` buiten server/accounts/', () => {
  const { zonderCommentaar } = require('../scripts/lib/bron');
  const SERVER = path.join(__dirname, '..', 'server');
  const kop = fs.readFileSync(path.join(SERVER, 'accounts', 'sessiegrens.js'), 'utf8');
  const start = kop.indexOf('NIET DE ENIGE LEZER, ook hier niet');
  assert.ok(start > 0, 'het blok over de lezers buiten server/accounts/ staat in sessiegrens.js');
  const blok = kop.slice(start, kop.indexOf('\n\n', start));

  const AANTAL = { twee: 2, drie: 3, vier: 4 };
  const genoemd = {};
  for (const m of blok.matchAll(/^[ \t]+([\w/.-]+\.js)\b[ \t]*(?:\((\w+) keer\))?/gm)) genoemd[m[1]] = AANTAL[m[2]] || 1;

  const metNul = {};
  const metEen = [];
  for (const rel of fs.readdirSync(SERVER, { recursive: true }).map(String).sort()) {
    const pad = rel.split(path.sep).join('/');
    if (!pad.endsWith('.js') || pad.startsWith('accounts/') || pad.startsWith('data/')) continue;
    const code = zonderCommentaar(fs.readFileSync(path.join(SERVER, rel), 'utf8'));
    const nul = code.match(/\.actief\s*[!=]==?\s*0\b|\b0\s*[!=]==?\s*[\w.]+\.actief\b/g);
    if (nul) metNul[pad] = nul.length;
    if (/\.actief\s*[!=]==?\s*1\b|\b1\s*[!=]==?\s*[\w.]+\.actief\b/.test(code)) metEen.push(pad);
  }
  assert.ok(Object.keys(metNul).length > 0, 'voorwaarde: de scan vindt de vergelijkingen (anders meet hij niets)');
  assert.deepEqual(genoemd, metNul,
    'de lijst in sessiegrens.js wijkt af van de bron: lees accounts.isActief, of noem het bestand (met aantal) in die kop');
  for (const pad of metEen) {
    assert.ok(blok.includes(pad), pad + ' vergelijkt `actief` met 1 en staat niet in de kop van sessiegrens.js');
  }
});

/* ---------------------------------------------------------------------------
   DEEL C -- inlog2 tegen een echte server, met SCIM tussen stap een en twee.

   Een herstelcode in plaats van TOTP: hij is eenmalig, dus de tegenproef laat
   ook zien dat de weigering VOOR de code valt. Een SCIM-PATCH zet
   de sessiegrens niet (zie de kop van server/accounts/sessiegrens.js), dus het
   bewijs uit stap een wordt alleen door "uitgezet" tegengehouden.
   ------------------------------------------------------------------------- */
test('C. e2e: SCIM zet het account uit tussen stap een en twee, /api/auth/tweede geeft 401; weer aan en hetzelfde bewijs werkt', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-actieuit-e2e-'));
  const srv = await startServer({ env: { RTG_DATA_DIR: dir, SMTP_URL: '', RTG_OWNER_EMAIL: '' } });
  async function vraag(pad, body, token, methode) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    const r = await fetch(srv.base + pad, { method: methode || 'POST', headers,
      body: methode === 'GET' ? undefined : JSON.stringify(body || {}) });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  }
  try {
    // de eigenaar koppelt een organisatie met een domein en haalt een SCIM-sleutel
    const eig = await vraag('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' });
    assert.ok(eig.body.token, 'de eigenaar logt in: ' + JSON.stringify(eig.body).slice(0, 160));
    const zw = await zwaarApi((p, b, t) => vraag(p, b, t), srv.base, eig.body.token);
    const sso = await zw('/api/techniek/sso', { org: 'n20org', naam: 'Uitdienst BV', issuer: 'https://login.n20-idp.test',
      clientId: 'rtg-n20', clientSecret: 'n20-geheim', domeinen: ['n20-org.test'], actief: true }, eig.body.token);
    assert.equal(sso.status, 200, 'SSO-koppeling: ' + JSON.stringify(sso.body).slice(0, 200));
    const sl = await vraag('/api/techniek/sso/scimsleutel', { org: 'n20org' }, eig.body.token);
    assert.equal(sl.status, 200, 'SCIM-sleutel: ' + JSON.stringify(sl.body).slice(0, 200));
    const scimKop = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (sl.body.sleutel || sl.body.token) };

    // een medewerker van die organisatie, met de tweede factor aan
    const email = 'n20-medewerker@n20-org.test', ww = 'geheim12';
    const reg = await vraag('/api/auth/register', { name: 'Uit Dienst', email, password: ww, geboortedatum: '1990-01-01' });
    assert.ok(reg.body.token, 'registratie: ' + JSON.stringify(reg.body).slice(0, 160));
    const begin = await vraag('/api/mijn/tweefactor/begin', { huidig: ww }, reg.body.token);
    const aan = await vraag('/api/mijn/tweefactor/bevestig', { code: totpCode(begin.body.geheim, Date.now(), 30) }, reg.body.token);
    const hc = aan.body.herstelcodes;
    assert.ok(Array.isArray(hc) && hc.length >= 1, 'herstelcodes: ' + JSON.stringify(aan.body).slice(0, 160));

    const zoek = await fetch(srv.base + '/api/scim/v2/Users?filter=' + encodeURIComponent('userName eq "' + email + '"'), { headers: scimKop });
    const lijst = await zoek.json();
    const id = lijst.Resources && lijst.Resources[0] && lijst.Resources[0].id;
    assert.ok(id, 'de organisatie vindt haar medewerker: ' + JSON.stringify(lijst).slice(0, 200));
    async function scimActief(waarde) {
      const r = await fetch(srv.base + '/api/scim/v2/Users/' + encodeURIComponent(id), { method: 'PATCH', headers: scimKop,
        body: JSON.stringify({ schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
          Operations: [{ op: 'replace', path: 'active', value: waarde }] }) });
      assert.equal(r.status, 200, 'SCIM active=' + waarde);
      assert.equal((await r.json()).active, waarde);
    }

    // stap een: het wachtwoord klopt, er komt een bewijs en geen token
    const stap1 = await vraag('/api/auth/login', { login: email, password: ww, pasApp: 'rtg' });
    assert.ok(stap1.body.bewijs && !stap1.body.token, 'stap een geeft een bewijs: ' + JSON.stringify(stap1.body).slice(0, 160));

    // de organisatie meldt de medewerker uit dienst, en dan stap twee met een juiste code
    await scimActief(false);
    const stap2 = await vraag('/api/auth/tweede', { bewijs: stap1.body.bewijs, code: hc[0] });
    assert.equal(stap2.status, 401, 'een bewijs van een uitgezet account opent niets (kreeg ' +
      stap2.status + ', token: ' + !!stap2.body.token + ')');
    assert.equal(stap2.body.token, undefined);

    /* TEGENPROEF: weer aan, en HETZELFDE bewijs met DEZELFDE herstelcode geeft
       een werkende sessie. Zo staat vast dat het de vlag was die het tegenhield,
       en niet een SCIM-PATCH die het bewijs zelf ongeldig maakte. En de
       weigering viel voor de code: een herstelcode is eenmalig, en een uitgezet
       account hoort er geen te verbruiken. */
    await scimActief(true);
    const weer = await vraag('/api/auth/tweede', { bewijs: stap1.body.bewijs, code: hc[0] });
    assert.equal(weer.status, 200, 'weer aan: ' + JSON.stringify(weer.body).slice(0, 160));
    assert.equal((await vraag('/api/auth/me', {}, weer.body.token)).status, 200);
  } finally {
    await stop(srv);
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
  }
});
