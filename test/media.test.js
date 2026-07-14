/* De mediastore: foto's van de Salon en snaps staan als losse bestanden op schijf,
   niet als base64 in db.data. Zo groeit het werkgeheugen en elke db-snapshot niet
   mee met de foto's. Dekt de module (bewaar/lees/verwijder/serveer/migreer) en de
   echte weg: een leverancier plaatst een pagina-foto, die als /media-URL wordt
   bewaard en over HTTP wordt uitgeserveerd. Draai: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const { maakMedia } = require('../server/media');

// een echte 1x1 PNG als data-URL
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const SVG = 'data:image/svg+xml;base64,' + Buffer.from('<svg/>').toString('base64');

test('module: bewaar schrijft een bestand en houdt db-vrij van base64', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-media-'));
  const media = maakMedia({ dir });
  const naam = media.bewaar(PNG, 900 * 1024);
  assert.ok(naam && /^[0-9a-f]{32}\.png$/.test(naam), 'bewaar geeft een bestandsnaam terug');
  assert.ok(fs.existsSync(media.pad(naam)), 'het bestand staat op schijf');
  // de opgeslagen verwijzing is kort (geen base64-berg)
  assert.ok(naam.length < 60, 'de verwijzing is klein');
  // teruglezen geeft dezelfde foto
  assert.equal(media.leesDataUrl(naam), PNG, 'leesDataUrl geeft exact dezelfde foto terug');
  // publieke variant geeft een /media-URL
  assert.ok(media.bewaarPubliek(PNG).startsWith('/media/'), 'bewaarPubliek geeft een /media-URL');
  // verwijderen haalt het bestand echt weg
  media.verwijder(naam);
  assert.ok(!fs.existsSync(media.pad(naam)), 'na verwijder is het bestand weg');
});

test('module: alleen echte afbeeldingen, te groot wordt geweigerd, oude data-URL blijft werken', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-media-'));
  const media = maakMedia({ dir });
  assert.equal(media.bewaar('data:text/plain;base64,aGoi'), null, 'geen afbeelding: geweigerd');
  assert.equal(media.bewaar(SVG), null, 'svg (placeholder) hoort niet in de store');
  assert.equal(media.bewaar(PNG, 4), null, 'te groot: geweigerd');
  // een oude, nog-inline data-URL laat leesDataUrl gewoon door (terugval)
  assert.equal(media.leesDataUrl(PNG), PNG, 'oude inline foto blijft werken');
});

test('module: serveer streamt de foto met het juiste type; migreer verplaatst bestaande base64', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-media-'));
  const media = maakMedia({ dir });
  const naam = media.bewaar(PNG);
  // nagebootste req/res
  let type = null, code = 200, body = null;
  const res = { set: (k, v) => { if (k === 'Content-Type') type = v; }, status: c => { code = c; return res; }, end: b => { body = b; } };
  media.serveer({ params: { naam } }, res);
  assert.equal(type, 'image/png', 'serveer zet het juiste content-type');
  assert.ok(Buffer.isBuffer(body) && body.length > 0, 'serveer geeft de bytes terug');
  // padtraversal / onbekende naam wordt geweigerd
  media.serveer({ params: { naam: '../secret' } }, res);
  assert.equal(code, 400, 'geen directory-traversal');

  // migratie: een db met base64-foto's -> verwijzingen
  const db = { data: {
    suppliers: [{ code: 'A', photos: [PNG, PNG], salon: { foto: PNG } }],
    posts: [{ photo: PNG, folder: { fotos: [PNG] } }],
    snaps: [{ foto: PNG }],
    stories: [{ foto: SVG }] // svg blijft (geen echte upload)
  } };
  const n = media.migreerDb(db);
  // 2 pagina-foto's + 1 profielfoto + 1 post-foto + 1 folderfoto + 1 snap = 6 (svg niet)
  assert.equal(n, 6, 'zes echte foto\'s verplaatst (svg-placeholder niet)');
  assert.ok(db.data.suppliers[0].photos.every(p => p.startsWith('/media/')), 'pagina-foto\'s zijn nu /media-URLs');
  assert.ok(db.data.suppliers[0].salon.foto.startsWith('/media/'), 'profielfoto is een /media-URL');
  assert.ok(!db.data.snaps[0].foto.startsWith('data:'), 'snap-foto is geen base64 meer');
  assert.equal(db.data.stories[0].foto, SVG, 'svg-placeholder blijft ongemoeid');
});

test('integratie: een pagina-foto wordt als /media-URL bewaard en over HTTP geserveerd', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-media-e2e-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, DEMO_SUPPLIER: 'KIKUNOI' } });
  const base = srv.base;
  try {
    const post = (pad, body, token) => {
      const h = { 'Content-Type': 'application/json' };
      if (token) h.Authorization = 'Bearer ' + token;
      return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
        .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
    };
    const brand = (await post('/api/supplier/login', { username: 'rahul', password: 'Imran' })).body.token;
    const u = Date.now().toString().slice(-8);
    const lid = (await post('/api/auth/register', { name: 'Media Lid', email: 'm' + u + '@x.nl',
      phone: '06' + u, password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' })).body.token;

    const add = await post('/api/supplier/photo/add', { image: PNG }, brand);
    assert.equal(add.status, 200, 'de foto is geplaatst');

    // het lid ziet de partnerpagina; de foto is een /media-URL, geen base64
    const prof = await post('/api/salon/profiel', { code: 'KIKUNOI' }, lid);
    const foto = (prof.body.partner.photos || []).find(p => typeof p === 'string' && p.startsWith('/media/'));
    assert.ok(foto, 'de pagina-foto staat als /media-URL in de partnerdata (geen base64)');
    assert.ok(!(prof.body.partner.photos || []).some(p => String(p).startsWith('data:image')), 'geen enkele base64-foto meer in de data');

    // en de /media-route serveert de echte afbeelding uit
    const r = await fetch(base + foto);
    assert.equal(r.status, 200, 'de /media-route geeft de foto');
    assert.equal(r.headers.get('content-type'), 'image/png', 'met het juiste type');
    const buf = Buffer.from(await r.arrayBuffer());
    assert.ok(buf.length > 0, 'er komen echte bytes terug');
  } finally {
    stop(srv && srv.child);
  }
});
