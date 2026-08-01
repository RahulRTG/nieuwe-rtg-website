/* ============================================================================
   DE DEUR VOOR /api/metrics, van drie kanten.

   WAAROM DIT BESTAND ER MOEST KOMEN. De metrics-deur is vanochtend nog
   dichtgezet (taak 28: achter een poortwachter komt ELK verzoek via de
   loopback binnen, dus "van dichtbij" bewees daar niets meer en stond de deur
   in precies de productie-opstelling wagenwijd open). Die reparatie had
   nul route-toetsen. De enige plek die /api/metrics uberhaupt aanraakte was
   test/techniek-sso-scim.test.js, en die deed:

       assert.ok([200, 404].includes(m.status), '... 200 (intern) of 404 (geweigerd)')

   Dat laat allebei de uitkomsten toe. Een deur die open hoort te staan en een
   deur die dicht hoort te zitten geven daar hetzelfde groene vinkje, en het
   lichaam van de toets zat achter `if (m.status === 200)` -- dus bij een dichte
   deur werd er helemaal niets meer nagekeken. De reparatie van vanochtend kon
   dus volledig worden teruggedraaid zonder dat er ook maar iets rood werd. Dat
   is LAT.md regel 9: een toets die niet kan zakken is slechter dan geen toets,
   want hij koopt vertrouwen dat er niet is.

   DRIE STANDEN, DRIE SERVERS. De poort in server/routes/meting.js kent er
   precies drie, en ze zijn alleen uit elkaar te houden door ze allemaal te
   draaien:

     1. KAAL. Geen token, geen poortwachter. Dan telt nabijheid: een verzoek van
        127.0.0.1 mag meten. Dit is de stand waarin Prometheus naast de app
        draait.
     2. ACHTER EEN POORTWACHTER (RTG_CLUSTER_KEY of RTG_DOMAINS). Nabijheid
        bewijst niets meer, want alles komt via de loopback. Zonder token gaat de
        deur dicht.
     3. MET RTG_METRICS_TOKEN. Dan MOET het token mee, waar je ook vandaan belt.

   Draai los: node --experimental-sqlite --test test/metingpoort.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TOKEN = 'meet-token-dat-lang-genoeg-is';
const servers = [];

async function server(naam, extra) {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-meet-' + naam + '-'));
  const srv = await startServer({ env: Object.assign({ SMTP_URL: '', RTG_DATA_DIR: TMP }, extra) });
  servers.push({ srv, TMP });
  return srv.base;
}

/* GET, want /api/metrics is een GET. Met een eigen kopjes-argument, omdat de
   halve toets hieronder juist over kopjes gaat. */
function haal(base, pad, kopjes) {
  return fetch(base + pad, { headers: kopjes || {} })
    .then(async r => ({ status: r.status, tekst: await r.text().catch(() => '') }));
}

let kaal, achterPoort, metToken;

test.before(async () => {
  /* Alle drie tegelijk: het zijn drie servers en ze wachten vooral op elkaars
     opstarttijd. */
  [kaal, achterPoort, metToken] = await Promise.all([
    server('kaal', {}),
    server('poort', { RTG_CLUSTER_KEY: 'een-sleutel-van-ruim-zestien-tekens' }),
    server('token', { RTG_METRICS_TOKEN: TOKEN })
  ]);
});
test.after(() => {
  for (const s of servers) {
    stop(s.srv && s.srv.child);
    try { fs.rmSync(s.TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

test('1. kaal: een verzoek van dichtbij mag meten, en krijgt echte Prometheus-tekst', async () => {
  const r = await haal(kaal, '/api/metrics');
  assert.equal(r.status, 200, 'zonder poortwachter en zonder token telt nabijheid: ' + r.status);
  assert.match(r.tekst, /rtg_verzoeken_totaal/, 'en er komt echt een meting uit, geen leeg antwoord');
});

/* DE TOETS DIE DE REPARATIE VAN TAAK 28 VASTPINT. Draai de voorwaarde in
   meting.js terug en deze zakt, en alleen deze. */
test('2. achter een poortwachter is nabijheid geen bewijs meer: de deur gaat dicht', async () => {
  const r = await haal(achterPoort, '/api/metrics');
  assert.equal(r.status, 404,
    'met RTG_CLUSTER_KEY gezet komt alles via 127.0.0.1 binnen, dus mag het socketadres niets meer openen (kreeg ' + r.status + ')');
  assert.doesNotMatch(r.tekst, /rtg_verzoeken_totaal/, 'en er lekt geen meting mee in het antwoord');
});

/* 404 en niet 403: een 403 bevestigt dat het eindpunt bestaat. Dat staat zo in
   de code en het is de reden dat we hier op de EXACTE status toetsen en niet op
   "iets in de 4xx". */
test('3. de weigering verklapt niet dat het eindpunt bestaat', async () => {
  const dicht = await haal(achterPoort, '/api/metrics');
  const bestaatniet = await haal(achterPoort, '/api/metrics-bestaat-niet');
  assert.equal(dicht.status, bestaatniet.status,
    'een dichte meting is van buiten niet te onderscheiden van een pad dat niet bestaat');
});

test('4. met een token telt alleen het token, en het moet precies kloppen', async () => {
  assert.equal((await haal(metToken, '/api/metrics')).status, 404, 'zonder token: dicht, ook van dichtbij');
  assert.equal((await haal(metToken, '/api/metrics', { Authorization: 'Bearer ' + TOKEN })).status, 200,
    'met het juiste token: open');

  /* Een goed begin is niet goed genoeg. Deze twee zijn er om de vergelijking
     zelf te bewaken: `===` stopt bij het eerste verschillende teken, en daarom
     staat er veiligGelijk(). Een prefix en een te lange variant zijn de twee
     vormen die een rateltest raad-voor-raad zou proberen. */
  assert.equal((await haal(metToken, '/api/metrics', { Authorization: 'Bearer ' + TOKEN.slice(0, -1) })).status, 404,
    'een token dat op een teken na klopt is fout');
  assert.equal((await haal(metToken, '/api/metrics', { Authorization: 'Bearer ' + TOKEN + 'x' })).status, 404,
    'en een token met iets erachter ook');
  assert.equal((await haal(metToken, '/api/metrics', { Authorization: TOKEN })).status, 404,
    'zonder het Bearer-woord telt het niet mee');
});

/* EEN KOP IS GEEN AFZENDER. Wie X-Forwarded-For zet, verklaart zichzelf tot
   intern. De poort kijkt daarom naar het SOCKETADRES en niet naar req.ip. De
   oude toets accepteerde hier [200, 404] en kon dus niet zien of de kop wel of
   niet werd geloofd; hier telt alleen dat het antwoord NIET verandert. */
test('5. een verzonnen X-Forwarded-For verandert het oordeel niet, in geen van beide standen', async () => {
  for (const [naam, base] of [['kaal', kaal], ['achter een poortwachter', achterPoort]]) {
    const zonder = await haal(base, '/api/metrics');
    const met = await haal(base, '/api/metrics', { 'X-Forwarded-For': '10.0.0.1' });
    assert.equal(met.status, zonder.status,
      'in de stand "' + naam + '" beslist het socketadres, niet de kop (' + zonder.status + ' -> ' + met.status + ')');
  }
});

/* De korte JSON-versie hangt aan dezelfde poort. Dat staat er met zoveel
   woorden bij ("zodat er niet per ongeluk een tweede, lossere deur ontstaat"),
   en een belofte in tekst is een belofte in code. */
test('6. /api/metrics/kort deelt exact dezelfde deur', async () => {
  for (const [naam, base, verwacht] of [['kaal', kaal, 200], ['achter een poortwachter', achterPoort, 404]]) {
    const r = await haal(base, '/api/metrics/kort');
    assert.equal(r.status, verwacht, 'de korte versie in de stand "' + naam + '": ' + r.status);
  }
  assert.equal((await haal(metToken, '/api/metrics/kort')).status, 404, 'met token gezet: zonder token dicht');
  assert.equal((await haal(metToken, '/api/metrics/kort', { Authorization: 'Bearer ' + TOKEN })).status, 200,
    'en met het juiste token open');
});

/* Er hoort niets persoonsgebonden in een meting te staan, en geen ingevulde
   ids in de labels: dan krijgt elke gebruiker een eigen tijdreeks en legt de
   monitoring zichzelf om. Dit stond in techniek-sso-scim.test.js achter een
   `if (status === 200)`, dus het werd overgeslagen zodra de deur dichtzat. */
test('7. de meting draagt geen namen en geen ingevulde ids', async () => {
  const r = await haal(kaal, '/api/metrics');
  assert.equal(r.status, 200);
  assert.equal(/roellie|@x\.nl|Gewoon Lid/i.test(r.tekst), false, 'geen namen of adressen in de meting');
  assert.equal(/route="[^"]*\/(user-\d+|NL\d\d[A-Z]{4})/.test(r.tekst), false,
    'de labels dragen het routePATROON, geen ingevulde ids');
});
