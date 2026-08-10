/* DE TWEE VOORDEUREN DIE NOOIT ZIJN OPENGEGAAN IN EEN TOETS.

   `npm run gateway` (server/poort.js) en `npm run nood` (server/nood.js) zijn
   allebei een eigen instappunt uit package.json, en van allebei was nooit een
   keer nagegaan of ze werkelijk starten en doen wat hun kop belooft. Bij IMAP
   bleek dat een ReferenceError te verbergen (eerlijkheidspunt 6.19); hier bleek
   het iets ergers.

   WAT DEZE TOETS HAD MOETEN VINDEN, en nu vastlegt:

   1. EEN VERZOEKREGEL IS GEEN URL. In HTTP mag een verzoekregel ook de absolute
      vorm hebben (`GET http://ergens/x HTTP/1.1`) -- precies de vorm die je naar
      een proxy stuurt. De gateway bouwde daar zonder meer een URL van, die gooide,
      en een fout in de verzoekhandler van http.createServer beeindigt het PROCES.
      Een curl van een regel, geen inlog nodig, en de voordeur van elk domein lag
      plat. Hetzelfde gold voor de asterisk-vorm (`OPTIONS *`).
   2. EEN HTTPS-UPSTREAM DEED HETZELFDE. `http.request` weigert die met
      ERR_INVALID_PROTOCOL, ook een uncaught exception -- en dat stond te wachten
      op de eerste beheerder die RTG_UP_SUPPLIER op https zet. De noodserver koos
      zijn onderlaag al op protocol; de gateway niet.
   3. DE NOODSERVER BELOOFT DRIE DINGEN en die staan nu vast: zijn eigen status,
      de pagina's uit public/ ook als de hoofdingang weg is, en een NETTE 503 op
      /api met uitleg in plaats van een kapotte verbinding. Dat laatste is zijn
      hele bestaansreden -- de apps vallen daarop terug op hun demoweergave.

   WAT HIER BEWUST NIET IS BEPROEFD: het vangnet (de try/catch) om de
   verzoekhandler van de gateway. Na de controle op de verzoekvorm, de juiste
   onderlaag en de controle op de upstreams bij het starten is er geen geval meer
   dat daar nog gooit -- dus valt er niets te meten, en een mutatie die het net
   weghaalt laat geen toets zakken. Het is een net voor het onvoorziene, en dat
   is per definitie niet te beproeven. Het staat hier zodat niemand denkt dat het
   wel gedekt is.

   Beide draaien hier als KINDPROCES, want het zijn scripts en geen modules: ze
   luisteren bij het inlezen. Elk krijgt een eigen vrije poort, en het opruimen
   staat in een wikkel -- een toets die een proces laat staan, hangt de suite op
   (zie eerlijkheidspunt 6.20).

   Draai los: node --experimental-sqlite --test test/voordeuren.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');

const WORTEL = path.join(__dirname, '..');

/* Een vrije poort vragen aan het besturingssysteem in plaats van er een te
   verzinnen: twee toetsbestanden die tegelijk draaien mogen elkaar niet in de
   weg zitten (dat is hier eerder misgegaan, zie 6.15 over toetsen die op hun
   eigen omstandigheden zakken). */
function vrijePoort() {
  return new Promise((res, rej) => {
    const s = net.createServer();
    s.once('error', rej);
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); });
  });
}

const wacht = (ms) => new Promise(r => setTimeout(r, ms));

/* Een script starten en wachten tot het luistert. Opruimen gebeurt ALTIJD, ook
   als een bewering halverwege gooit -- anders blijft er een proces staan dat de
   poort vasthoudt en de suite niet laat afsluiten. */
async function metScript(bestand, env, werk) {
  const kind = spawn(process.execPath, [path.join(WORTEL, 'server', bestand)],
    { cwd: WORTEL, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  let uit = '';
  kind.stdout.on('data', d => { uit += d; });
  kind.stderr.on('data', d => { uit += d; });
  try {
    const eind = Date.now() + 8000;
    while (Date.now() < eind && !/luistert|gateway op/.test(uit)) {
      if (kind.exitCode !== null) throw new Error(bestand + ' stopte meteen: ' + uit.slice(0, 400));
      await wacht(50);
    }
    assert.match(uit, /luistert|gateway op/, bestand + ' meldt niet dat hij luistert: ' + uit.slice(0, 400));
    return await werk({ kind, log: () => uit });
  } finally {
    kind.kill('SIGKILL');
  }
}

// een gewoon verzoek, met de statuscode en het lijf
function vraag(poort, pad, opties) {
  return new Promise((res, rej) => {
    const r = http.request({ host: '127.0.0.1', port: poort, path: pad, method: (opties && opties.method) || 'GET', timeout: 6000 },
      a => { let b = ''; a.setEncoding('utf8'); a.on('data', d => { b += d; }); a.on('end', () => res({ status: a.statusCode, body: b })); });
    r.on('timeout', () => r.destroy(new Error('te lang')));
    r.on('error', rej);
    r.end();
  });
}

/* Een RAUWE verzoekregel, want de vormen die deze toets nodig heeft (absolute
   vorm, asterisk-vorm) zijn met een gewone client niet te sturen. */
function rauw(poort, regel) {
  return new Promise((res) => {
    const s = net.createConnection({ port: poort, host: '127.0.0.1' }, () => s.write(regel + '\r\nHost: 127.0.0.1\r\n\r\n'));
    let d = '';
    s.setEncoding('utf8');
    s.on('data', c => { d += c; });
    s.on('close', () => res(d));
    s.on('error', () => res(d));
    s.setTimeout(5000, () => s.destroy());
  });
}

const leeft = async (poort) => { try { await vraag(poort, '/api/health'); return true; } catch (e) { return false; } };

/* ---------------------------------------------------------------------------
   1. De poortwachter
   --------------------------------------------------------------------------- */

test('1. de gateway start, geeft door, en gaat NIET onderuit op een absolute verzoekregel', async () => {
  const poort = await vrijePoort();
  const dood = await vrijePoort();     // een upstream waar niets luistert
  await metScript('poort.js', { RTG_POORT: String(poort), RTG_UP_DEFAULT: 'http://127.0.0.1:' + dood }, async () => {
    // een gewoon verzoek: de upstream is er niet, dus 502 -- maar hij ANTWOORDT
    const eerst = await vraag(poort, '/api/health');
    assert.equal(eerst.status, 502, 'zonder upstream een nette 502');
    assert.match(eerst.body, /upstream onbereikbaar/);

    /* DIT IS DE VONDST. Vóór de reparatie stopte het proces hier, en daarmee de
       voordeur van elk domein -- zonder inlog, met een regel. */
    const abs = await rauw(poort, 'GET http://evil.test/x HTTP/1.1');
    assert.match(abs, /^HTTP\/1\.1 400/, 'een absolute verzoekregel wordt geweigerd: ' + JSON.stringify(abs.slice(0, 80)));
    assert.equal(await leeft(poort), true, 'en de gateway leeft nog -- dat was het hele punt');

    // de asterisk-vorm komt WEL bij onze eigen controle (node neemt hem aan)
    const ster = await rauw(poort, 'OPTIONS * HTTP/1.1');
    assert.match(ster, /^HTTP\/1\.1 400/, 'de asterisk-vorm ook');
    assert.match(ster, /geen open proxy/, 'en met onze eigen uitleg erbij, dus die controle is bereikt');
    assert.equal(await leeft(poort), true, 'en hij leeft nog steeds');
  });
});

test('2. een https-upstream gaat langs de https-laag, en niet langs het vangnet', async () => {
  /* `http.request` weigert een https-adres met ERR_INVALID_PROTOCOL, en dat is
     in een verzoekhandler een uncaught exception. Deze stand -- een beheerder
     die RTG_UP_DEFAULT op https zet -- lag klaar en was nooit geprobeerd.

     LET OP WELK GETAL DIT BEWIJST. Eerst stond hier alleen "502 en hij leeft
     nog", en dat is niet genoeg: met de fout erin gooit http.request, vangt het
     vangnet hem op, en komt er OOK een 502 uit een levende gateway. De mutatie
     kwam er ongestraft door. Het verschil zit in de REDEN, en die staat in het
     lijf: gaat het verzoek echt de https-laag in, dan mislukt het op de
     VERBINDING ("upstream onbereikbaar"); gooit het ervoor, dan zegt het vangnet
     "kon niet worden doorgegeven". */
  const poort = await vrijePoort();
  await metScript('poort.js', { RTG_POORT: String(poort), RTG_UP_DEFAULT: 'https://127.0.0.1:1' }, async () => {
    const r = await vraag(poort, '/api/health');
    assert.equal(r.status, 502, 'een https-upstream die niet antwoordt geeft 502');
    assert.match(r.body, /upstream onbereikbaar/,
      'en het verzoek is ECHT de https-laag in gegaan; "kon niet worden doorgegeven" zou betekenen dat het ervoor gooide');
    assert.equal(await leeft(poort), true, 'en de gateway staat er nog');
  });
});

test('2b. een typfout in een upstream valt op bij het STARTEN, niet bij het eerste verzoek', async () => {
  /* `RTG_UP_SUPPLIER=127.0.0.1:3003` (zonder http://) gaf een 502 op elk
     verzoek naar dat domein, zonder ergens te zeggen waarom -- de fout viel pas
     als er iemand langskwam. Een verkeerde opstelling is geen storing om te
     overleven maar een fout om te melden. */
  const poort = await vrijePoort();
  const kind = spawn(process.execPath, [path.join(WORTEL, 'server', 'poort.js')],
    { cwd: WORTEL, env: { ...process.env, RTG_POORT: String(poort), RTG_UP_DEFAULT: '127.0.0.1:3010' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let uit = '';
  kind.stdout.on('data', d => { uit += d; });
  kind.stderr.on('data', d => { uit += d; });
  try {
    const code = await new Promise((res) => { kind.once('exit', res); setTimeout(() => res(null), 8000); });
    assert.equal(code, 1, 'hij stopt met een foutcode in plaats van te gaan luisteren: ' + uit.slice(0, 300));
    assert.match(uit, /RTG_UP_DEFAULT is geen geldig adres/, 'en noemt de variabele');
    assert.match(uit, /127\.0\.0\.1:3010/, 'en de waarde die er stond');
    assert.match(uit, /http:\/\//, 'en wat er dan wel hoort te staan');
  } finally {
    kind.kill('SIGKILL');
  }
});

test('3. de gateway stuurt het juiste pad naar de juiste upstream', async () => {
  /* Zonder deze bewering zou een gateway die ALTIJD 502 geeft er hierboven
     precies zo uitzien. Er staat dus een echte upstream achter, en die vertelt
     welk pad en welke methode hij kreeg. */
  const poort = await vrijePoort();
  const gezien = [];
  const boven = http.createServer((req, res) => {
    gezien.push(req.method + ' ' + req.url);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, pad: req.url }));
  });
  await new Promise(r => boven.listen(0, '127.0.0.1', r));
  const bovenPoort = boven.address().port;
  try {
    await metScript('poort.js', { RTG_POORT: String(poort), RTG_UP_DEFAULT: 'http://127.0.0.1:' + bovenPoort }, async () => {
      const r = await vraag(poort, '/api/supplier/state?x=1', { method: 'POST' });
      assert.equal(r.status, 200);
      assert.match(r.body, /"pad":"\/api\/supplier\/state\?x=1"/, 'pad en zoekreeks komen ongeschonden aan');
      assert.deepEqual(gezien, ['POST /api/supplier/state?x=1'], 'en de methode ook');
    });
  } finally {
    await new Promise(r => boven.close(r));
  }
});

/* ---------------------------------------------------------------------------
   2. De noodserver
   --------------------------------------------------------------------------- */

test('4. de noodserver serveert de apps en geeft een NETTE 503 als de hoofdingang weg is', async () => {
  const poort = await vrijePoort();
  const dood = await vrijePoort();
  await metScript('nood.js', { RTG_NOOD_POORT: String(poort), RTG_HOOFD_URL: 'http://127.0.0.1:' + dood }, async () => {
    // zijn eigen status, los van de hoofdservers
    const h = await vraag(poort, '/nood/health');
    assert.equal(h.status, 200);
    const j = JSON.parse(h.body);
    assert.equal(j.nood, true);
    assert.equal(j.hoofd, false, 'hij ziet dat de hoofdingang weg is');

    // de pagina's blijven laden -- dat is waarvoor hij bestaat
    const p = await vraag(poort, '/apps/app.html');
    assert.equal(p.status, 200, 'de app-pagina komt van schijf');
    assert.match(p.body, /<html/i);

    /* EN DE API GEEFT EEN NETTE 503 MET UITLEG. Een kapotte verbinding zou de
       apps niet laten terugvallen op hun demoweergave; deze melding wel. */
    const a = await vraag(poort, '/api/state', { method: 'POST' });
    assert.equal(a.status, 503, 'geen kapotte verbinding maar een antwoord');
    const f = JSON.parse(a.body);
    assert.equal(f.nood, true);
    assert.match(f.error, /niet bereikbaar/);
    assert.match(f.error, /pagina/, 'met uitleg wat er nog wel werkt');
  });
});

test('5. staat de hoofdingang WEL overeind, dan geeft de noodserver hem gewoon door', async () => {
  /* De tegenproef bij toets 4: een noodserver die ALTIJD 503 geeft, zou daar
     precies zo uitzien. Hier staat er een echte hoofdingang achter, met een
     /api/health erop zodat ook de statusprik iets te zien heeft. */
  const poort = await vrijePoort();
  const boven = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, van: 'hoofd', pad: req.url }));
  });
  await new Promise(r => boven.listen(0, '127.0.0.1', r));
  const bovenPoort = boven.address().port;
  try {
    await metScript('nood.js', { RTG_NOOD_POORT: String(poort), RTG_HOOFD_URL: 'http://127.0.0.1:' + bovenPoort }, async () => {
      const a = await vraag(poort, '/api/state', { method: 'POST' });
      assert.equal(a.status, 200, 'de doorgifte werkt');
      assert.match(a.body, /"van":"hoofd"/, 'het antwoord komt van de hoofdingang');
      assert.match(a.body, /"pad":"\/api\/state"/, 'op het juiste pad');

      const h = JSON.parse((await vraag(poort, '/nood/health')).body);
      assert.equal(h.hoofd, true, 'en de statusprik ziet de hoofdingang staan');
    });
  } finally {
    await new Promise(r => boven.close(r));
  }
});
