/* Samen: meekijken en samen doen door het leden-OS. Kamers op code, alles op
   codenaam, live seintjes via de SSE-stroom; gasten doen niet mee en kamers
   verlopen vanzelf. Draai los:
   node --test test/samen.test.js */
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

let srv, base, A, B;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-samen-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const reg = (n) => api(base, '/api/auth/register', { name: 'Samen ' + n, email: 'samen' + n + '@x.nl', phone: '061234567' + n,
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  A = (await reg(1)).body.token;
  B = (await reg(2)).body.token;
});
test.after(() => stop(srv && srv.child));

let code, kamerId;
test('1. een lid start een samen-sessie en een vriend doet mee met de code', async () => {
  const r = await api(base, '/api/samen/maak', {}, A);
  assert.equal(r.status, 200);
  code = r.body.code;
  kamerId = r.body.kamer.id;
  assert.match(code, /^SAMEN\.[A-F0-9]{32}$/, 'een 128-bit eenmalige deelcode');
  assert.equal(r.body.kamer.code, undefined, 'het gewone kamerbeeld bevat geen credential');
  const mee = await api(base, '/api/samen/mee', { code }, B);
  assert.equal(mee.status, 200);
  assert.equal(mee.body.kamer.leden.length, 2, 'twee codenamen in de kamer');
  // nog een keer meedoen is idempotent
  assert.equal((await api(base, '/api/samen/mee', { code }, B)).body.kamer.leden.length, 2);
});

test('2. "kijk hier": een lid deelt waar hij is en de kamer onthoudt het; het SSE-seintje komt live binnen', async () => {
  // B luistert op de stroom; A stuurt de kamer naar de Mall
  const events = [];
  let zagHello = false; let eerste = ''; let reden = '';
  const es = await fetch(base + '/api/stream?token=' + encodeURIComponent(B));
  /* DE VOORWAARDE EERST, en dat is met schade geleerd. /api/stream antwoordt
     401 met een LEGE body, en de rem hieronder 429 met een korte. In beide
     gevallen ziet de lezer meteen `done`, valt de lus eruit en zakte deze toets
     op "B kreeg het kijk-seintje niet" -- over een server die dat seintje nooit
     had hoeven sturen. In CI gebeurde dat binnen 30 ms terwijl de tijdgrens 15
     seconden is; het getal wees de kant op, de melding niet. Een toets hoort te
     zakken op zijn onderwerp, dus staan de voorwaarden er nu apart, met de
     eerste bytes erbij zodat de reden er meteen staat. */
  assert.equal(es.status, 200, 'de stroom van B ging niet open (status ' + es.status + ')');
  const lezer = es.body.getReader();
  /* WACHTEN TOT DE SERVER ONS KENT, en niet 300 ms gokken. /api/stream zet de
     luisteraar in sseClients en stuurt daarna meteen een `hello` (server.js).
     Zien wij dat, dan is de registratie een feit -- en dat is precies de
     voorwaarde voor de zet hieronder. Zet A eerder, dan gaat het seintje naar
     niemand en wacht deze toets vijf seconden op een event dat nooit komt.

     De lezer meldt dat zelf: `open` gaat af zodra de eerste brok binnen is. */
  let meldOpen;
  const open = new Promise(k => { meldOpen = k; });
  const leesEven = (async () => {
    const dec = new TextDecoder(); let buf = '';
    /* DE TIJDGRENS GELDT VOOR HET GEHEEL EN NIET PER BROK, en dat is waarom deze
       toets hier altijd groen was en in CI altijd rood. Er stond een race van
       elke read() tegen 1200 ms, en won die klok, dan BRAK de lus af -- terwijl
       het seintje nog onderweg was. Op deze machine komt het binnen een tel; op
       een belaste runner zit er meer tussen `hello` en het event, en dan gaf de
       toets op en meldde "B kreeg het seintje niet" over een server die het
       keurig had gestuurd.
       Nu racet de read tegen de RESTERENDE tijd: een trage brok kost geduld, en
       alleen de totale grens beeindigt het wachten. */
    const tot = Date.now() + 15000;
    while (Date.now() < tot) {
      const uit = await Promise.race([lezer.read(),
        new Promise(r => setTimeout(() => r({ tijdOp: true }), Math.max(50, tot - Date.now())))]);
      if (uit.tijdOp) break;
      const { value, done } = uit;
      if (done || !value) break;
      buf += dec.decode(value);
      if (!eerste) eerste = buf.slice(0, 120);
      if (buf.includes('hello')) { zagHello = true; meldOpen(); }
      /* WACHTEN OP EEN HELE GEBEURTENIS, niet op haar kopregel. Hier stond
         `buf.includes('event: samen')`, en dat is waar zodra de REGEL binnen is
         -- terwijl `data:` er dan nog niet hoeft te staan. Op deze machine komt
         een SSE-brok in zijn geheel binnen en viel dat nooit op; op een belaste
         runner splitst hij, en dan brak de lus af op een halve gebeurtenis en
         zakte de toets op zijn eigen leessnelheid. Een gebeurtenis is pas af bij
         de lege regel erna; daar wachten we nu op. */
      const k = buf.indexOf('event: samen');
      if (k >= 0 && buf.indexOf('\n\n', k) >= 0) { events.push(buf); reden = 'seintje'; break; }
    }
    if (!reden) reden = 'lijn dicht of tijd op';
    meldOpen();   // ook als de lijn dichtging: nooit blijven hangen
  })();
  await open;
  const zet = await api(base, '/api/samen/zet', { id: kamerId, pad: '/apps/mall.html', titel: 'De RTG Mall' }, A);
  assert.equal(zet.status, 200);
  assert.equal(zet.body.kamer.pad, '/apps/mall.html');
  await leesEven;
  try { await lezer.cancel(); } catch (e) {}
  assert.ok(zagHello, 'de stroom sloot voordat de server B als luisteraar kende; eerste bytes: ' + JSON.stringify(eerste));
  /* DE ONTVANGEN BYTES HOREN IN DE MELDING. Zonder ze zegt deze toets alleen
     "B kreeg het seintje niet", en dat is drie verschillende oorzaken tegelijk:
     geen seintje, een seintje met andere inhoud, of een lijn die dichtging. In
     CI zakt hij binnen 33 ms terwijl de tijdgrens 15 seconden is -- dus kwam er
     WEL iets. Wat, dat hoort de melding te zeggen. */
  assert.ok(events.length && /"kind":"kijk"/.test(events[0]) && /mall\.html/.test(events[0]),
    'B kreeg het kijk-seintje live (einde: ' + reden + ', hello gezien: ' + zagHello +
    ', ontvangen: ' + JSON.stringify((events[0] || eerste).slice(0, 400)) + ')');
  // en wie later binnenkomt ziet het in de staat
  const staat = await api(base, '/api/samen/staat', { id: kamerId }, B);
  assert.equal(staat.body.kamer.pad, '/apps/mall.html');
});

test('3. alleen plekken binnen RTG; externe adressen komen de kamer niet in', async () => {
  assert.equal((await api(base, '/api/samen/zet', { id: kamerId, pad: 'https://kwaad.example/x' }, A)).status, 400);
  assert.equal((await api(base, '/api/samen/zet', { id: kamerId, pad: '//kwaad.example' }, A)).status, 400);
  const geheim = 'PIN-HERSTEL-GEHEIM';
  const query = await api(base, '/api/samen/zet', {
    id: kamerId, pad: '/apps/app.html?pinherstel=' + geheim, titel: 'Herstel'
  }, A);
  assert.equal(query.status, 400, 'ook een interne pagina met querycredential blijft buiten de kamer');
  assert.equal(JSON.stringify(query.body).includes(geheim), false);
  const staat = await api(base, '/api/samen/staat', { id: kamerId }, B);
  assert.equal(JSON.stringify(staat.body).includes(geheim), false);
});

test('4. de kamer-chat werkt en is begrensd; buitenstaanders komen er niet in', async () => {
  const r = await api(base, '/api/samen/chat', { id: kamerId, tekst: 'Kijk deze etage!' }, B);
  assert.equal(r.status, 200);
  const staat = await api(base, '/api/samen/staat', { id: kamerId }, A);
  assert.ok(staat.body.kamer.chat.some(c => c.tekst === 'Kijk deze etage!'));
  // een derde lid dat NIET meedoet mag niets
  const reg3 = await api(base, '/api/auth/register', { name: 'Pottenkijker', email: 'samen3@x.nl', phone: '0612345673', password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  const C = reg3.body.token;
  assert.equal((await api(base, '/api/samen/staat', { id: kamerId }, C)).status, 404);
  assert.equal((await api(base, '/api/samen/chat', { id: kamerId, tekst: 'ik gluur' }, C)).status, 404);
  assert.equal((await api(base, '/api/samen/zet', { id: kamerId, pad: '/apps/sport.html' }, C)).status, 404);
});

test('4b. samen luisteren: de gastheer deelt de muziek, de leden zien het en volgen; alleen de gastheer bepaalt', async () => {
  const zet = await api(base, '/api/samen/muziek', { id: kamerId, media: { stationId: 'sunset', seed: 4242, startOffsetMs: 12000, speelt: true } }, A);
  assert.equal(zet.status, 200);
  assert.ok(zet.body.kamer.muziek && zet.body.kamer.muziek.stationId === 'sunset', 'de kamer draagt nu de muziek');
  // B ziet de muziek in de staat, met een serverklok om op te synchroniseren
  const staat = await api(base, '/api/samen/staat', { id: kamerId }, B);
  assert.equal(staat.body.kamer.muziek.seed, 4242);
  assert.ok(staat.body.kamer.muziek.start > 0 && staat.body.kamer.now >= staat.body.kamer.muziek.start, 'starttijd en serverklok kloppen');
  // een lid dat niet de gastheer is, mag de muziek niet sturen
  assert.equal((await api(base, '/api/samen/muziek', { id: kamerId, media: { stationId: 'nacht', seed: 1 } }, B)).status, 403);
});

test('4c. alleen de gastheer sluit een kamer en trekt de deelcode direct in', async () => {
  const gemaakt = await api(base, '/api/samen/maak', {
    idem: 'samen-route-sluit-0001'
  }, A);
  const id = gemaakt.body.kamer.id;
  const deelcode = gemaakt.body.code;
  await api(base, '/api/samen/mee', { code: deelcode }, B);

  assert.equal((await api(base, '/api/samen/sluit', { id }, B)).status, 403,
    'een deelnemer kan de kamer niet voor iedereen sluiten');
  assert.equal((await api(base, '/api/samen/sluit', { id }, A)).status, 200);
  assert.equal((await api(base, '/api/samen/staat', { id }, A)).status, 404,
    'een gesloten kamer geeft ook de gastheer geen staat meer');
  assert.equal((await api(base, '/api/samen/mee', { code: deelcode }, B)).status, 404,
    'de ingetrokken deelcode opent de kamer niet opnieuw');
});

test('5. verlaten: de laatste doet het licht uit en de code vervalt', async () => {
  assert.equal((await api(base, '/api/samen/weg', { id: kamerId }, B)).status, 200);
  assert.equal((await api(base, '/api/samen/weg', { id: kamerId }, A)).status, 200);
  assert.equal((await api(base, '/api/samen/staat', { id: kamerId }, A)).status, 404, 'de kamer is weg');
});

test('6. zonder inlog blijft samen dicht', async () => {
  assert.equal((await api(base, '/api/samen/maak', {})).status, 401);
});
