/* De mediastore: foto's van de Salon en snaps staan als losse bestanden (schijf of
   S3), niet als base64 in db.data. Zo groeit het werkgeheugen en elke db-snapshot
   niet mee met de foto's. Dekt de module (bewaar/lees/verwijder/serveer/migreer),
   de S3-ondertekening (AWS-voorbeeldvector), een echte S3-ronde tegen een lokale
   nep-S3, en de echte weg over HTTP. Draai: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { startServer, stop } = require('./helper');
const { maakMedia, sigV4 } = require('../server/media');

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const SVG = 'data:image/svg+xml;base64,' + Buffer.from('<svg/>').toString('base64');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-media-'));

test('module (schijf): bewaar schrijft een bestand en houdt db-vrij van base64', async () => {
  const media = maakMedia({ dir: tmp(), env: {} });
  assert.equal(media.backendNaam, 'disk');
  const naam = await media.bewaar(PNG, 900 * 1024);
  assert.ok(naam && /^[0-9a-f]{32}\.png$/.test(naam), 'bewaar geeft een bestandsnaam terug');
  assert.ok(fs.existsSync(media.pad(naam)), 'het bestand staat op schijf');
  assert.equal(await media.leesDataUrl(naam), PNG, 'leesDataUrl geeft exact dezelfde foto terug');
  assert.ok((await media.bewaarPubliek(PNG)).startsWith('/media/'), 'bewaarPubliek geeft een /media-URL');
  media.verwijder(naam);
  await new Promise(r => setTimeout(r, 30));
  assert.ok(!fs.existsSync(media.pad(naam)), 'na verwijder is het bestand weg');
});

test('module: alleen echte afbeeldingen, te groot geweigerd, oude data-URL blijft werken', async () => {
  const media = maakMedia({ dir: tmp(), env: {} });
  assert.equal(await media.bewaar('data:text/plain;base64,aGoi'), null, 'geen afbeelding: geweigerd');
  assert.equal(await media.bewaar(SVG), null, 'svg (placeholder) hoort niet in de store');
  assert.equal(await media.bewaar(PNG, 4), null, 'te groot: geweigerd');
  assert.equal(await media.leesDataUrl(PNG), PNG, 'oude inline foto blijft werken (terugval)');
});

test('module: serveer streamt met het juiste type; migreer verplaatst bestaande base64', async () => {
  const media = maakMedia({ dir: tmp(), env: {} });
  const naam = await media.bewaar(PNG);
  let type = null, code = 200, body = null;
  const res = { headersSent: false, set: (k, v) => { if (k === 'Content-Type') type = v; }, status: c => { code = c; return res; }, end: b => { body = b; } };
  await media.serveer({ params: { naam } }, res);
  assert.equal(type, 'image/png', 'serveer zet het juiste content-type');
  assert.ok(Buffer.isBuffer(body) && body.length > 0, 'serveer geeft de bytes terug');
  await media.serveer({ params: { naam: '../secret' } }, res);
  assert.equal(code, 400, 'geen directory-traversal');

  const db = { data: {
    suppliers: [{ code: 'A', photos: [PNG, PNG], salon: { foto: PNG },
      panden: [{ fotos: [PNG] }], verkoop: { showroom: [{ fotos: [PNG, PNG] }] } }],
    posts: [{ photo: PNG, folder: { fotos: [PNG] } }],
    snaps: [{ foto: PNG }],
    stories: [{ foto: SVG }],
    huurFotos: { R1: { voor: [{ foto: PNG }], na: [] } },
    charterFotos: { C1: { voor: [], na: [{ foto: PNG }] } }
  } };
  const n = await media.migreerDb(db);
  // salon(2+1) + post(1+1) + snap(1) + pand(1) + showroom(2) + huur(1) + charter(1) = 11
  assert.equal(n, 11, 'elf echte foto\'s verplaatst (svg-placeholder niet)');
  assert.ok(db.data.suppliers[0].photos.every(p => p.startsWith('/media/')), 'pagina-foto\'s zijn /media-URLs');
  assert.ok(db.data.suppliers[0].panden[0].fotos[0].startsWith('/media/'), 'vastgoed-foto is een /media-URL');
  assert.ok(db.data.suppliers[0].verkoop.showroom[0].fotos.every(f => f.startsWith('/media/')), 'showroomfoto\'s zijn /media-URLs');
  assert.ok(db.data.huurFotos.R1.voor[0].foto.startsWith('/media/'), 'verhuur-inspectiefoto is een /media-URL');
  assert.ok(db.data.charterFotos.C1.na[0].foto.startsWith('/media/'), 'charter-inspectiefoto is een /media-URL');
  assert.ok(!db.data.snaps[0].foto.startsWith('data:'), 'snap-foto is geen base64 meer');
  assert.equal(db.data.stories[0].foto, SVG, 'svg-placeholder blijft ongemoeid');
});

test('S3-ondertekening klopt met de officiele AWS-voorbeeldvector', () => {
  // AWS SigV4 docs: GET iam ListUsers, 20150830T123600Z.
  const canonicalRequest = [
    'GET', '/', 'Action=ListUsers&Version=2010-05-08',
    'content-type:application/x-www-form-urlencoded; charset=utf-8',
    'host:iam.amazonaws.com',
    'x-amz-date:20150830T123600Z', '',
    'content-type;host;x-amz-date',
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
  ].join('\n');
  const sig = sigV4({
    secret: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
    region: 'us-east-1', service: 'iam', amzDate: '20150830T123600Z', canonicalRequest
  });
  assert.equal(sig, '5d672d79c15b13162d9279b0855cfba6789a8edb4c82c400e06b5924a6f2b5d7', 'handtekening = AWS-referentie');
});

test('S3-backend: put/get/del tegen een lokale nep-S3 (ondertekend, versleuteld)', async () => {
  const store = new Map();
  let zagAuth = null, zagKeyPad = null;
  const srv = http.createServer((req, res) => {
    let chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      zagAuth = req.headers.authorization || zagAuth;
      if (req.method === 'PUT') { store.set(req.url, Buffer.concat(chunks)); zagKeyPad = req.url; res.writeHead(200).end(); }
      else if (req.method === 'GET') { const b = store.get(req.url); if (b) res.writeHead(200).end(b); else res.writeHead(404).end(); }
      else if (req.method === 'HEAD') { res.writeHead(store.has(req.url) ? 200 : 404).end(); }
      else if (req.method === 'DELETE') { store.delete(req.url); res.writeHead(204).end(); }
      else res.writeHead(405).end();
    });
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const port = srv.address().port;
  const dir = tmp();
  try {
    const media = maakMedia({ dir, env: {
      RTG_MEDIA_BACKEND: 's3', RTG_MEDIA_S3_BUCKET: 'testbucket',
      RTG_MEDIA_S3_ENDPOINT: 'http://127.0.0.1:' + port,
      RTG_MEDIA_S3_KEY: 'AKIDEMO', RTG_MEDIA_S3_SECRET: 'secretdemo'
    } });
    assert.equal(media.backendNaam, 's3');
    const naam = await media.bewaar(PNG, 900 * 1024);
    assert.ok(naam, 'bewaar via S3 lukt');
    assert.equal(store.size, 1, 'de nep-S3 kreeg het object');
    assert.ok(/^AWS4-HMAC-SHA256 Credential=AKIDEMO\//.test(zagAuth || ''), 'verzoek is SigV4-ondertekend');
    assert.ok(/\/testbucket\/media\//.test(zagKeyPad || ''), 'object staat onder bucket/media/');
    // teruglezen (uit de warme cache is ook goed) geeft dezelfde foto
    assert.equal(await media.leesDataUrl(naam), PNG, 'teruglezen geeft dezelfde foto');
    // opgeslagen bytes zijn NIET de kale base64 (versleuteld/at-rest of tenminste binair)
    const opgeslagen = [...store.values()][0];
    assert.ok(!opgeslagen.toString('utf8').includes('iVBOR'), 'de opgeslagen bytes zijn niet de kale base64-string');
    // verwijderen bereikt de nep-S3
    media.verwijder(naam);
    await new Promise(r => setTimeout(r, 60));
    assert.equal(store.size, 0, 'na verwijder is het object weg bij de nep-S3');
  } finally {
    srv.close();
  }
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

    const prof = await post('/api/salon/profiel', { code: 'KIKUNOI' }, lid);
    const foto = (prof.body.partner.photos || []).find(p => typeof p === 'string' && p.startsWith('/media/'));
    assert.ok(foto, 'de pagina-foto staat als /media-URL in de partnerdata (geen base64)');
    assert.ok(!(prof.body.partner.photos || []).some(p => String(p).startsWith('data:image')), 'geen enkele base64-foto meer in de data');

    const r = await fetch(base + foto);
    assert.equal(r.status, 200, 'de /media-route geeft de foto');
    assert.equal(r.headers.get('content-type'), 'image/png', 'met het juiste type');
    assert.ok(Buffer.from(await r.arrayBuffer()).length > 0, 'er komen echte bytes terug');
  } finally {
    stop(srv && srv.child);
  }
});
