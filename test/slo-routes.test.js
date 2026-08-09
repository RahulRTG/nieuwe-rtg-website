/* De routes van de servicedoelen en de sonde, tegen een echt draaiende server.

   WAAROM DIT NAAST test/slo.test.js STAAT. Daar staat de rekenkant met een
   nagemaakte meting; hier staat de bedrading. Twee dingen zijn alleen hier te
   zien: dat de sonde echt over HTTP loopt (hij klopt bij deze server aan, en
   die reizen komen uit SLO.json en niet uit de toets), en dat de meldingsingang
   achter dezelfde poort zit als /api/metrics -- een 404 en geen 403, want een
   403 bevestigt dat het endpoint bestaat.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - meetpoort vervangen door een doorlaat (next() zonder controle)
     -> OVERLEEFDE eerst: elke toets liep over de loopback en werd sowieso
        doorgelaten, dus de poort werd alleen aan de goede kant beproefd. Pas
        met een tweede server MET RTG_METRICS_TOKEN zakt "met RTG_METRICS_TOKEN
        gezet weigert de meetpoort een melding zonder sleutel" (RAAK)
   - in de sonde `verwacht.includes(status)` vervangen door `status > 0`
     -> OVERLEEFDE eerst: tegen een gezonde server slaagt elke reis toch wel.
        Het geval dat hem vangt staat in test/slo.test.js ("een onverwachte
        status is een storing, ook als de server antwoordt") (RAAK)

   Die twee overlevers zijn precies waar regel 2 voor bestaat. Twee toetsen die
   groen stonden en niets vaststelden, zagen er tot de mutatie identiek uit aan
   twee die wel iets vaststellen.

   Draai: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-slo-'));
const CODE = 'KANTOOR-SLO-1';
let srv, base, office;

const api = (pad, body) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + office },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: CODE } });
  base = srv.base;
  const l = await (await fetch(base + '/api/office/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: CODE })
  })).json();
  office = l.token;
  assert.ok(office, 'het kantoor logt in');
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('de servicedoelen komen uit SLO.json en zeggen eerlijk dat er te weinig is gemeten', async () => {
  const d = await api('command/slo');
  assert.equal(d.status, 200);
  const norm = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'SLO.json'), 'utf8'));
  assert.equal(d.body.doelen.length, norm.doelen.length, 'evenveel doelen als in SLO.json');
  assert.equal(d.body.norm.bestand, 'SLO.json');

  /* Deze server draait pas seconden en heeft een handvol verzoeken gezien. Elk
     doel MOET daarom op 'onvoldoende gemeten' staan. Zou hier 'gehaald' staan,
     dan meldt dit scherm na elke herstart een perfecte maand. */
  for (const doel of d.body.doelen) {
    assert.equal(doel.oordeel, 'onvoldoende gemeten', doel.id + ' hoort onvoldoende gemeten te zijn');
    assert.equal(doel.genoeg, false);
  }
  assert.equal(d.body.tel.onvoldoende, d.body.doelen.length);
  assert.equal(d.body.uitrol.mag, true, 'onbeoordeelde doelen houden de uitrol niet tegen');

  const dicht = await fetch(base + '/api/command/slo', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(dicht.status, 401, 'zonder kantoorsessie blijft de deur dicht');
});

test('de sonde loopt echt over HTTP en keurt op de verwachte status', async () => {
  const r = await api('command/sonde/draai');
  assert.equal(r.status, 200);
  assert.equal(r.body.van, 'binnen', 'vanaf de server zelf is de kant binnen');
  assert.match(r.body.let, /niet dat een klant erbij kan/, 'en het antwoord zegt wat dit niet bewijst');

  const gezond = r.body.monsters.find(m => m.reis === 'gezond');
  assert.ok(gezond, 'de gezondheidsreis is gelopen');
  assert.equal(gezond.status, 200);
  assert.equal(gezond.gelukt, true);

  /* De inlogreis logt met opzet verkeerd in. Slaagt hij met een 200, dan is dat
     een bevinding en geen succes -- vandaar dat de verwachte statussen alleen
     afwijzingen zijn. */
  const inlog = r.body.monsters.find(m => m.reis === 'inlogpad');
  assert.ok(inlog.status >= 400, 'de sonde komt niet binnen: ' + inlog.status);
  assert.equal(inlog.gelukt, true, 'en juist die afwijzing is de geslaagde uitslag');

  const st = await api('command/sonde', { uren: 24 });
  assert.equal(st.status, 200);
  assert.ok(st.body.binnen.pogingen >= r.body.monsters.length, 'de monsters zijn bewaard');
  assert.equal(st.body.buiten.pogingen, 0);
  assert.match(st.body.let, /van buitenaf/, 'zonder externe meting staat de waarschuwing er');
});

/* MET EEN TOKEN GEZET IS NABIJHEID NIET GENOEG MEER, en dat is de enige stand
   waarin deze poort echt iets weigert. De toets hieronder stond er eerst zonder
   dit geval, en toen overleefde een mutatie die de poort volledig opende: alles
   liep immers over de loopback en werd sowieso doorgelaten. Een toets die de
   poort alleen aan de goede kant beproeft, toetst de poort niet. */
test('met RTG_METRICS_TOKEN gezet weigert de meetpoort een melding zonder sleutel', async () => {
  const TMP2 = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-slo2-'));
  const TOKEN = 'sonde-token-abcdefghijklmnop';
  const s2 = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP2, OFFICE_CODE: CODE,
    RTG_METRICS_TOKEN: TOKEN } });
  const melding = (kop) => fetch(s2.base + '/api/sonde/melding', {
    method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, kop || {}),
    body: JSON.stringify({ monsters: [{ reis: 'gezond', status: 200, ms: 9, gelukt: true }] })
  });
  try {
    /* 404 en niet 403: een 403 bevestigt dat het endpoint bestaat. */
    assert.equal((await melding()).status, 404, 'zonder sleutel gaat de deur dicht, ook van dichtbij');
    assert.equal((await melding({ authorization: 'Bearer ' + TOKEN + 'x' })).status, 404, 'een bijna-goed token telt niet');
    assert.equal((await melding({ authorization: 'Bearer ' + TOKEN })).status, 200, 'met de sleutel wel');
    /* En dezelfde poort staat voor /api/metrics; dat is de hele reden dat hij
       op één plek staat. */
    assert.equal((await fetch(s2.base + '/api/metrics')).status, 404);
    assert.equal((await fetch(s2.base + '/api/metrics', { headers: { authorization: 'Bearer ' + TOKEN } })).status, 200);
  } finally {
    stop(s2 && s2.child);
    try { fs.rmSync(TMP2, { recursive: true, force: true }); } catch (e) {}
  }
});

test('de meldingsingang zit achter de meetpoort en telt als buiten', async () => {
  /* Deze toets draait op de loopback zonder RTG_METRICS_TOKEN, dus de poort
     laat hem door op nabijheid. Dat is precies de stand die server/meetpoort.js
     beschrijft, en de reden dat er in productie een token hoort te staan. */
  const goed = await fetch(base + '/api/sonde/melding', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ monsters: [{ reis: 'gezond', status: 200, ms: 9, gelukt: true }] })
  });
  assert.equal(goed.status, 200);
  assert.equal((await goed.json()).aangenomen, 1);

  const st = await api('command/sonde', { uren: 24 });
  assert.equal(st.body.buiten.pogingen, 1, 'de melding telt aan de buitenkant');
  assert.equal(st.body.let, null, 'en dan is er niets meer te waarschuwen');

  /* Een verzonnen reis komt er niet in: anders vult iemand het strenge cijfer
     met metingen die nergens over gaan. */
  const rommel = await fetch(base + '/api/sonde/melding', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ monsters: [{ reis: 'verzonnen', status: 200, gelukt: true }] })
  });
  assert.equal(rommel.status, 400);
});
