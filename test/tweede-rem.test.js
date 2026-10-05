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
