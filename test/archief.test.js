/* De archiefkast: afgeronde tickets ouder dan een afgesloten kwartaal verhuizen
   naar append-only maandbestanden. De levende kast blijft klein, maar niets
   raakt zoek: de backoffice-totalen tellen het archief mee en de boekhoud-
   export leest het gewoon terug. Open of recente tickets blijven levend.
   Draai: node --experimental-sqlite --test test/archief.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { vrijePoort } = require('./helper');

// archief herstart de server meermaals (bewijs van persistentie), dus houden we
// een vaste vrije poort aan zodat BASE klopt over herstarts heen.
let PORT, BASE;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-arch-'));
let child;

const DAGEN_100 = new Date(Date.now() - 100 * 86400000).toISOString();
const GISTEREN = new Date(Date.now() - 2 * 86400000).toISOString();
const ORDER = (ref, at, status) => ({
  ref, pickup: 'AB' + ref.slice(-2), supplierCode: 'KIKUNOI', supplierName: 'Sal de Mar', type: 'restaurant',
  customerTier: 'rtg', customerKey: 'user-999', customerCodename: 'Zilveren Valk T',
  items: [{ id: 'm1', name: 'Gazpacho de sandia', qty: 1, price: 16 }], total: 16,
  betaalMoment: 'vooraf', status, paid: true, at
});

function boot() {
  child = spawn(process.execPath, ['--experimental-sqlite', path.join(__dirname, '..', 'server', 'server.js')], {
    // deze test seedt en leest het rauwe db.json en test dus bewust de JSON-opslag
    env: { ...process.env, PORT: String(PORT), RTG_DATA_DIR: TMP, RTG_STORE: 'json', NODE_ENV: 'test', SMTP_URL: '', RTG_OWNER_EMAIL: '' },
    stdio: ['ignore', 'ignore', 'inherit']
  });
  return (async () => {
    for (let i = 0; i < 100; i++) {
      try { const r = await fetch(BASE + '/api/health'); if (r.ok) return; } catch (e) {}
      await new Promise(r => setTimeout(r, 100));
    }
    throw new Error('server komt niet op');
  })();
}
const stop = () => new Promise(r => { child.once('exit', r); child.kill('SIGTERM'); });
const json = r => r.json();

async function ownerToken() {
  const r = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' }) });
  return (await r.json()).token;
}
async function officeState(token) {
  const r = await fetch(BASE + '/api/office/state', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: '{}' });
  return (await r.json()).state;
}

test.before(async () => {
  PORT = await vrijePoort();
  BASE = 'http://127.0.0.1:' + PORT;
  // 1) een verse kast maken, dan drie soorten tickets erin leggen
  await boot();
  await new Promise(r => setTimeout(r, 500));
  await stop();
  const DB = path.join(TMP, 'db.json');
  const data = JSON.parse(fs.readFileSync(DB, 'utf8'));
  data.orders = data.orders || [];
  data.orders.push(ORDER('RTG-O-OUDKLAAR', DAGEN_100, 'geserveerd')); // hoort in het archief
  data.orders.push(ORDER('RTG-O-OUDOPEN', DAGEN_100, 'nieuw'));       // oud maar OPEN: blijft levend
  data.orders.push(ORDER('RTG-O-VERS', GISTEREN, 'geserveerd'));      // afgerond maar vers: blijft levend
  fs.writeFileSync(DB, JSON.stringify(data));
  // 2) opnieuw opstarten: de archiefronde draait bij boot
  await boot();
});
test.after(async () => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('afgeronde oude tickets verhuizen naar een maandbestand; open en verse blijven levend', async () => {
  const maand = DAGEN_100.slice(0, 7);
  const bestand = path.join(TMP, 'archief', 'orders-' + maand + '.jsonl');
  assert.ok(fs.existsSync(bestand), 'het maandbestand bestaat');
  const regels = fs.readFileSync(bestand, 'utf8').trim().split('\n').map(r => JSON.parse(r));
  assert.ok(regels.some(o => o.ref === 'RTG-O-OUDKLAAR'), 'het oude afgeronde ticket staat in het archief');
  assert.ok(!regels.some(o => o.ref === 'RTG-O-OUDOPEN'), 'het open ticket is NIET gearchiveerd');

  // de levende kast: open en verse tickets zijn er nog, het oude afgeronde niet
  const tok = await ownerToken();
  const zoek = async q => {
    const r = await fetch(BASE + '/api/office/timeline', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify({ q }) });
    return (await r.json()).total;
  };
  assert.equal(await zoek('RTG-O-OUDKLAAR'), 0, 'gearchiveerd ticket is uit de levende kast');
  assert.equal(await zoek('RTG-O-OUDOPEN'), 1, 'het oude open ticket leeft nog');
  assert.equal(await zoek('RTG-O-VERS'), 1, 'het verse ticket leeft nog');
});

test('de backoffice-totalen tellen het archief mee', async () => {
  const tok = await ownerToken();
  const st = await officeState(tok);
  // levend: OUDOPEN + VERS = 2; archief: OUDKLAAR = 1; totaal = 3
  assert.equal(st.totals.orders, 3, 'levend plus archief telt alles');
});

test('de boekhoud-export bevat gearchiveerde en levende tickets', async () => {
  const tok = await ownerToken();
  const csv = await (await fetch(BASE + '/api/office/export.csv?token=' + tok)).text();
  assert.ok(csv.includes('Zilveren Valk T'), 'de export draait');
  const dagOud = DAGEN_100.slice(0, 10), dagVers = GISTEREN.slice(0, 10);
  assert.ok(csv.includes(dagOud), 'de gearchiveerde bestelling staat in de export');
  assert.ok(csv.includes(dagVers), 'de verse bestelling staat in de export');
});

test('een herstart archiveert niet dubbel', async () => {
  await stop();
  await boot();
  const tok = await ownerToken();
  const st = await officeState(tok);
  assert.equal(st.totals.orders, 3, 'het totaal blijft 3, ook na een tweede boot');
  const maand = DAGEN_100.slice(0, 7);
  const regels = fs.readFileSync(path.join(TMP, 'archief', 'orders-' + maand + '.jsonl'), 'utf8').trim().split('\n');
  assert.equal(regels.filter(r => r.includes('RTG-O-OUDKLAAR')).length, 1, 'het ticket staat maar een keer in het archief');
});

test('de archiefgrens is instelbaar op de technische pagina, zonder herstart', async () => {
  const tok = await ownerToken();
  // het verse (2 dagen oude, afgeronde) ticket is nu nog levend
  const tech0 = await json(await fetch(BASE + '/api/techniek/inloggen', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: 'roellie.i@gmail.com', wachtwoord: 'Imran' }) }));
  const status0 = await json(await fetch(BASE + '/api/techniek/status', { headers: { Authorization: 'Bearer ' + tech0.token } }));
  assert.ok(status0.archief && status0.archief.dagen >= 90, 'de standaardgrens is ruim');
  const levend0 = status0.archief.levend;
  // zet de grens op 1 dag: het 2-dagen-oude afgeronde ticket verhuist meteen mee
  const r = await json(await fetch(BASE + '/api/techniek/archief', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tech0.token },
    body: JSON.stringify({ dagen: 1 }) }));
  assert.equal(r.dagen, 1);
  assert.ok(r.verplaatst >= 1, 'het verse-maar-afgeronde ticket is nu gearchiveerd');
  assert.ok(r.levend < levend0, 'de levende kast is kleiner geworden');
  // maar het totaal (levend + archief) blijft kloppen: niets verloren
  const st = await officeState(tok);
  assert.equal(st.totals.orders, 3);
  // de instelling overleeft een herstart (staat in db.data.techniek)
  await stop();
  await boot();
  const tech1 = await json(await fetch(BASE + '/api/techniek/inloggen', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: 'roellie.i@gmail.com', wachtwoord: 'Imran' }) }));
  const status1 = await json(await fetch(BASE + '/api/techniek/status', { headers: { Authorization: 'Bearer ' + tech1.token } }));
  assert.equal(status1.archief.dagen, 1, 'de ingestelde grens is bewaard');
});
