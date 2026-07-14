/* Veilige mode-bezorgdienst: een modewinkel zet in een tik een bezorgdienst op,
   een lid laat bezorgen, en de koerier rondt veilig af met bezorgcode + foto.
   Veiligheid voor beide kanten: verkeerde code faalt, dure stukken vereisen een
   geverifieerd account (ID aan de deur), retour aan de deur kan. Draai: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

let srv, base, winkel, lid;
const ADRES = 'Carrer de la Mar 10, Ibiza';

test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-mb-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, DEMO_SUPPLIER: 'MAISON' } });
  base = srv.base;
  winkel = (await api(base, '/api/supplier/login', { username: 'rahul', password: 'Imran' })).body.token;
  const u = Date.now().toString().slice(-8);
  lid = (await api(base, '/api/auth/register', { name: 'Mode Lid', email: 'm' + u + '@x.nl',
    phone: '06' + u, password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' })).body.token;
});
test.after(() => stop(srv && srv.child));

test('1. de winkel heeft de bezorgdienst aan (demo) en kan hem instellen', async () => {
  const st = await api(base, '/api/supplier/mode/bezorg/setup', { aan: true, kosten: 6.5, gratisVanaf: 150, waardegrensId: 250 }, winkel);
  assert.equal(st.status, 200);
  assert.equal(st.body.instellingen.aan, true);
});

test('2. een lid laat bezorgen en krijgt een bezorgcode; onder de drempel kost het geld', async () => {
  const r = await api(base, '/api/mode/bezorg/aanvraag', { supplierCode: 'MAISON', adres: ADRES,
    items: [{ naam: 'Linnen jurk', maat: 'M', kleur: 'ecru', prijs: 80, aantal: 1 }] }, lid);
  assert.equal(r.status, 200);
  assert.match(String(r.body.bezorging.bezorgcode), /^\d{4}$/, 'een 4-cijferige bezorgcode');
  assert.equal(r.body.bezorging.kosten, 6.5, 'bezorgkosten onder de gratis-drempel');
  assert.equal(r.body.bezorging.status, 'aangevraagd');
});

test('3. gratis bezorgen boven de drempel', async () => {
  const r = await api(base, '/api/mode/bezorg/aanvraag', { supplierCode: 'MAISON', adres: ADRES,
    items: [{ naam: 'Wollen jas', prijs: 200, aantal: 1 }] }, lid);
  assert.equal(r.body.bezorging.kosten, 0, 'boven € 150 is bezorgen gratis');
});

test('4. dure levering vereist een geverifieerd account (ID aan de deur)', async () => {
  const r = await api(base, '/api/mode/bezorg/aanvraag', { supplierCode: 'MAISON', adres: ADRES,
    items: [{ naam: 'Designer tas', prijs: 900, aantal: 1 }] }, lid);
  assert.equal(r.status, 403, 'boven de waardegrens is een geverifieerd account nodig');
});

test('5. de koerier krijgt de kortste route en neemt een bezorging aan', async () => {
  const rt = await api(base, '/api/supplier/mode/bezorg/route', { lat: 38.907, lng: 1.435 }, winkel);
  assert.ok(rt.body.route.length >= 1, 'open bezorgingen op de route');
  // de route is oplopend in afstand
  const ds = rt.body.route.map(x => x.afstandM).filter(d => d != null);
  for (let i = 1; i < ds.length; i++) assert.ok(ds[i] >= ds[i - 1], 'dichtstbijzijnde eerst');
  const ref = rt.body.route[0].ref;
  const nm = await api(base, '/api/supplier/mode/bezorg/neem', { ref }, winkel);
  assert.equal(nm.body.status, 'onderweg');
  // live positie geeft een ETA aan de klant
  const gp = await api(base, '/api/supplier/mode/bezorg/gps', { ref, lat: 38.905, lng: 1.44 }, winkel);
  assert.equal(gp.status, 200);
});

test('6. veilig afronden: verkeerde bezorgcode faalt, juiste code levert af', async () => {
  const mijn = await api(base, '/api/mode/bezorg/mijn', {}, lid);
  const b = mijn.body.bezorgingen.find(x => x.status === 'onderweg') || mijn.body.bezorgingen[0];
  const fout = await api(base, '/api/supplier/mode/bezorg/overhandig', { ref: b.ref, bezorgcode: '0000' }, winkel);
  assert.equal(fout.status, 403, 'verkeerde bezorgcode wordt geweigerd');
  const goed = await api(base, '/api/supplier/mode/bezorg/overhandig', { ref: b.ref, bezorgcode: b.bezorgcode, foto: PNG }, winkel);
  assert.equal(goed.status, 200);
  assert.equal(goed.body.status, 'afgeleverd');
});

test('7. retour aan de deur (past niet)', async () => {
  const nieuw = await api(base, '/api/mode/bezorg/aanvraag', { supplierCode: 'MAISON', adres: ADRES,
    items: [{ naam: 'Zijden blouse', prijs: 90, aantal: 1 }] }, lid);
  const ref = nieuw.body.bezorging.ref;
  await api(base, '/api/supplier/mode/bezorg/neem', { ref }, winkel);
  const r = await api(base, '/api/supplier/mode/bezorg/retour', { ref, reden: 'Past niet' }, winkel);
  assert.equal(r.status, 200);
  const mijn = await api(base, '/api/mode/bezorg/mijn', {}, lid);
  assert.equal(mijn.body.bezorgingen.find(x => x.ref === ref).status, 'retour');
});
