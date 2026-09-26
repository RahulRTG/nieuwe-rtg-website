/* LEZEN IS NIET EXPORTEREN (AUTHORITY.md fase 6).

   Drie dingen die niet mogen sneuvelen:
   1. elke kantoorroute die een bijlage meegeeft (Content-Disposition:
      attachment) staat in het exportregister -- gezocht in de BRON, niet in een
      lijst die iemand bijhoudt; een nieuwe export zonder verklaring laat dit
      zakken;
   2. elke verklaarde export hangt achter een poort die een MENS eist, en het
      register zegt dezelfde poort als de router;
   3. tegen een echte server: de gedeelde code exporteert niets, een mens op naam
      wel, en alleen een GELEVERDE export telt in de stand van de beleidsmotor.

   Draai los: node --test test/beleidsmotor-exporten.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');
const { alleRoutes } = require('../scripts/lib/routes');
const { EIST_MENS, KANTOORPAD } = require('../scripts/kantoormacht');
const { EXPORTEN } = require('../server/kern/beleidsmotor/werkwoorden');

const ROOT = path.join(__dirname, '..');
const routes = alleRoutes();

/* Per bestand: welke route-registraties dragen een bijlage in hun lijf. Het lijf
   loopt van de registratie tot de volgende `app.<methode>(`. Commentaar telt
   niet mee: een regel die UITLEGT dat er geen bijlage is, is geen bijlage. */
function exportenInBron() {
  const gevonden = new Set();
  const bestanden = [...new Set(routes.map(r => r.bestand).filter(Boolean))];
  for (const b of bestanden) {
    const bron = fs.readFileSync(path.join(ROOT, b), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    if (!/attachment/.test(bron)) continue;
    const reg = /app\.(get|post|put|patch|delete)\(\s*'([^']+)'/g;
    const plekken = [];
    let m;
    while ((m = reg.exec(bron))) plekken.push({ methode: m[1].toUpperCase(), pad: m[2], at: m.index });
    plekken.forEach((p, i) => {
      const lijf = bron.slice(p.at, i + 1 < plekken.length ? plekken[i + 1].at : bron.length);
      if (/attachment/.test(lijf) && KANTOORPAD.test(p.pad)) gevonden.add(p.methode + ' ' + p.pad);
    });
  }
  return gevonden;
}

test('1. elke kantoorbijlage in de bron staat in het exportregister, en andersom', () => {
  const inBron = exportenInBron();
  assert.ok(inBron.size >= 2, 'de zoeker vindt de bekende exporten (' + [...inBron].join(', ') + ')');
  const onverklaard = [...inBron].filter(r => !EXPORTEN[r]);
  assert.deepEqual(onverklaard, [], 'kantoorexport zonder verklaring in kern/beleidsmotor/werkwoorden.js');
  const verdwenen = Object.keys(EXPORTEN).filter(r => !inBron.has(r));
  assert.deepEqual(verdwenen, [], 'een verklaarde export die in de bron geen bijlage meer geeft');
});

test('2. elke export eist een mens, en het register zegt dezelfde poort als de router', () => {
  for (const [sleutel, e] of Object.entries(EXPORTEN)) {
    const [methode, pad] = sleutel.split(' ');
    const r = routes.find(x => x.methode === methode && x.pad === pad);
    assert.ok(r, 'de route bestaat: ' + sleutel);
    assert.ok(EIST_MENS.has(e.poort), sleutel + ': ' + e.poort + ' eist geen mens');
    assert.ok((r.bewakers || []).includes(e.poort), sleutel + ': de router zegt ' + (r.bewakers || []).join(',') + ', het register ' + e.poort);
    assert.ok(e.spoor && e.wat, sleutel + ': spoor en wat horen erbij');
  }
});

const mappen = [];
let srv, gedeeld, opNaam, eig;
function api(pad, body, token) {
  return fetch(srv.base + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, tekst: await r.text() }));
}
test.before(async () => {
  const m = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-export-')); mappen.push(m);
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: m, OFFICE_CODE: 'EXPORT-KANTOOR' } });
  gedeeld = JSON.parse((await api('/api/office/login', { code: 'EXPORT-KANTOOR' })).tekst).token;
  opNaam = await kantoorAlsPersoon(srv.base, 'EXPORT-KANTOOR');
  eig = JSON.parse((await api('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).tekst).token;
  assert.ok(gedeeld && opNaam && eig);
});
test.after(() => {
  stop(srv && srv.child);
  for (const m of mappen) { try { fs.rmSync(m, { recursive: true, force: true }); } catch (e) {} }
});

test('3. de gedeelde code exporteert niets; een geleverde export telt, een geweigerde niet', async () => {
  assert.equal((await api('/api/office/export.csv', {}, gedeeld)).status, 403, 'de gedeelde code krijgt geen boekhoudexport');
  assert.equal((await api('/api/office/aidata/export', {}, gedeeld)).status, 403, 'en geen AI-dataset');
  const csv = await api('/api/office/export.csv', {}, opNaam);
  assert.equal(csv.status, 200, 'een mens op naam exporteert');
  assert.match(csv.tekst, /datum;soort/);
  const st = JSON.parse((await api('/api/office/beleidsmotor', {}, eig)).tekst);
  const per = Object.fromEntries(st.exporten.map(e => [e.route, e.geleverd]));
  assert.equal(per['POST /api/office/export.csv'], 1, 'de geleverde export telt precies een keer');
  assert.equal(per['POST /api/office/aidata/export'], 0, 'de geweigerde AI-export telt niet');
});
