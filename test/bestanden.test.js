/* RTG Bestanden: de kluis met mappen en quotum, versies, delen op codenaam,
   de prullenbak als zichtbare la en de stukken-upload voor grote bestanden.
   Draai los: node --experimental-sqlite --test test/bestanden.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, lidA, lidB, codeB;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bestanden-'));

function api(pad, body, token) {
  return fetch(base + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
const b64 = t => Buffer.from(t).toString('base64');
const alsTekst = t => 'data:text/plain;base64,' + b64(t);

let seq = 0;
async function lid() {
  const u = (Date.now() + (++seq)).toString().slice(-8);
  const reg = await api('/api/auth/register', { name: 'Kluislid ' + seq, email: 'bf' + u + '@x.nl',
    phone: '06' + u, password: 'geheim123', geboortedatum: '1988-03-03', geslacht: 'm', tier: 'rtg', pasApp: 'rtg' });
  const st = await api('/api/state', {}, reg.body.token);
  return { token: reg.body.token, codenaam: st.body.state.user.codename };
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const a = await lid(); const b = await lid();
  lidA = a.token; lidB = b.token; codeB = b.codenaam;
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. mappen en uploaden: de kluis met quotum, verplaatsen en de Office-spiegel', async () => {
  const m = await api('/api/bestanden/map', { naam: 'Reizen' }, lidA);
  assert.equal(m.status, 200);
  const sub = await api('/api/bestanden/map', { naam: 'Ibiza', ouder: m.body.id }, lidA);
  assert.equal(sub.status, 200, 'mappen nesten gewoon');

  const up = await api('/api/bestanden/upload', { naam: 'paklijst.txt', map: sub.body.id,
    dataUrl: alsTekst('Zonnebril. Linnen. Niets dat kreukt.') }, lidA);
  assert.equal(up.status, 200);
  assert.ok((await api('/api/bestanden/upload', { naam: 'kapot', dataUrl: 'geen-data-url' }, lidA)).status >= 400,
    'onzin wordt geen bestand');

  let l = await api('/api/bestanden/mijn', {}, lidA);
  const it = l.body.items.find(x => x.id === up.body.id);
  assert.equal(it.map, sub.body.id);
  assert.ok(l.body.gebruik > 0 && l.body.quotum > l.body.gebruik, 'het quotum telt eerlijk mee');

  // verplaatsen, hernoemen, een ster erop
  await api('/api/bestanden/wijzig', { id: it.id, map: m.body.id, naam: 'paklijst zomer.txt', ster: true }, lidA);
  l = await api('/api/bestanden/mijn', {}, lidA);
  const na = l.body.items.find(x => x.id === it.id);
  assert.equal(na.map, m.body.id);
  assert.equal(na.naam, 'paklijst zomer.txt');
  assert.equal(na.ster, true);

  // een map weghalen laat de inhoud een niveau omhoog vallen; niets verdwijnt
  await api('/api/bestanden/map', { id: m.body.id, weg: true }, lidA);
  l = await api('/api/bestanden/mijn', {}, lidA);
  assert.ok(!l.body.mappen.find(x => x.id === m.body.id));
  assert.equal(l.body.mappen.find(x => x.id === sub.body.id).ouder, null, 'de submap staat nu in de wortel');
  assert.equal(l.body.items.find(x => x.id === it.id).map, null);

  // de Office-spiegel: een document uit RTG Office is hier zichtbaar
  const doc = await api('/api/kantoorpakket/maak', { soort: 'tekst', titel: 'Reisnotitie' }, lidA);
  assert.equal(doc.status, 200);
  l = await api('/api/bestanden/mijn', {}, lidA);
  assert.ok(l.body.office.find(d => d.titel === 'Reisnotitie'), 'Office-werk is zichtbaar in de kluis');
});

test('2. versies: een nieuwe upload schuift de oude opzij, en terugzetten kan altijd', async () => {
  const up = await api('/api/bestanden/upload', { naam: 'contract.txt', dataUrl: alsTekst('versie een') }, lidA);
  await api('/api/bestanden/upload', { id: up.body.id, dataUrl: alsTekst('versie twee') }, lidA);
  const v = await api('/api/bestanden/versies', { id: up.body.id }, lidA);
  assert.equal(v.body.versies.length, 1, 'de eerste versie is bewaard');

  const oud = await api('/api/bestanden/haal', { id: up.body.id, versie: 0 }, lidA);
  assert.ok(Buffer.from(oud.body.dataUrl.split(',')[1], 'base64').toString() === 'versie een');

  const terug = await api('/api/bestanden/versieterug', { id: up.body.id, n: 0 }, lidA);
  assert.equal(terug.status, 200);
  const nu = await api('/api/bestanden/haal', { id: up.body.id }, lidA);
  assert.equal(Buffer.from(nu.body.dataUrl.split(',')[1], 'base64').toString(), 'versie een');
  const v2 = await api('/api/bestanden/versies', { id: up.body.id }, lidA);
  assert.equal(v2.body.versies.length, 1, 'terugzetten gooit niets weg');
});

test('3. delen op codenaam: B haalt op en zet een nieuwe versie; nergens een echte naam', async () => {
  const up = await api('/api/bestanden/upload', { naam: 'menu.txt', dataUrl: alsTekst('gazpacho') }, lidA);
  const d = await api('/api/bestanden/deel', { id: up.body.id, codenaam: codeB }, lidA);
  assert.equal(d.status, 200);

  const mb = await api('/api/bestanden/mijn', {}, lidB);
  const gedeeld = mb.body.gedeeld.find(x => x.id === up.body.id);
  assert.ok(gedeeld, 'B ziet het bestand');
  assert.ok(!/Kluislid/.test(JSON.stringify(mb.body)), 'nergens een echte naam');

  const haal = await api('/api/bestanden/haal', { id: up.body.id }, lidB);
  assert.equal(haal.status, 200);

  await api('/api/bestanden/upload', { id: up.body.id, dataUrl: alsTekst('gazpacho en tortilla') }, lidB);
  const bijA = await api('/api/bestanden/haal', { id: up.body.id }, lidA);
  assert.ok(/tortilla/.test(Buffer.from(bijA.body.dataUrl.split(',')[1], 'base64').toString()),
    'de versie van B staat bij A');
  const va = await api('/api/bestanden/versies', { id: up.body.id }, lidA);
  assert.equal(va.body.huidig.door, codeB, 'wie het was staat erbij, op codenaam');

  // B haalt zichzelf eraf; A houdt het bestand gewoon
  await api('/api/bestanden/weg', { id: up.body.id }, lidB);
  const mb2 = await api('/api/bestanden/mijn', {}, lidB);
  assert.ok(!mb2.body.gedeeld.find(x => x.id === up.body.id));
  assert.ok((await api('/api/bestanden/mijn', {}, lidA)).body.items.find(x => x.id === up.body.id));
});

test('4. de prullenbak is een la met een klok: herstellen kan, echt weg is echt weg', async () => {
  const up = await api('/api/bestanden/upload', { naam: 'kladje.txt', dataUrl: alsTekst('weg ermee') }, lidA);
  const weg1 = await api('/api/bestanden/weg', { id: up.body.id }, lidA);
  assert.equal(weg1.body.prullenbak, true, 'eerst naar de prullenbak, niet meteen weg');
  let l = await api('/api/bestanden/mijn', {}, lidA);
  assert.equal(l.body.items.find(x => x.id === up.body.id).weg, true);

  await api('/api/bestanden/herstel', { id: up.body.id }, lidA);
  l = await api('/api/bestanden/mijn', {}, lidA);
  assert.equal(l.body.items.find(x => x.id === up.body.id).weg, false, 'herstellen kan altijd binnen 30 dagen');

  await api('/api/bestanden/weg', { id: up.body.id }, lidA);
  await api('/api/bestanden/leeg', {}, lidA);
  l = await api('/api/bestanden/mijn', {}, lidA);
  assert.ok(!l.body.items.find(x => x.id === up.body.id), 'de la is leeg');
  assert.equal((await api('/api/bestanden/haal', { id: up.body.id }, lidA)).status, 404, 'de inhoud is echt weg');
});

test('5. grote bestanden gaan in stukken en lopen door dezelfde poort (quotum en al)', async () => {
  const start = await api('/api/bestanden/upstart', { naam: 'album.txt', mime: 'text/plain' }, lidA);
  assert.equal(start.status, 200);
  const heel = b64('een lange brief. '.repeat(40));
  const helft = Math.ceil(heel.length / 2);
  assert.equal((await api('/api/bestanden/updeel', { uploadId: start.body.uploadId, stuk: heel.slice(0, helft) }, lidA)).status, 200);
  assert.equal((await api('/api/bestanden/updeel', { uploadId: start.body.uploadId, stuk: heel.slice(helft) }, lidA)).status, 200);
  const klaar = await api('/api/bestanden/upklaar', { uploadId: start.body.uploadId }, lidA);
  assert.equal(klaar.status, 200);
  const terug = await api('/api/bestanden/haal', { id: klaar.body.id }, lidA);
  assert.ok(/een lange brief/.test(Buffer.from(terug.body.dataUrl.split(',')[1], 'base64').toString()),
    'de stukken zijn weer een geheel');
  assert.equal((await api('/api/bestanden/upklaar', { uploadId: start.body.uploadId }, lidA)).status, 404,
    'een upload is een keer klaar');
});
