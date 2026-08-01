/* ============================================================================
   DE LAATSTE TWEE ENDPOINTS DIE NOOIT WERDEN AANGERAAKT.

   Het routejournaal (server/routelog.js, uitgelezen door scripts/dekking.js)
   zegt precies welke routes tijdens de suite echt zijn aangeroepen. Van de 2530
   routes op de kaart waren er na de doorlichting nog twee die geen enkele keer
   werden geraakt:

     POST /api/techniek/alarm/proef
     POST /api/office/papieren/documenten

   DE EERSTE IS DE PIJNLIJKE. Dat is de knop waarmee je bewijst dat je EXTERNE
   ALARMERING werkt: hij stuurt een echte POST naar ERR_WEBHOOK_URL en wacht op
   het antwoord, zodat je weet of het adres klopt in plaats van het te hopen. De
   go-live-checklist verwijst er met zoveel woorden naar ("beproef hem met de
   zelfproef op het techniekbord"). Uitgerekend die knop was zelf onbeproefd --
   de meter die je vertelt of je meters werken.

   Daarom staat er hier een ECHTE ontvanger tegenover: een klein HTTP-servertje
   dat het bericht opvangt. Een toets die alleen op status 200 kijkt zou groen
   blijven op een zelfproef die niets verstuurt, en dat is precies het soort
   dekking dat taak 34 heeft opgeruimd.

   Draai los: node --experimental-sqlite --test test/laatste-twee-endpoints.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const http = require('http');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-laatste2-'));
const OWNER = 'roellie.i@gmail.com';
let srv, base, tech, ontvanger, ontvangen = [];

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

test.before(async () => {
  /* De ontvanger van de alarmweg: hij vangt op wat de zelfproef verstuurt, zodat
     we kunnen kijken of er echt iets uitging en wat erin stond. */
  ontvanger = http.createServer((req, res) => {
    let ruw = '';
    req.on('data', c => { ruw += c; });
    req.on('end', () => {
      try { ontvangen.push(JSON.parse(ruw)); } catch (e) { ontvangen.push({ onleesbaar: ruw.slice(0, 200) }); }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{"ok":true}');
    });
  });
  await new Promise(r => ontvanger.listen(0, '127.0.0.1', r));
  const webhook = 'http://127.0.0.1:' + ontvanger.address().port + '/alarm';

  /* ERR_WEBHOOK_INTERN=1 is nodig en het is GEEN toetstruc. De foutmelder
     weigert standaard een webhook naar een prive- of metadata-adres (SSRF: een
     webhook die je naar 127.0.0.1 of naar het metadata-endpoint van je cloud
     laat wijzen, is een poortscanner met jouw rechten). Die vlag staat een
     bewuste INTERNE collector toe en blokkeert dan nog steeds het
     metadata/link-local-adres -- een echte productiestand, en de enige waarin
     een ontvanger op de eigen machine te bereiken is. Toets 6 hieronder pint de
     grendel vast die dit nodig maakt. */
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, ERR_WEBHOOK_URL: webhook, ERR_WEBHOOK_INTERN: '1' } });
  base = srv.base;
  const li = await api('/api/techniek/inloggen', { login: OWNER, wachtwoord: 'Imran' });
  tech = li.body.token;
  assert.ok(tech, 'de eigenaar komt op het techniekbord: ' + JSON.stringify(li.body).slice(0, 140));
});
test.after(() => {
  stop(srv && srv.child);
  try { ontvanger.close(); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. de zelfproef stuurt ECHT een bericht naar de alarmweg en wacht op het antwoord', async () => {
  ontvangen = [];
  const r = await api('/api/techniek/alarm/proef', {}, tech);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
  assert.equal(r.body.ok, true, 'de proef slaagt tegen een ontvanger die 200 teruggeeft');

  /* De kern van deze toets. Zonder dit zou hij groen blijven op een zelfproef
     die vrolijk ok:true zegt en niets verstuurt -- en dan bewijst de knop die
     je alarmering moet bewijzen, niets. */
  assert.equal(ontvangen.length, 1, 'er is precies een bericht bij de ontvanger aangekomen');
  const bericht = ontvangen[0];
  assert.match(JSON.stringify(bericht), /[Zz]elfproef/, 'het bericht zegt dat het een zelfproef is');
  assert.match(JSON.stringify(bericht), /GEEN storing/, 'en dus uitdrukkelijk GEEN storing, zodat niemand schrikt');
  assert.ok(bericht.context && bericht.context.door, 'met wie hem indrukte erbij, voor het spoor');

  // en de stand van de melder is meteen bij te werken zichtbaar
  assert.ok(r.body.stand && r.body.stand.actief === true, 'de teruggegeven stand zegt dat de alarmweg aan staat');
});

/* De tegenproef op de poort. Deze knop stuurt verkeer naar buiten en verklapt
   het webhook-adres, en hoort daarom alleen bij de eigenaar te liggen -- niet
   bij iedereen met toegang tot het techniekbord. */
test('2. zonder techniek-inlog komt niemand bij de zelfproef', async () => {
  ontvangen = [];
  const zonder = await api('/api/techniek/alarm/proef', {}, null);
  assert.ok([401, 403].includes(zonder.status), 'geweigerd: ' + zonder.status);
  const nep = await api('/api/techniek/alarm/proef', {}, 'verzonnen-token');
  assert.ok([401, 403].includes(nep.status), 'een verzonnen token ook: ' + nep.status);
  assert.equal(ontvangen.length, 0, 'en er is niets naar buiten gegaan');
});

/* Zonder ingestelde webhook hoort de proef EERLIJK nee te zeggen in plaats van
   te doen alsof. Dat is dezelfde regel als overal: stilvallen is geen uitkomst. */
test('3. zonder ERR_WEBHOOK_URL zegt de proef eerlijk dat er geen alarmweg is', async () => {
  const TMP2 = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-laatste2b-'));
  const s2 = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP2, ERR_WEBHOOK_URL: '' } });
  try {
    const li = await fetch(s2.base + '/api/techniek/inloggen', { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login: OWNER, wachtwoord: 'Imran' }) })
      .then(r => r.json());
    const r = await fetch(s2.base + '/api/techniek/alarm/proef', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + li.token }, body: '{}' })
      .then(async x => ({ status: x.status, body: await x.json().catch(() => ({})) }));
    assert.equal(r.status, 200, 'de knop werkt wel, hij is alleen eerlijk: ' + JSON.stringify(r.body).slice(0, 160));
    assert.equal(r.body.ok, false, 'niet ok, want er is geen alarmweg om te beproeven');
    assert.match(String(r.body.reden || ''), /ERR_WEBHOOK_URL/, 'en hij noemt de variabele die ontbreekt');
  } finally {
    stop(s2 && s2.child);
    try { fs.rmSync(TMP2, { recursive: true, force: true }); } catch (e) {}
  }
});

/* Het tweede endpoint: welke papieren-documenten er zijn, zodat het scherm die
   lijst niet zelf hoeft te kennen.

   DEZELFDE DEUR HANGT OP TWEE VOORVOEGSELS, en daar ging ik eerst de mist in.
   server/routes/papieren-deur.js wordt twee keer gemonteerd: op /api/techniek
   (techAuth + eigenaarAlleen) en op /api/office (boardroomAuth). Het journaal
   wees /api/techniek/papieren/documenten aan als nooit geraakt; ik las het te
   snel en toetste de office-variant, die allang gedekt was. Het gat bleef dus
   staan -- en werd bij de volgende meting gewoon opnieuw gemeld. Precies waar
   een exacte teller voor is: een afgerond percentage had dit weggemoffeld.

   Allebei staan ze er nu, want het zijn twee verschillende poorten voor
   hetzelfde antwoord. Dat ze zich hetzelfde horen te gedragen is de bewering. */
const PAPIERDEUREN = ['/api/techniek/papieren/documenten', '/api/office/papieren/documenten'];

test('4. de documentenlijst komt uit de server, op allebei de deuren gelijk', async () => {
  const lijsten = [];
  for (const pad of PAPIERDEUREN) {
    const r = await api(pad, {}, tech);
    assert.equal(r.status, 200, pad + ': ' + JSON.stringify(r.body).slice(0, 160));
    assert.ok(Array.isArray(r.body.documenten) && r.body.documenten.length > 0, pad + ': er staat een lijst');
    for (const d of r.body.documenten) {
      assert.ok(d.naam, 'elk document heeft een naam');
      assert.ok(d.waarvoor, 'en zegt waarvoor het dient (' + d.naam + ')');
    }
    lijsten.push(r.body.documenten.map(d => d.naam).sort());
  }
  assert.deepEqual(lijsten[0], lijsten[1],
    'dezelfde deur op twee voorvoegsels geeft dezelfde lijst; lopen ze uiteen, dan is er een kopie ontstaan');
});

/* De tegenproef, en die is hier de hele reden dat het endpoint bestaat: het
   papierwerk van de zaak (KvK, adres, de jurist) is niets voor personeel. */
test('5. die lijst is niet voor iedereen', async () => {
  const u = Date.now().toString(36);
  const lid = await api('/api/auth/register', { name: 'Gewoon Lid', email: 'pap' + u + '@x.nl',
    phone: '0612345678', password: 'geheim12345', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  assert.ok(lid.body.token, 'het proeflid staat er');
  for (const pad of PAPIERDEUREN) {
    const zonder = await api(pad, {}, null);
    assert.ok([401, 403].includes(zonder.status), pad + ' zonder inlog dicht: ' + zonder.status);
    const gewoon = await api(pad, {}, lid.body.token);
    assert.ok([401, 403].includes(gewoon.status), pad + ' met een gewoon lid dicht: ' + gewoon.status);
  }
});

/* DE GRENDEL DIE IK BIJ HET SCHRIJVEN VAN TOETS 1 TEGENKWAM, en die zelf geen
   toets had. Een fout-webhook is een adres dat de server op commando aanroept.
   Wijst dat naar 127.0.0.1 of naar het metadata-endpoint van een cloud, dan heb
   je een poortscanner met de rechten van je eigen server. De foutmelder weigert
   zo'n adres bij het bouwen, en dat is precies de goede plek: niet per bericht
   afwegen, maar de weg helemaal niet openzetten.

   Zonder deze toets zou die grendel weg te halen zijn zonder dat er iets rood
   werd -- en dan zou toets 1 hem juist DEKKEN, want die zet de uitzondering aan.
   Een uitzondering toetsen zonder de regel te toetsen is hoe een grendel
   ongemerkt verdwijnt. */
test('6. een fout-webhook naar een prive-adres wordt geweigerd zonder de bewuste vlag', async () => {
  const TMP3 = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-laatste2c-'));
  let geraakt = 0;
  const spion = http.createServer((req, res) => { geraakt++; res.writeHead(200); res.end('{}'); });
  await new Promise(r => spion.listen(0, '127.0.0.1', r));
  const s3 = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP3,
    ERR_WEBHOOK_URL: 'http://127.0.0.1:' + spion.address().port + '/alarm' } });   // GEEN ERR_WEBHOOK_INTERN
  try {
    const li = await fetch(s3.base + '/api/techniek/inloggen', { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login: OWNER, wachtwoord: 'Imran' }) })
      .then(r => r.json());
    const r = await fetch(s3.base + '/api/techniek/alarm/proef', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + li.token }, body: '{}' })
      .then(async x => x.json());
    assert.equal(r.ok, false, 'de proef slaagt niet, want het adres is geweigerd');
    assert.equal(geraakt, 0, 'en er is geen enkel verzoek naar het prive-adres gegaan');
    assert.equal(r.stand && r.stand.actief, false, 'de alarmweg staat uit in plaats van half aan');
  } finally {
    stop(s3 && s3.child);
    try { spion.close(); } catch (e) {}
    try { fs.rmSync(TMP3, { recursive: true, force: true }); } catch (e) {}
  }
});
