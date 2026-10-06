/* ============================================================================
   DE POGINGENREM OP DE TWEEDE INLOGSTAP -- regressie voor RTG-V1-RELEASE C3.

   DE FOUT: /api/auth/tweede controleerde de TOTP-code zonder enige rem. Een
   verkeerde code trekt het bewijs met opzet NIET in (een typefout mag geen
   nieuwe inlog kosten), dus wie het wachtwoord had kon vijf minuten lang codes
   raden zo snel als het netwerk toeliet.

   DE FIX: dezelfde emmers als de wachtwoordinlog -- een per account (10) en een
   per bron (50) -- via tooManyTries/noteFailedTry.

   Deze toets zakt zonder de rem: poging 11 geeft dan 403 in plaats van 429, en
   de juiste code komt daarna gewoon door.

   Draai los: node --test test/tweede-rem.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { startServer, stop, postJson } = require('./helper');
const { totpCode } = require('../server/kern/totp');

async function status(base, pad, body) {
  const r = await fetch(base + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return r.status;
}

test('na tien foute codes zit de tweede stap op slot, ook voor de juiste code', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-tweede-rem-'));
  const srv = await startServer({ env: { RTG_DATA_DIR: dir } });
  const base = srv.base;
  const post = postJson(base);
  try {
    const email = 'tweede-rem@voorbeeld.test', wachtwoord = 'geheim12';
    const reg = await post('/api/auth/register', { name: 'Rem Toets', email, password: wachtwoord, geboortedatum: '1990-01-01' });
    assert.ok(reg.token, 'registratie hoort een token te geven: ' + JSON.stringify(reg).slice(0, 160));
    const begin = await post('/api/mijn/tweefactor/begin', { huidig: wachtwoord }, reg.token);
    assert.ok(begin.geheim, 'begin() hoort een geheim te geven');
    const bevestig = await post('/api/mijn/tweefactor/bevestig', { code: totpCode(begin.geheim, Date.now(), 30) }, reg.token);
    assert.ok(bevestig.ok, 'tweede factor aanzetten moet slagen: ' + JSON.stringify(bevestig).slice(0, 160));

    const login = await post('/api/auth/login', { login: email, password: wachtwoord, pasApp: 'rtg' });
    assert.ok(login.bewijs, 'met 2FA aan hoort login een bewijs te geven');

    // een code die zeker niet klopt: zes cijfers, maar geen van de drie geldige vensters
    const geldig = new Set([-30000, 0, 30000].map(d => totpCode(begin.geheim, Date.now() + d, 30)));
    let fout = '000000';
    for (let i = 0; geldig.has(fout); i++) fout = String(100000 + i);

    for (let i = 1; i <= 10; i++) {
      assert.equal(await status(base, '/api/auth/tweede', { bewijs: login.bewijs, code: fout }), 403,
        'poging ' + i + ' hoort een gewone afwijzing te zijn');
    }
    assert.equal(await status(base, '/api/auth/tweede', { bewijs: login.bewijs, code: fout }), 429,
      'na tien foute codes hoort de tweede stap op slot te zitten');
    const juist = totpCode(begin.geheim, Date.now() + 30000, 30);
    assert.equal(await status(base, '/api/auth/tweede', { bewijs: login.bewijs, code: juist }), 429,
      'op slot is op slot: ook de juiste code komt er nu niet door (anders is raden gratis)');
  } finally {
    await stop(srv);
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
  }
});

test('een enkele typefout houdt de juiste code niet tegen', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-tweede-rem2-'));
  const srv = await startServer({ env: { RTG_DATA_DIR: dir } });
  const base = srv.base;
  const post = postJson(base);
  try {
    const email = 'tweede-typo@voorbeeld.test', wachtwoord = 'geheim12';
    const reg = await post('/api/auth/register', { name: 'Typo Toets', email, password: wachtwoord, geboortedatum: '1990-01-01' });
    const begin = await post('/api/mijn/tweefactor/begin', { huidig: wachtwoord }, reg.token);
    await post('/api/mijn/tweefactor/bevestig', { code: totpCode(begin.geheim, Date.now(), 30) }, reg.token);
    const login = await post('/api/auth/login', { login: email, password: wachtwoord, pasApp: 'rtg' });
    const geldig = new Set([-30000, 0, 30000].map(d => totpCode(begin.geheim, Date.now() + d, 30)));
    let fout = '000000';
    for (let i = 0; geldig.has(fout); i++) fout = String(100000 + i);
    assert.equal(await status(base, '/api/auth/tweede', { bewijs: login.bewijs, code: fout }), 403);
    const tweede = await post('/api/auth/tweede', { bewijs: login.bewijs, code: totpCode(begin.geheim, Date.now() + 30000, 30) });
    assert.ok(tweede.token, 'na een typefout hoort de juiste code nog gewoon een sessie te geven: ' + JSON.stringify(tweede).slice(0, 160));
  } finally {
    await stop(srv);
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
  }
});

test('3. de rem zit op het ACCOUNT: wisselende adressen en een vers bewijs geven geen nieuwe gokken', async () => {
  /* Twee keuzes die de herkeuring met een mutatie liet omvallen zonder dat deze
     toets zakte: een emmer per bewijs, en alleen een emmer per adres. Een
     aanvaller met het wachtwoord heeft allebei in de hand. */
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-tweede-rem3-'));
  const srv = await startServer({ env: { RTG_DATA_DIR: dir } });
  const base = srv.base;
  const post = postJson(base);
  const vanAdres = async (ip, pad, body) => {
    const r = await fetch(base + pad, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
      body: JSON.stringify(body) });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  };
  try {
    const email = 'tweede-rem3@voorbeeld.test', wachtwoord = 'geheim12';
    const reg = await post('/api/auth/register', { name: 'Rem Drie', email, password: wachtwoord, geboortedatum: '1990-01-01' });
    const begin = await post('/api/mijn/tweefactor/begin', { huidig: wachtwoord }, reg.token);
    await post('/api/mijn/tweefactor/bevestig', { code: totpCode(begin.geheim, Date.now(), 30) }, reg.token);
    const geldig = new Set([-30000, 0, 30000].map(d => totpCode(begin.geheim, Date.now() + d, 30)));
    let fout = '000000';
    for (let i = 0; geldig.has(fout); i++) fout = String(100000 + i);

    let bewijs = (await post('/api/auth/login', { login: email, password: wachtwoord, pasApp: 'rtg' })).bewijs;
    for (let i = 1; i <= 10; i++) {
      if (i === 6) bewijs = (await post('/api/auth/login', { login: email, password: wachtwoord, pasApp: 'rtg' })).bewijs;
      const r = await vanAdres('198.51.100.' + i, '/api/auth/tweede', { bewijs, code: fout });
      assert.equal(r.status, 403, 'poging ' + i + ' vanaf een eigen adres is een gewone afwijzing');
    }
    const juist = totpCode(begin.geheim, Date.now() + 30000, 30);
    const daarna = await vanAdres('198.51.100.77', '/api/auth/tweede', { bewijs, code: juist });
    assert.equal(daarna.status, 429,
      'tien gokken over tien adressen en twee bewijzen sluiten het ACCOUNT, ook voor een nieuw adres (kreeg ' + daarna.status + ')');
  } finally {
    await stop(srv);
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
  }
});

test('4. uitzetten deelt de rem: tien foute codes op /uit, en ook de juiste zet de factor niet meer uit', async () => {
  /* De tweede herkeuring vond dezelfde toets() op /api/mijn/tweefactor/uit,
     zonder rem: met een sessie en het wachtwoord was de code daar onbeperkt te
     raden. */
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-tweede-rem4-'));
  const srv = await startServer({ env: { RTG_DATA_DIR: dir } });
  const base = srv.base;
  const post = postJson(base);
  /* Elke poging van een eigen adres: een emmer per adres zou hier niet vullen
     (de herkeuring van ronde 3 liet die mutant overleven op een vast adres). */
  let n = 0;
  const uit = async (token, code) => (await fetch(base + '/api/mijn/tweefactor/uit', { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, 'X-Forwarded-For': '198.51.100.' + (++n) },
    body: JSON.stringify({ huidig: 'geheim12', code }) })).status;
  try {
    const reg = await post('/api/auth/register', { name: 'Rem Vier', email: 'tweede-rem4@voorbeeld.test', password: 'geheim12', geboortedatum: '1990-01-01' });
    const begin = await post('/api/mijn/tweefactor/begin', { huidig: 'geheim12' }, reg.token);
    await post('/api/mijn/tweefactor/bevestig', { code: totpCode(begin.geheim, Date.now(), 30) }, reg.token);
    const geldig = new Set([-30000, 0, 30000].map(d => totpCode(begin.geheim, Date.now() + d, 30)));
    let fout = '000000';
    for (let i = 0; geldig.has(fout); i++) fout = String(100000 + i);
    for (let i = 1; i <= 10; i++) assert.equal(await uit(reg.token, fout), 403, 'poging ' + i + ' is een gewone afwijzing');
    assert.equal(await uit(reg.token, totpCode(begin.geheim, Date.now() + 30000, 30)), 429,
      'na tien foute codes zit uitzetten op slot, ook voor de juiste code');
    const stand = await post('/api/mijn/tweefactor', {}, reg.token);
    assert.equal(stand.aan, true, 'de tweede factor staat nog aan');
    /* En het is DEZELFDE emmer als de tweede inlogstap: wie hier gokte, krijgt
       daar geen tien nieuwe. */
    const login = await post('/api/auth/login', { login: 'tweede-rem4@voorbeeld.test', password: 'geheim12', pasApp: 'rtg' });
    const tweede = await fetch(base + '/api/auth/tweede', { method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '203.0.113.9' },
      body: JSON.stringify({ bewijs: login.bewijs, code: totpCode(begin.geheim, Date.now() + 30000, 30) }) });
    assert.equal(tweede.status, 429, 'de gokken op /uit tellen ook voor de inlog');
  } finally {
    await stop(srv);
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
  }
});

/* ----------------------------------------------------------------------------
   N4 (besluit van de eigenaar, 5 oktober 2026): EEN SLOT, GEEN QUARANTAINE. Wie
   hier aanklopt kent het wachtwoord al. Meldde een vol slot zich als brute force,
   dan ging het adres van de laatste poging een uur in quarantaine -- en dat kon
   het adres van het lid zelf zijn. Zie server/kern/identiteit/tweedestap-rem.js.
   -------------------------------------------------------------------------- */
async function lidMetFactor(base, post, email) {
  const reg = await post('/api/auth/register', { name: 'Rem N4', email, password: 'geheim12', geboortedatum: '1990-01-01' });
  const begin = await post('/api/mijn/tweefactor/begin', { huidig: 'geheim12' }, reg.token);
  await post('/api/mijn/tweefactor/bevestig', { code: totpCode(begin.geheim, Date.now(), 30) }, reg.token);
  const geldig = new Set([-30000, 0, 30000].map(d => totpCode(begin.geheim, Date.now() + d, 30)));
  let fout = '000000';
  for (let i = 0; geldig.has(fout); i++) fout = String(100000 + i);
  return { geheim: begin.geheim, fout };
}
async function vanaf(base, ip, pad, body) {
  const r = await fetch(base + pad, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
    body: JSON.stringify(body) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

test('5. een vol slot op de tweede stap zet het adres NIET in quarantaine (N4)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-tweede-rem5-'));
  const srv = await startServer({ env: { RTG_DATA_DIR: dir } });
  const base = srv.base, post = postJson(base), ip = '203.0.113.50', email = 'tweede-rem5@voorbeeld.test';
  try {
    const { fout } = await lidMetFactor(base, post, email);
    const bewijs = (await vanaf(base, ip, '/api/auth/login', { login: email, password: 'geheim12', pasApp: 'rtg' })).body.bewijs;
    for (let i = 1; i <= 10; i++) assert.equal((await vanaf(base, ip, '/api/auth/tweede', { bewijs, code: fout })).status, 403);
    assert.equal((await vanaf(base, ip, '/api/auth/tweede', { bewijs, code: fout })).status, 429, 'het slot zit erop');
    const daarna = await vanaf(base, ip, '/api/auth/login', { login: email, password: 'fout-wachtwoord', pasApp: 'rtg' });
    assert.notEqual(daarna.body.error, 'Toegang geblokkeerd (quarantaine).', 'het adres staat niet in quarantaine');
    assert.equal(daarna.status, 401, 'het adres krijgt gewoon een antwoord op zijn inlog (kreeg ' + daarna.status + ')');
  } finally {
    await stop(srv);
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
  }
});

test('6. een geslaagde code leegt de emmer (N4)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-tweede-rem6-'));
  const srv = await startServer({ env: { RTG_DATA_DIR: dir } });
  const base = srv.base, post = postJson(base), email = 'tweede-rem6@voorbeeld.test';
  try {
    const { geheim, fout } = await lidMetFactor(base, post, email);
    let bewijs = (await post('/api/auth/login', { login: email, password: 'geheim12', pasApp: 'rtg' })).bewijs;
    for (let i = 1; i <= 9; i++) assert.equal(await status(base, '/api/auth/tweede', { bewijs, code: fout }), 403);
    const binnen = await post('/api/auth/tweede', { bewijs, code: totpCode(geheim, Date.now() + 30000, 30) });
    assert.ok(binnen.token, 'de juiste code na negen typefouten geeft een sessie');
    bewijs = (await post('/api/auth/login', { login: email, password: 'geheim12', pasApp: 'rtg' })).bewijs;
    for (let i = 1; i <= 9; i++) {
      assert.equal(await status(base, '/api/auth/tweede', { bewijs, code: fout }), 403,
        'na een geslaagde code telt de emmer opnieuw vanaf nul (poging ' + i + ')');
    }
  } finally {
    await stop(srv);
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
  }
});

test('7. een geslaagde code leegt de emmer van het ACCOUNT en niet die van het adres (herkeuring N4)', () => {
  /* Leegde een geslaagde code ook de bronemmer, dan zette een aanvaller met een
     eigen account met tweede factor de limiet van 50 per adres terug wanneer hij
     wilde: zes slachtoffers keer negen gokken vanaf een adres gaven nul keer 429.
     Een eenheidstoets, want de echte limiet (50) vraagt vijftig accounts. */
  const { maakTweedeStapRem } = require('../server/kern/identiteit/tweedestap-rem');
  const loginFails = new Map();
  const noteFailedTry = (emmer) => loginFails.set(emmer, (loginFails.get(emmer) || 0) + 1);
  const rem = maakTweedeStapRem({ tooManyTries: () => false, noteFailedTry, loginFails });
  for (let i = 0; i < 9; i++) rem.mis('slachtoffer', '203.0.113.7');
  rem.mis('aanvaller', '203.0.113.7');
  rem.gelukt('aanvaller', '203.0.113.7');
  assert.equal(loginFails.get('tweede:bron:203.0.113.7'), 10, 'de gokken vanaf dit adres blijven staan');
  assert.equal(loginFails.has('tweede:doel:aanvaller'), false, 'het account van de geslaagde code begint opnieuw');
  assert.equal(loginFails.get('tweede:doel:slachtoffer'), 9, 'en de andere accounts ook niet');
});

test('8. nieuwe herstelcodes delen de rem: tien foute codes op /codes, en ook de juiste geeft dan geen codes (N2)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-tweede-rem8-'));
  const srv = await startServer({ env: { RTG_DATA_DIR: dir } });
  const base = srv.base, post = postJson(base), email = 'tweede-rem8@voorbeeld.test';
  let n = 0;
  const codes = async (token, code) => {
    const r = await fetch(base + '/api/mijn/tweefactor/codes', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, 'X-Forwarded-For': '198.51.100.' + (++n) },
      body: JSON.stringify({ huidig: 'geheim12', code }) });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  };
  try {
    const { geheim, fout } = await lidMetFactor(base, post, email);
    const login = await post('/api/auth/login', { login: email, password: 'geheim12', pasApp: 'rtg' });
    const sessie = await post('/api/auth/tweede', { bewijs: login.bewijs, code: totpCode(geheim, Date.now() - 30000, 30) });
    assert.ok(sessie.token, 'het lid logt in met de tweede factor');
    for (let i = 1; i <= 10; i++) assert.equal((await codes(sessie.token, fout)).status, 403, 'poging ' + i);
    const juist = await codes(sessie.token, totpCode(geheim, Date.now() + 30000, 30));
    assert.equal(juist.status, 429, 'na tien foute codes zit /codes op slot, ook voor de juiste code (kreeg ' + juist.status + ')');
    assert.equal(juist.body.codes, undefined, 'en er komen geen nieuwe herstelcodes uit');
  } finally {
    await stop(srv);
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
  }
});
