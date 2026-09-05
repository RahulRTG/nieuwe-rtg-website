/* Productiegrens voor de oude viercijferige personeelspin.

   Deze toets draait de server in de gewone, niet-synthetische stand. Zo wordt
   bewezen dat een vergeten oude personeelsrij of UI-aanroep niet alsnog als
   bearer werkt. Daarnaast bewaakt de statische toets de kleine maar kritieke
   injectienaad: server.js moet `accounts` aan de centrale supplierpoort geven,
   en die poort moet het levende dienstverband/account vóór iedere route lezen.

   Draai: node --experimental-sqlite --test test/staff-pin-productie.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { startServer, stop } = require('./helper');

const WORTEL = path.join(__dirname, '..');

async function post(base, pad, body) {
  return fetch(base + pad, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}) });
}

test('een echte server accepteert of ontsluit geen viercijferige personeelspin', async () => {
  const srv = await startServer({ env: { RTG_MAGNAAT_TEST: '0', RTG_DEMO: '0', SMTP_URL: '' } });
  try {
    const gezondheid = await (await fetch(srv.base + '/api/health')).json();
    assert.equal(gezondheid.testomgeving, false, 'de proef mag niet ongemerkt in Magnaat Test draaien');

    const login = await post(srv.base, '/api/supplier/login', {
      code: 'WILLEKEURIG', staffId: 1, pin: '1234'
    });
    assert.equal(login.status, 403);
    assert.match((await login.json()).error, /gesloten|persoonlijke RTG-account/i);

    const rooster = await post(srv.base, '/api/supplier/roster', { code: 'WILLEKEURIG' });
    assert.equal(rooster.status, 403, 'ook de publieke naamkiezer van de PIN-deur blijft dicht');
  } finally {
    stop(srv);
  }
});

test('server en leverancier-UI zijn statisch aan de account-only poort gekoppeld', () => {
  const server = fs.readFileSync(path.join(WORTEL, 'server/server.js'), 'utf8');
  const poort = fs.readFileSync(path.join(WORTEL, 'server/opzet/leverancierpoort.js'), 'utf8');
  const scherm = fs.readFileSync(path.join(WORTEL, 'public/apps/leverancier.html'), 'utf8');
  const schermBron = fs.readFileSync(path.join(WORTEL,
    'public/apps/leverancier/leverancier-04.js'), 'utf8');

  assert.match(server,
    /require\('\.\/opzet\/leverancierpoort'\)\(\{[^}]*\bDEMO,\s*accounts,/s,
    'de samensteller injecteert de levende accountkluis in de centrale supplierpoort');
  assert.match(poort, /accounts\.controleerStaffSessie\(sess\)/,
    'supplierAuth voert de verse account/staff-controle werkelijk uit');
  assert.doesNotMatch(scherm, /id=["']enPin["']/,
    'de productie-aanmelding vraagt geen nieuwe personeelspin');
  assert.match(schermBron, /login\(\{\s*login:[\s\S]*?\},\s*false\)/,
    'het normale formulier kiest het persoonlijke accountpad');
});
