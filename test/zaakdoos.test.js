/* De Zaakdoos end-to-end: een cloudserver en een doos-kastje ernaast.
   1. Online is de doos een doorgeefluik (inloggen via de doos raakt de cloud)
      en haalt hij een verse datakloon binnen.
   2. De cloud valt weg: de doos schakelt naar lokaal, de zaak logt gewoon in
      en werkt door (overschot melden op het keukenscherm), het journaal telt.
   3. De cloud komt terug op dezelfde poort: de doos speelt het journaal na en
      de actie staat daarna echt in de cloud.
   Draai los: node --experimental-sqlite --test test/zaakdoos.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, vrijePoort, stop } = require('./helper');

const SLEUTEL = 'doos-test-sleutel-1234';
const TMP_CLOUD = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-doos-cloud-'));
const TMP_DOOS = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-doos-box-'));

let cloudPort, cloudChild, doos;
const cloudBase = () => 'http://127.0.0.1:' + cloudPort;

function startCloud() {
  cloudChild = spawn(process.execPath, ['--experimental-sqlite', path.join(__dirname, '..', 'server', 'server.js')], {
    env: { ...process.env, NODE_ENV: 'test', PORT: String(cloudPort), RTG_DATA_DIR: TMP_CLOUD, SMTP_URL: '', RTG_DOOS_SLEUTEL: SLEUTEL, OFFICE_CODE: 'DOOS-KANTOOR-1' },
    stdio: ['ignore', 'ignore', 'inherit']
  });
}
async function wachtOp(pad, base, keur, pogingen = 100) {
  for (let i = 0; i < pogingen; i++) {
    try {
      const r = await fetch(base + pad, { headers: { 'X-Forwarded-Proto': 'https' } });
      if (r.ok) { const d = await r.json(); if (!keur || keur(d)) return d; }
    } catch (e) { /* nog niet op */ }
    await new Promise(res => setTimeout(res, 200));
  }
  throw new Error('kwam niet op: ' + pad);
}
function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

test.before(async () => {
  cloudPort = await vrijePoort();
  startCloud();
  await wachtOp('/api/health', cloudBase());
  doos = await startServer({ env: {
    RTG_DATA_DIR: TMP_DOOS, SMTP_URL: '',
    RTG_DOOS_CLOUD: cloudBase(), RTG_DOOS_SLEUTEL: SLEUTEL,
    RTG_DOOS_USER: 'rahul', RTG_DOOS_WACHTWOORD: 'Imran',
    RTG_DOOS_NETWERK: '1', RTG_DOOS_NAAM: 'testdoos',
    RTG_DOOS_MELD_MS: '2000', RTG_DOOS_PLEK: '38.98,1.30'
  } });
});
test.after(() => {
  stop(doos && doos.child);
  if (cloudChild) try { cloudChild.kill('SIGKILL'); } catch (e) {}
  for (const t of [TMP_CLOUD, TMP_DOOS]) try { fs.rmSync(t, { recursive: true, force: true }); } catch (e) {}
});

let itemId; // een gerecht uit het cloudmenu, voor de overschot-melding

test('online: de doos is een doorgeefluik en haalt de datakloon binnen', async () => {
  const st = await wachtOp('/api/doos/status', doos.base, d => d.modus === 'cloud');
  assert.equal(st.doos, true);
  // inloggen via de doos raakt de cloud (doorgeefluik)
  const login = await api(doos.base, '/api/supplier/login', { username: 'rahul', password: 'Imran' });
  assert.equal(login.status, 200, 'de zaak logt in via de doos');
  const state = (await api(doos.base, '/api/supplier/state', {}, login.body.token)).body.state;
  assert.ok(state && state.supplier, 'de zaakstaat komt via de doos uit de cloud');
  itemId = (state.menu && state.menu[0] && state.menu[0].id) || null;
  assert.ok(itemId, 'het menu is er (nodig voor de keuken-actie straks)');
  // de kloon is (of komt) binnen
  await wachtOp('/api/doos/status', doos.base, d => d.laatsteKloon > 0, 150);
  // en de kloon-route zelf is dicht zonder sleutel
  const dicht = await fetch(cloudBase() + '/api/doos/kloon');
  assert.equal(dicht.status, 403);
});

test('het meetstation: de vloot meldt lijnmetingen, alleen met de sleutel', async () => {
  // de doos meldt vanzelf (eerste tik); en het endpoint zelf is dicht zonder sleutel
  const dicht = await fetch(cloudBase() + '/api/doos/meting', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ doos: 'x', rtt: 1 }) });
  assert.equal(dicht.status, 403);
  const open = await fetch(cloudBase() + '/api/doos/meting', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-doos-sleutel': SLEUTEL },
    body: JSON.stringify({ doos: 'beachclub-sol', rtt: 340, modus: 'cloud', journaal: 0 })
  });
  assert.equal(open.status, 200);
  assert.ok((await open.json()).ok, 'de meting is geland op de vlootkaart');
  // het nachtrapport-endpoint van de cloud: hetzelfde sleutelregime
  const rapDicht = await fetch(cloudBase() + '/api/doos/rapport', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(rapDicht.status, 403);
  const rapOpen = await fetch(cloudBase() + '/api/doos/rapport', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-doos-sleutel': SLEUTEL },
    body: JSON.stringify({ doos: 'beachclub-sol', datum: '2026-07-15', pings: 8640, rttGem: 420, uitval: 1, lokaalMin: 12, nagespeeld: 3 })
  });
  assert.equal(rapOpen.status, 200);
});

test('de buurtfailover: een buurdoos zonder lijn meldt zich via deze doos', async () => {
  const dicht = await fetch(doos.base + '/api/doos/buurmelding', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ doos: 'x' }) });
  assert.equal(dicht.status, 403);
  const r = await fetch(doos.base + '/api/doos/buurmelding', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-doos-sleutel': SLEUTEL },
    body: JSON.stringify({ doos: 'strandtent-west', rtt: 0, modus: 'lokaal', journaal: 3 })
  });
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.ok(d.ok && d.doorgegeven, 'de melding is doorgegeven aan de cloud');
  // en de vlootkaart in de Intern & IT-kamer toont hem, met via-stempel
  const login = await fetch(cloudBase() + '/api/office/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: 'DOOS-KANTOOR-1' })
  });
  const token = (await login.json()).token;
  const kamer = await fetch(cloudBase() + '/api/office/kamer', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ id: 'intern' })
  }).then(x => x.json());
  const vloot = ((kamer.lijsten || []).find(l => /vloot/i.test(l.titel)) || {}).items || [];
  assert.ok(vloot.some(t => t.includes('strandtent-west') && t.includes('via testdoos')), 'de vlootkaart toont de buurmelding');
});

test('de wereldknop bereikt een echte doos: hulp-opdracht, diagnoserapport terug', async () => {
  // het kantoor drukt op Help bij testdoos (die staat op de kaart via zijn meldingen)
  const login = await fetch(cloudBase() + '/api/office/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: 'DOOS-KANTOOR-1' })
  });
  const token = (await login.json()).token;
  const office = (pad, body) => fetch(cloudBase() + '/api/office/' + pad, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(body || {})
  }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  // wachten tot testdoos op de wereldkaart staat (zijn eerste melding)
  let w;
  for (let i = 0; i < 60; i++) {
    w = await office('wereld');
    if ((w.body.items || []).some(x => x.id === 'doos:testdoos')) break;
    await new Promise(r => setTimeout(r, 500));
  }
  const bol = w.body.items.find(x => x.id === 'doos:testdoos');
  assert.ok(bol, 'testdoos staat op de wereldkaart');
  assert.equal(bol.status, 'groen');
  assert.deepEqual(bol.plek, { lat: 38.98, lon: 1.3 }, 'met zijn plek erbij');
  assert.equal((await office('wereld/actie', { id: 'doos:testdoos', actie: 'hulp', naam: 'Keurmeester' })).status, 200);
  // de doos haalt de opdracht op bij zijn volgende melding en stuurt direct
  // zijn diagnoserapport; dat verschijnt in het nachtwerk-overzicht
  let gezien = false;
  for (let i = 0; i < 60 && !gezien; i++) {
    const kamer = (await office('kamer', { id: 'intern' })).body;
    const nacht = ((kamer.lijsten || []).find(l => /nachtwerk/i.test(l.titel)) || {}).items || [];
    gezien = nacht.some(t => t.includes('testdoos'));
    if (!gezien) await new Promise(r => setTimeout(r, 500));
  }
  assert.ok(gezien, 'het diagnoserapport van testdoos is binnen');
});

let fotoNaam; // een Salon-foto op de cloud, voor de randcache
const FOTO = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

test('de randcache: een foto die over de lijn kwam, blijft op de doos', async () => {
  // een foto rechtstreeks in de cloudmediastore leggen (zonder RTG_ENC_KEY onversleuteld)
  fotoNaam = require('node:crypto').randomBytes(16).toString('hex') + '.png';
  fs.mkdirSync(path.join(TMP_CLOUD, 'media'), { recursive: true });
  fs.writeFileSync(path.join(TMP_CLOUD, 'media', fotoNaam), FOTO);
  const r = await fetch(doos.base + '/media/' + fotoNaam);
  assert.equal(r.status, 200, 'online komt de foto via het doorgeefluik');
  assert.equal(Buffer.compare(Buffer.from(await r.arrayBuffer()), FOTO), 0, 'byte voor byte dezelfde foto');
});

test('de lijn valt weg: de zaak werkt lokaal door en het journaal telt mee', async () => {
  // Borg dat er minstens een gezonde ping geteld is voordat de lijn wegvalt: de
  // pinger tikt elke 10s, dus op een snelle runner kan het dagrapport (verderop)
  // anders pings=0 zien omdat de eerste tik nog niet gelopen had.
  await wachtOp('/api/doos/rapport', doos.base, d => d.pings >= 1);
  cloudChild.kill('SIGKILL');
  await new Promise(r => setTimeout(r, 300));
  // het eerstvolgende verzoek merkt het en valt door naar lokaal: inloggen
  // lukt gewoon, op de kloon-data van de doos zelf
  let login;
  for (let i = 0; i < 10; i++) {
    login = await api(doos.base, '/api/supplier/login', { username: 'rahul', password: 'Imran' });
    if (login.status === 200) break;
    await new Promise(r => setTimeout(r, 500));
  }
  assert.equal(login.status, 200, 'inloggen op de doos zelf, zonder cloud');
  const st = await wachtOp('/api/doos/status', doos.base, d => d.modus === 'lokaal');
  assert.equal(st.modus, 'lokaal');
  // het keukenscherm meldt een overschot; dat werkt lokaal en komt in het journaal
  const over = await api(doos.base, '/api/supplier/overschot', { op: 'erbij', itemId, qty: 2 }, login.body.token);
  assert.equal(over.status, 200, 'de keuken-actie lukt lokaal');
  const na = await wachtOp('/api/doos/status', doos.base, d => d.journaal >= 1);
  assert.ok(na.journaal >= 1, 'de actie staat in het journaal');
  // en de zaakstaat op de doos toont hem meteen
  const state = (await api(doos.base, '/api/supplier/state', {}, login.body.token)).body.state;
  assert.ok((state.overschot || []).some(o => o.itemId === itemId), 'het overschot staat op het lokale scherm');
});

test('zonder lijn: de randcache serveert de foto en het dagrapport telt mee', async () => {
  const r = await fetch(doos.base + '/media/' + fotoNaam);
  assert.equal(r.status, 200, 'de foto komt uit de randcache van de doos zelf');
  assert.equal(Buffer.compare(Buffer.from(await r.arrayBuffer()), FOTO), 0, 'dezelfde bytes, nu zonder cloud');
  assert.ok((r.headers.get('content-type') || '').startsWith('image/'), 'met het juiste type');
  // het nachtwerk-dagrapport van de doos zelf: pings en uitval zijn geteld
  const rap = await (await fetch(doos.base + '/api/doos/rapport')).json();
  assert.ok(rap.pings >= 1, 'de pings zijn geteld');
  assert.ok(rap.uitval >= 1, 'de uitval staat in het dagrapport');
  assert.equal(rap.doos, 'testdoos');
});

test('de lijn komt terug: het journaal wordt nagespeeld en de cloud kent de actie', async () => {
  startCloud(); // zelfde poort, zelfde data
  await wachtOp('/api/health', cloudBase());
  // de doos merkt het (pinger elke 10s), speelt na en wordt weer doorgeefluik
  const st = await wachtOp('/api/doos/status', doos.base, d => d.modus === 'cloud' && d.journaal === 0, 200);
  assert.equal(st.journaal, 0, 'het journaal is leeg nagespeeld');
  // rechtstreeks op de cloud controleren dat de keuken-actie er echt staat
  const login = await api(cloudBase(), '/api/supplier/login', { username: 'rahul', password: 'Imran' });
  const state = (await api(cloudBase(), '/api/supplier/state', {}, login.body.token)).body.state;
  assert.ok((state.overschot || []).some(o => o.itemId === itemId && o.qty === 2), 'de overschot-melding staat in de cloud');
});

test('de doos-status toont kloon-leeftijd, randcache en cloud-info', async () => {
  const st = await (await fetch(doos.base + '/api/doos/status')).json();
  assert.equal(st.clouds, 1, 'een enkele cloud geconfigureerd');
  assert.equal(st.actieveCloud, 0, 'op de primaire cloud');
  assert.equal(typeof st.kasStuks, 'number', 'de randcache-telling staat in de status');
  assert.ok(st.kasStuks >= 1, 'de eerder gecachete foto telt mee in de randcache');
  assert.ok(st.kloonLeeftijdMin === null || typeof st.kloonLeeftijdMin === 'number', 'kloon-leeftijd is een getal of null');
  // het dagrapport draagt de nieuwe velden ook
  const rap = await (await fetch(doos.base + '/api/doos/rapport')).json();
  assert.ok('kasStuks' in rap && 'journaalNu' in rap && 'kloonLeeftijdMin' in rap, 'het dagrapport is verrijkt');
});

test('cloud-failover: valt de primaire cloud weg, dan pakt de doos de replica', async () => {
  const dirA = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-doos-a-'));
  const dirB = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-doos-b-'));
  const dirBox = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-doos-fo-'));
  const portA = await vrijePoort();
  const portB = await vrijePoort();
  const spawnCloud = (port, dir) => spawn(process.execPath, ['--experimental-sqlite', path.join(__dirname, '..', 'server', 'server.js')], {
    env: { ...process.env, NODE_ENV: 'test', PORT: String(port), RTG_DATA_DIR: dir, SMTP_URL: '', RTG_DOOS_SLEUTEL: SLEUTEL, OFFICE_CODE: 'DOOS-KANTOOR-2' },
    stdio: ['ignore', 'ignore', 'inherit']
  });
  let cloudA = spawnCloud(portA, dirA);
  let cloudB = spawnCloud(portB, dirB);
  let box;
  try {
    await wachtOp('/api/health', 'http://127.0.0.1:' + portA);
    await wachtOp('/api/health', 'http://127.0.0.1:' + portB);
    box = await startServer({ env: {
      RTG_DATA_DIR: dirBox, SMTP_URL: '',
      RTG_DOOS_CLOUD: 'http://127.0.0.1:' + portA + ',http://127.0.0.1:' + portB,
      RTG_DOOS_SLEUTEL: SLEUTEL, RTG_DOOS_USER: 'rahul', RTG_DOOS_WACHTWOORD: 'Imran',
      RTG_DOOS_NAAM: 'failoverdoos'
    } });
    // online op de primaire (cloud A). Ruim wachten: op een trage CI-runner
    // (drie processen + coverage-instrumentatie) kan het opkomen en de
    // failover-detectie samen ruim boven de oude 24s uitkomen; polls zijn
    // goedkoop, dus een failover-test hoort geduldig te zijn.
    const st0 = await wachtOp('/api/doos/status', box.base, d => d.modus === 'cloud' && d.actieveCloud === 0, 300);
    assert.equal(st0.clouds, 2, 'twee clouds geconfigureerd');
    // de primaire cloud valt weg
    cloudA.kill('SIGKILL');
    // de doos springt naar de replica (cloud B) en blijft doorgeefluik (niet lokaal)
    const st1 = await wachtOp('/api/doos/status', box.base, d => d.actieveCloud === 1, 300);
    assert.equal(st1.actieveCloud, 1, 'overgeschakeld naar de replica');
    assert.equal(st1.modus, 'cloud', 'gebleven als doorgeefluik, niet naar lokaal geschakeld');
  } finally {
    if (box) stop(box.child);
    for (const c of [cloudA, cloudB]) if (c) try { c.kill('SIGKILL'); } catch (e) {}
    for (const d of [dirA, dirB, dirBox]) try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) {}
  }
});
