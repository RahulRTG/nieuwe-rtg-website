/* ============================================================================
   DEZELFDE INHOUD, TWEE WEGEN NAAR BINNEN -- EN MAAR EEN POORT.

   De Ontsmetter hangt als scan-net over elke verzoek-body: alles wat eruitziet
   als een complete data-URL ("data:<mime>;base64,<...>") wordt gescand, waar in
   de body het ook staat. Zo zijn alle upload-plekken in een klap gedekt zonder
   elke route apart aan te raken. Prima ontwerp, met een gat dat er logisch uit
   volgt: een bestand dat NIET als data-URL binnenkomt, wordt niet gezien.

   Zo'n weg bestaat, en het is geen exotische truc. RTG Bestanden stuurt alles
   boven de 8 MB in stukken: kale base64-tekst, zonder kop. Het net ziet daar
   niets in. Het geheel ontstaat pas op de server, in een variabele, waar geen
   verzoek-body meer omheen zit.

   Deze test stuurt hetzelfde besmette bestand langs allebei de wegen en eist
   hetzelfde antwoord. De EICAR-teststring is de industriestandaard om een
   scanner te toetsen: geen echte malware, wel door elke scanner herkend.

   En de tweede helft: wat je in de kluis stopt mag je terugkrijgen, maar niet
   met een etiket waar een browser zelf iets mee gaat doen.

   Draai los: node --experimental-sqlite --test test/upload-poort.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-uppoort-'));
let srv, base, lid;

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const u = Date.now().toString().slice(-8);
  lid = (await api('/api/auth/register', { name: 'Uploadlid', email: 'up' + u + '@x.nl', phone: '06' + u,
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })).body.token;
  assert.ok(lid, 'het lid is geregistreerd');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. besmet in een keer: het scan-net weigert hem', async () => {
  const dataUrl = 'data:application/octet-stream;base64,' + Buffer.from(EICAR).toString('base64');
  const r = await api('/api/bestanden/upload', { naam: 'boel.txt', dataUrl }, lid);
  assert.equal(r.status, 422, 'de gewone weg weigert besmette inhoud: ' + JSON.stringify(r.body).slice(0, 140));
});

test('2. hetzelfde bestand in stukken: precies zo geweigerd', async () => {
  const b64 = Buffer.from(EICAR).toString('base64');
  const start = await api('/api/bestanden/upstart', { naam: 'boel.txt', mime: 'application/octet-stream' }, lid);
  assert.equal(start.status, 200, 'de gestukte upload start: ' + JSON.stringify(start.body).slice(0, 140));

  /* De stukken zelf komen er gewoon door, en dat hoort ook: een kaal stuk
     base64 IS geen bestand en valt niet te beoordelen. Het oordeel hoort op het
     moment dat het geheel er is. */
  const deel = await api('/api/bestanden/updeel', { uploadId: start.body.uploadId, stuk: b64 }, lid);
  assert.equal(deel.status, 200, 'een los stuk is nog niets om over te oordelen');

  const klaar = await api('/api/bestanden/upklaar', { uploadId: start.body.uploadId }, lid);
  assert.equal(klaar.status, 422,
    'de gestukte weg moet net zo weigeren als de gewone -- anders is de Ontsmetter een deurmat naast een open raam (kreeg ' +
    klaar.status + ': ' + JSON.stringify(klaar.body).slice(0, 140) + ')');

  // en er staat niets in de kluis
  const mijn = await api('/api/bestanden/mijn', {}, lid);
  assert.equal((mijn.body.items || []).filter(x => x.naam === 'boel.txt').length, 0,
    'het geweigerde bestand is ook echt niet opgeslagen');
});

test('3. schoon in stukken komt gewoon binnen', async () => {
  /* Zonder deze test bewijst de vorige niets: een weigering die ALLES weigert
     is geen scanner maar een muur. */
  const b64 = Buffer.from('gewoon een net tekstbestand van het lid').toString('base64');
  const start = await api('/api/bestanden/upstart', { naam: 'net.txt', mime: 'text/plain' }, lid);
  await api('/api/bestanden/updeel', { uploadId: start.body.uploadId, stuk: b64 }, lid);
  const klaar = await api('/api/bestanden/upklaar', { uploadId: start.body.uploadId }, lid);
  assert.equal(klaar.status, 200, 'een schoon bestand komt er gewoon in: ' + JSON.stringify(klaar.body).slice(0, 140));
  assert.ok(klaar.body.id, 'en krijgt een plek in de kluis');
});

test('4. wat de kluis in mag, komt er niet als uitvoerbare pagina uit', async () => {
  /* De kluis neemt elk MIME-type aan, en dat hoort ook -- het is de kluis van
     het lid, geen fotoalbum. Maar hij is DEELBAAR, en de teruggave is een
     data-URL waarin het MIME-type letterlijk uit het verzoek van de uploader
     komt. data:text/html dat een ander opent, draait script. Het bestand blijft
     wat het was; alleen het etiket op de terugweg wordt onschadelijk. */
  /* Bewust ZONDER script erin: die zou de Ontsmetter hierboven al tegenhouden,
     en dan bewijst deze test alleen dat test 1 werkt. Het gaat hier om het
     ETIKET -- een volstrekt onschuldige pagina die als text/html terugkomt is
     nog steeds een pagina die een browser gaat uitvoeren. */
  const html = '<h1>hallo</h1><p>een nette pagina van het lid</p>';
  const up = await api('/api/bestanden/upload', {
    naam: 'pagina.html', dataUrl: 'data:text/html;base64,' + Buffer.from(html).toString('base64') }, lid);
  assert.equal(up.status, 200, 'opslaan mag gewoon: ' + JSON.stringify(up.body).slice(0, 140));

  const terug = await api('/api/bestanden/haal', { id: up.body.id }, lid);
  assert.equal(terug.status, 200);
  assert.equal(terug.body.mime, 'application/octet-stream', 'niet meer als text/html');
  assert.ok(terug.body.dataUrl.startsWith('data:application/octet-stream;base64,'),
    'ook niet in de data-URL zelf: ' + terug.body.dataUrl.slice(0, 60));

  // en de bytes zijn onaangeroerd: dit is een etiket-wissel, geen inhoudswissel
  const bytes = Buffer.from(terug.body.dataUrl.split(',')[1], 'base64').toString();
  assert.equal(bytes, html, 'het bestand zelf is precies wat het lid erin stopte');
});
