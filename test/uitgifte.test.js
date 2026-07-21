/* De documentenuitgifte (kern/uitgifte.js): met een druk op de knop de
   officiele documentatie naar oude apparatuur of een harde schijf, altijd
   achter het 4- of 6-ogenprincipe. Getest voor de drie huizen: de zaak
   (roster-namen), het rijk (ambtenaren) en het RTG-kantoor (naamplicht).
   Draai los: node --experimental-sqlite --test test/uitgifte.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

let srv, base, eva, joan, sofia, sander, fatima, office;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-uitgifte-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const login = async (code, naam) => {
    const roster = await api(base, '/api/supplier/roster', { code });
    const m = roster.body.staff.find(x => x.name === naam);
    return (await api(base, '/api/supplier/login', { code, staffId: m.id, pin: m.role === 'manager' ? '1234' : '5678' })).body.token;
  };
  // drie paar ogen op de luchthaven (de zaak), twee bij het rijk
  eva = await login('LUCHT', 'Eva Duarte');
  joan = await login('LUCHT', 'Joan Mari');
  sofia = await login('LUCHT', 'Sofia Ledesma');
  sander = await login('RIJK', 'Sander de Vries');
  fatima = await login('RIJK', 'Fatima El Amrani');
  office = (await api(base, '/api/office/login', { code: 'RTG-OFFICE' })).body.token;
  // een kassabon zodat de zaak-bundel echte regels draagt
  await api(base, '/api/supplier/pos/sale', { method: 'contant', total: 25, items: [{ name: 'Loungekaart', qty: 1, price: 25 }] }, eva);
});
test.after(() => stop(srv && srv.child));

test('1. de zaak, 4 ogen: dezelfde ogen tellen nooit dubbel; een collega geeft vrij en de bundel komt EEN keer', async () => {
  const st = await api(base, '/api/supplier/uitgifte/start', { bron: 'kassabonnen', ogen: 4, doel: 'oude kassacomputer' }, eva);
  assert.equal(st.status, 200);
  const uid = st.body.uitgifte.id;
  assert.equal(st.body.uitgifte.status, 'wacht-op-ogen');
  assert.equal(st.body.uitgifte.nogNodig, 1, 'de aanvrager is de eerste handtekening');
  // de bundel komt niet vrij zonder de tweede ogen
  assert.equal((await api(base, '/api/supplier/uitgifte/bundel', { id: uid }, eva)).status, 409);
  // dezelfde persoon nog eens tekenen: geweigerd
  const zelf = await api(base, '/api/supplier/uitgifte/teken', { id: uid }, eva);
  assert.equal(zelf.status, 409);
  assert.match(zelf.body.error, /ANDERE/);
  // een collega tekent: vrijgegeven
  const mee = await api(base, '/api/supplier/uitgifte/teken', { id: uid }, joan);
  assert.equal(mee.status, 200);
  assert.equal(mee.body.uitgifte.status, 'vrijgegeven');
  // de bundel: een tekstblad met de handtekeningen en de bonregels
  const b = await api(base, '/api/supplier/uitgifte/bundel', { id: uid }, eva);
  assert.equal(b.status, 200);
  assert.match(b.body.blad, /OFFICIELE UITGIFTE/);
  assert.match(b.body.blad, /Eva Duarte, Joan Mari/);
  assert.match(b.body.blad, /Loungekaart/);
  // en daarna is de uitgifte verbruikt
  const weer = await api(base, '/api/supplier/uitgifte/bundel', { id: uid }, eva);
  assert.equal(weer.status, 409);
  assert.match(weer.body.error, /al overgeschreven/);
});

test('2. het 6-ogenprincipe: pas bij de derde persoon komt de vrijgave', async () => {
  const st = await api(base, '/api/supplier/uitgifte/start', { bron: 'facturen', ogen: 6, doel: 'harde schijf archief' }, eva);
  const uid = st.body.uitgifte.id;
  const twee = await api(base, '/api/supplier/uitgifte/teken', { id: uid }, joan);
  assert.equal(twee.body.uitgifte.status, 'wacht-op-ogen', 'twee van de drie is niet genoeg');
  assert.equal(twee.body.uitgifte.nogNodig, 1);
  const drie = await api(base, '/api/supplier/uitgifte/teken', { id: uid }, sofia);
  assert.equal(drie.body.uitgifte.status, 'vrijgegeven');
  assert.equal(drie.body.uitgifte.handtekeningen.length, 3);
});

test('3. het rijk: aanslagen naar de schijf, getekend door twee ambtenaren', async () => {
  const st = await api(base, '/api/overheid/uitgifte/start', { bron: 'aanslagen', ogen: 4, doel: 'oude archiefserver' }, sander);
  assert.equal(st.status, 200);
  const uid = st.body.uitgifte.id;
  await api(base, '/api/overheid/uitgifte/teken', { id: uid }, fatima);
  const b = await api(base, '/api/overheid/uitgifte/bundel', { id: uid }, sander);
  assert.equal(b.status, 200);
  assert.match(b.body.blad, /Sander de Vries, Fatima El Amrani/);
  // een gewone zaak komt niet aan de rijks-uitgifte
  assert.equal((await api(base, '/api/overheid/uitgifte', {}, eva)).status, 403);
});

test('4. het RTG-kantoor: elke handtekening draagt verplicht een naam, en dezelfde naam telt niet dubbel', async () => {
  assert.equal((await api(base, '/api/office/uitgifte/start', { bron: 'partnerregister', ogen: 4 }, office)).status, 400, 'zonder naam geen aanvraag');
  const st = await api(base, '/api/office/uitgifte/start', { bron: 'partnerregister', ogen: 4, doel: 'harde schijf kantoor', wie: 'Nora van Dam' }, office);
  assert.equal(st.status, 200);
  const uid = st.body.uitgifte.id;
  assert.equal((await api(base, '/api/office/uitgifte/teken', { id: uid, wie: 'Nora van Dam' }, office)).status, 409, 'zelfde naam telt niet');
  const mee = await api(base, '/api/office/uitgifte/teken', { id: uid, wie: 'Pieter Hage' }, office);
  assert.equal(mee.body.uitgifte.status, 'vrijgegeven');
  const b = await api(base, '/api/office/uitgifte/bundel', { id: uid, wie: 'Nora van Dam' }, office);
  assert.match(b.body.blad, /RTG|RIJK|LUCHT/, 'het partnerregister staat op het blad');
});

test('5. de randen: onbekende bron, verkeerde ogen, en zonder inlog geen uitgifte', async () => {
  assert.equal((await api(base, '/api/supplier/uitgifte/start', { bron: 'kluis', ogen: 4 }, eva)).status, 400);
  assert.equal((await api(base, '/api/supplier/uitgifte/start', { bron: 'facturen', ogen: 8 }, eva)).status, 400, 'alleen 4 of 6 ogen');
  assert.equal((await api(base, '/api/supplier/uitgifte', {}, null)).status, 401);
  assert.equal((await api(base, '/api/office/uitgifte', {}, null)).status, 401);
});
