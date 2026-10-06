/* ============================================================================
   EEN ACTIETOKEN VERVALT BIJ DE SESSIEGRENS -- regressie voor N12 uit de
   V1-audit (RTG-V1-RELEASE-READINESS-AUDIT.md).

   DE FOUT: verifyActionToken keek niet naar `sessies_vanaf`. Een sessietoken
   valt af zodra die grens na zijn uitgifte ligt; een actietoken droeg niet eens
   een uitgiftemoment. De herkeuring reproduceerde het: een inlog2- of
   tech2-bewijs van VOOR een wachtwoordwijziging gaf erna, met een geldige code
   of herstelcode, 200 en een werkend token. Wie het oude wachtwoord kende, kwam
   dus binnen op een bewijs van vlak voor de wijziging.

   DE FIX (besluit van de eigenaar, keuze a): ELK actietoken vervalt bij
   `sessies_vanaf`, net als een sessie. Het uitgiftemoment staat als vijfde deel
   in het lichaam, en de vergelijking is die van een sessietoken
   (server/accounts/sessiegrens.js). Een token zonder uitgiftemoment (van voor de
   uitrol) is DICHT voor de inlogbewijzen en geldt als MOMENT 0 voor de
   mailboxlinks; de reden staat in server/accounts/actietokens.js.

   Deel A is per doel en per manier om de grens te zetten; deel B is het
   scenario uit de herkeuring tegen een echte server. Beide zakken zonder de fix.

   Draai los: node --test test/actietoken-sessiegrens.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

/* Verse, geisoleerde datamap VOOR de modules laden (zoals accounts.test.js). */
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-actiegrens-'));
process.env.RTG_DATA_DIR = TMP;
process.env.NODE_ENV = 'test';
process.env.RTG_MAGNAAT_TEST = '1';

const accounts = require('../server/accounts');
const kluis = require('../server/accounts/kluis');
accounts.init();

const { startServer, stop } = require('./helper');
const { totpCode } = require('../server/kern/totp');

test.after(() => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

const DOELEN = { 'inlog2': 5 * 60 * 1000, 'tech2': 5 * 60 * 1000, 'sso-overdracht': 60000,
  'mailwissel': 24 * 3600 * 1000, 'verify-email': 3 * 86400000 };
const even = () => new Promise(r => setTimeout(r, 5)); // de grens ligt dan zeker NA de uitgifte

/* Drie functies die de grens zetten, en alle drie horen hetzelfde te doen.
   zetSessiegrens is de weg van het eigenaarsherstel en van pas naar gast; de
   knop "sluit alle andere sessies" van het lid zet de grens NIET (deel C). */
const ZETTERS = {
  wachtwoord: (u) => accounts.setPassword(u.id, 'nieuwGeheim' + u.id),
  zetSessiegrens: (u) => accounts.zetSessiegrens(u.id),
  herstel: (u) => accounts.consumeReset(accounts.createReset(u.id), 'hersteld' + u.id)
};

let volgnummer = 0;
async function versLid() {
  const n = ++volgnummer;
  return accounts.createUser({
    email: 'actiegrens' + n + '@voorbeeld.test', password: 'geheim12',
    tier: 'rtg', realName: 'Grens ' + n, phone: '+3162222' + String(n).padStart(4, '0') });
}

/* Een token in de OUDE vorm (`id.doel.exp.nonce`, zonder uitgiftemoment),
   getekend met de echte per-doel sleutel: precies wat er voor de uitrol werd
   uitgegeven. Met `vijfde` komt er een zelfgekozen vijfde deel achter. */
function oudeVorm(userId, doel, vijfde) {
  let body = userId + '.' + doel + '.' + (Date.now() + DOELEN[doel]) + '.' +
    crypto.randomBytes(16).toString('base64url');
  if (vijfde !== undefined) body += '.' + vijfde;
  return Buffer.from(body).toString('base64url') + '.' +
    kluis.signMet(kluis.sleutelVoor('actie:' + doel), body);
}

/* ---------------------------------------------------------------------------
   DEEL A -- per doel, per weg naar de grens (unit, zonder server).
   ------------------------------------------------------------------------- */
for (const [doel, ttl] of Object.entries(DOELEN)) {
  for (const [weg, zet] of Object.entries(ZETTERS)) {
    test('A. ' + doel + ': een token van voor "' + weg + '" vervalt, een token van erna blijft geldig', async () => {
      const u = await versLid();
      const oud = accounts.issueActionToken(u.id, doel, ttl);
      assert.equal(accounts.verifyActionToken(oud, doel).id, u.id, 'voor de grens werkt het token gewoon');
      await even();
      const na = await zet(u);
      assert.ok(na && Number(na.sessies_vanaf) > 0, weg + ' hoort de grens te zetten');
      assert.equal(accounts.verifyActionToken(oud, doel), null,
        'een ' + doel + '-token van voor de grens telt niet meer, net als een sessie');
      const nieuw = accounts.issueActionToken(u.id, doel, ttl);
      const uit = accounts.verifyActionToken(nieuw, doel);
      assert.ok(uit && uit.id === u.id,
        'een token van NA de grens blijft geldig; een grens die alles doodt is net zo fout als geen grens');
    });
  }
}

test('A. het uitgiftemoment staat als vijfde deel in het lichaam, de eerste vier blijven wat ze waren', async () => {
  const u = await versLid();
  const voor = Date.now();
  const t = accounts.issueActionToken(u.id, 'inlog2', 60000);
  const delen = Buffer.from(t.split('.')[0], 'base64url').toString().split('.');
  assert.equal(delen.length, 5);
  assert.equal(delen[0], String(u.id));
  assert.equal(delen[1], 'inlog2');
  assert.ok(Number(delen[2]) >= voor + 60000, 'deel drie is nog steeds de vervaltijd');
  assert.ok(Number(delen[4]) >= voor && Number(delen[4]) <= Date.now(), 'deel vijf is het uitgiftemoment');
});

test('A. oude vorm, inlogbewijzen: zonder uitgiftemoment dicht, ook als er nooit een grens is gezet', async () => {
  const u = await versLid();
  assert.equal(Number(u.sessies_vanaf || 0), 0, 'voorwaarde: een vers account heeft geen grens');
  for (const doel of ['inlog2', 'tech2', 'sso-overdracht']) {
    assert.equal(accounts.verifyActionToken(oudeVorm(u.id, doel), doel), null,
      doel + ' zonder uitgiftemoment bewijst niet of het van voor of na de grens is');
  }
});

test('A. oude vorm, mailboxlinks: moment 0, dus geldig tot er ooit een grens is gezet', async () => {
  for (const doel of ['verify-email', 'mailwissel']) {
    const u = await versLid();
    const oud = oudeVorm(u.id, doel);
    const voor = accounts.verifyActionToken(oud, doel);
    assert.ok(voor && voor.id === u.id, doel + ' van voor de uitrol werkt zolang er geen grens is');
    await even();
    accounts.zetSessiegrens(u.id);
    assert.equal(accounts.verifyActionToken(oud, doel), null,
      doel + ' zonder uitgiftemoment valt af zodra er een grens is, zoals een sessietoken');
  }
});

test('A. een uitgiftemoment dat geen getal is, telt als moment 0 en niet als "geen grens"', async () => {
  /* Zonder de terugval in sessiegrens.js maakt NaN de vergelijking false en laat
     de grens het token door. Getekend met de echte sleutel, dus alleen de grens
     staat ertussen. */
  const u = await versLid();
  const raar = oudeVorm(u.id, 'verify-email', 'abc');
  await even();
  accounts.zetSessiegrens(u.id);
  assert.equal(accounts.verifyActionToken(raar, 'verify-email'), null);
});

test('A. voorGrens zonder account zegt "niet voor de grens" en gooit niet', () => {
  /* Beide aanroepers (verifyToken, verifyActionToken) staan in een try/catch
     die null geeft en geven bij een ontbrekend account toch al null terug, dus
     daar maakt de afvanging in gedrag niets uit (daarom overleefde de mutant die
     hem weghaalde). Hij hoort bij de helper zelf: of het account bestaat, beslist
     de aanroeper, en een aanroeper zonder vangnet kreeg anders een TypeError
     waar een antwoord hoort. */
  const { voorGrens } = require('../server/accounts/sessiegrens');
  assert.equal(voorGrens(null, Date.now()), false);
  assert.equal(voorGrens(undefined, undefined), false);
  assert.equal(voorGrens({ sessies_vanaf: 10 }, 5), true, 'tegenproef: met account werkt de grens');
});

/* ---------------------------------------------------------------------------
   DEEL B -- het scenario uit de herkeuring, tegen een echte server.

   Een bewijs van stap een halen, het wachtwoord wijzigen, en dan het OUDE bewijs
   met een geldige herstelcode aanbieden: 401. Een nieuw bewijs met het nieuwe
   wachtwoord werkt gewoon. Herstelcodes in plaats van TOTP, omdat een
   TOTP-venster maar een keer te gebruiken is; de weigering valt voor de code
   wordt getoetst, dus de herstelcode blijft heel voor de tegenproef.
   ------------------------------------------------------------------------- */
test('B. e2e: inlog2- en tech2-bewijs van voor een wachtwoordwijziging geven 401, een nieuw bewijs werkt', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-actiegrens-e2e-'));
  const srv = await startServer({ env: { RTG_DATA_DIR: dir, SMTP_URL: '', RTG_OWNER_EMAIL: '' } });
  async function api(pad, body, token, methode) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    const r = await fetch(srv.base + pad, { method: methode || 'POST', headers,
      body: methode === 'GET' ? undefined : JSON.stringify(body || {}) });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  }
  const LOGIN = 'roellie.i@gmail.com', OUD = 'Imran', NIEUW = 'AnderGeheim77!';
  try {
    // de eigenaar zet zijn tweede factor aan; de herstelcodes zijn de tweede stap
    const eerst = await api('/api/auth/login', { login: LOGIN, password: OUD, pasApp: 'business' });
    assert.ok(eerst.body.token, 'de eigenaar logt in: ' + JSON.stringify(eerst.body).slice(0, 160));
    const begin = await api('/api/mijn/tweefactor/begin', { huidig: OUD }, eerst.body.token);
    const aan = await api('/api/mijn/tweefactor/bevestig',
      { code: totpCode(begin.body.geheim, Date.now(), 30) }, eerst.body.token);
    const hc = aan.body.herstelcodes;
    assert.ok(Array.isArray(hc) && hc.length >= 3, 'herstelcodes: ' + JSON.stringify(aan.body).slice(0, 160));

    // een sessie om het wachtwoord mee te wijzigen
    const l0 = await api('/api/auth/login', { login: LOGIN, password: OUD, pasApp: 'business' });
    const ses = await api('/api/auth/tweede', { bewijs: l0.body.bewijs, code: hc[0] });
    assert.ok(ses.body.token, 'sessie: ' + JSON.stringify(ses.body).slice(0, 160));

    // de bewijzen van VOOR de wijziging
    const oudTech = await api('/api/techniek/inloggen', { login: LOGIN, wachtwoord: OUD });
    const oudLid = await api('/api/auth/login', { login: LOGIN, password: OUD, pasApp: 'business' });
    assert.ok(oudTech.body.bewijs && oudLid.body.bewijs, 'beide deuren geven een bewijs voor stap twee');

    const pw = await api('/api/auth/password', { huidig: OUD, nieuw: NIEUW }, ses.body.token);
    assert.equal(pw.status, 200, 'wachtwoord wijzigen: ' + JSON.stringify(pw.body).slice(0, 160));
    assert.equal((await api('/api/auth/me', {}, ses.body.token)).status, 401, 'de oude sessie is weg');

    const tech = await api('/api/techniek/inloggen', { bewijs: oudTech.body.bewijs, code: hc[1] });
    assert.equal(tech.status, 401, 'een tech2-bewijs van voor de wijziging opent niets meer (kreeg ' +
      tech.status + ', token: ' + !!tech.body.token + ')');
    assert.equal(tech.body.token, undefined);
    const lid = await api('/api/auth/tweede', { bewijs: oudLid.body.bewijs, code: hc[2] });
    assert.equal(lid.status, 401, 'een inlog2-bewijs van voor de wijziging opent niets meer (kreeg ' +
      lid.status + ', token: ' + !!lid.body.token + ')');
    assert.equal(lid.body.token, undefined);

    // TEGENPROEF: met het nieuwe wachtwoord werken beide deuren gewoon, met dezelfde codes
    const nieuwTech = await api('/api/techniek/inloggen', { login: LOGIN, wachtwoord: NIEUW });
    const tech2 = await api('/api/techniek/inloggen', { bewijs: nieuwTech.body.bewijs, code: hc[1] });
    assert.equal(tech2.status, 200, 'nieuw tech2-bewijs: ' + JSON.stringify(tech2.body).slice(0, 160));
    assert.equal((await api('/api/techniek/status', null, tech2.body.token, 'GET')).status, 200);
    const nieuwLid = await api('/api/auth/login', { login: LOGIN, password: NIEUW, pasApp: 'business' });
    const lid2 = await api('/api/auth/tweede', { bewijs: nieuwLid.body.bewijs, code: hc[2] });
    assert.equal(lid2.status, 200, 'nieuw inlog2-bewijs: ' + JSON.stringify(lid2.body).slice(0, 160));
    assert.equal((await api('/api/auth/me', {}, lid2.body.token)).status, 200);
  } finally {
    stop(srv);
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
  }
});

/* ---------------------------------------------------------------------------
   DEEL C -- de lijst zetters in de kop van server/accounts/sessiegrens.js,
   tegen de bron gehouden.

   De herkeuring vond dat die kop te veel beweerde: hij noemde "alle sessies
   sluiten" als zetter, terwijl die knop van het lid per sessie-id intrekt en de
   grens laat staan, en hij liet pas naar gast weg. Een lijst die niemand naast
   de code legt, loopt er weer van weg. Daarom wordt de lijst hier AFGELEID: wie
   `sessies_vanaf` in SQL op een waarde zet, en wie accounts.zetSessiegrens
   aanroept, gelezen ZONDER commentaar (anders telt een uitleg als aanroep). Het
   blok "WIE DE GRENS ZET" moet precies die bestanden noemen, niet meer en niet
   minder: een nieuwe zetter zonder regel zakt, een regel zonder zetter ook.
   ------------------------------------------------------------------------- */
test('C. de kop van sessiegrens.js noemt precies de bestanden die de grens zetten', () => {
  const { zonderCommentaar } = require('../scripts/lib/bron');
  const SERVER = path.join(__dirname, '..', 'server');
  const zetters = new Set();
  (function loop(map) {
    for (const d of fs.readdirSync(map, { withFileTypes: true })) {
      const p = path.join(map, d.name);
      if (d.isDirectory()) { if (d.name !== 'data' && d.name !== 'node_modules') loop(p); continue; }
      if (!d.name.endsWith('.js')) continue;
      const ruw = fs.readFileSync(p, 'utf8');
      if (!ruw.includes('sessies_vanaf') && !ruw.includes('zetSessiegrens')) continue;
      const code = zonderCommentaar(ruw);
      if (/sessies_vanaf\s*=\s*[?$]/.test(code) || /\.sessies_vanaf\s*=(?!=)/.test(code) ||
          /\.zetSessiegrens\s*\(/.test(code)) {
        zetters.add(path.relative(SERVER, p).split(path.sep).join('/'));
      }
    }
  })(SERVER);
  assert.ok(zetters.size >= 2, 'de afleiding vindt de zetters (anders bewijst gelijkheid niets): ' + [...zetters]);

  const kop = fs.readFileSync(path.join(SERVER, 'accounts', 'sessiegrens.js'), 'utf8');
  const blok = (kop.match(/WIE DE GRENS ZET\b([\s\S]*?)\n[ \t]*\n/) || [])[1];
  assert.ok(blok, 'de kop van sessiegrens.js heeft een blok "WIE DE GRENS ZET"');
  const genoemd = new Set(blok.match(/[a-z][\w-]*(?:\/[\w-]+)*\/[\w-]+\.js/g) || []);
  assert.deepEqual([...genoemd].sort(), [...zetters].sort(),
    'het blok WIE DE GRENS ZET noemt andere bestanden dan de bron: pas de kop aan, niet de toets');
});
