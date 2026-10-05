/* ============================================================================
   HET TRIO KENT NOOIT TWEE SCHRIJVERS -- regressie voor RTG-V1-RELEASE C6
   (gevonden door de onafhankelijke herkeuring).

   DE FOUT: server/trio-wacht.js nam de oude leider zijn rol "best effort" af en
   promoveerde de nieuwe ook als dat mislukte. Een leider die vastzit (geen
   antwoord op /api/health en niet op de demote) leeft nog en schrijft verder
   zodra hij loskomt; op SQLite verdwijnt dan stil een update.

   DE FIX: server/trio-afzetten.js. Bevestigt de oude leider zijn afzetting
   niet, dan wordt zijn proces gestopt en pas daarna gepromoveerd; lukt stoppen
   niet, dan wordt er niemand gepromoveerd.

   De toets draait tegen de ECHTE maakWacht: nep-HTTP-servers beantwoorden de
   gezondheids-, promote- en demote-aanroepen van de poortwachter, en een nep-
   kindproces legt vast of en wanneer het werd gestopt.

   Draai los: node --test test/trio-afzetten.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { EventEmitter } = require('events');
const { maakWacht } = require('../server/trio-wacht');

/* Opeenvolgende vrije poorten: maakWacht rekent BASISPOORT + i. */
async function tweePoorten(aantal = 2) {
  for (let poging = 0; poging < 50; poging++) {
    const basis = 40000 + Math.floor(Math.random() * 20000);
    const vrij = await Promise.all(Array.from({ length: aantal }, (_, i) => basis + i).map((p) => new Promise((klaar) => {
      const s = http.createServer().once('error', () => klaar(false))
        .listen(p, '127.0.0.1', () => s.close(() => klaar(true)));
    })));
    if (vrij.every(Boolean)) return basis;
  }
  throw new Error('geen ' + aantal + ' opeenvolgende vrije poorten');
}

/* Een nepserver per poort; `stand` bepaalt wat hij antwoordt, `spoor` legt de
   volgorde van gebeurtenissen vast over alle servers heen. Zoals de echte
   server VOERT hij een promote uit zodra hij binnenkomt (`leider`), en kan het
   antwoord daarna nog op zich laten wachten (`vertraging`): laden, migreren en
   een backup gaan voor het antwoord uit. Een demote met 200 is uitgevoerd. */
function nepServer(port, nr, stand, spoor) {
  const s = http.createServer((req, res) => {
    const pad = req.url.split('?')[0];
    let status = 404;
    let lijf = '';
    if (pad === '/api/health') {
      /* Een echte server is BEZIG tijdens zijn promote (laden, migreren en de
         backup zijn synchroon) en antwoordt dan niet gezond. */
      status = stand.gezond && !stand.bezig ? 200 : 503;
      lijf = JSON.stringify(typeof stand.leider === 'boolean' ? { ok: true, leider: stand.leider } : { ok: true });
    } else if (pad === '/api/cluster/promote') {
      status = stand.promote; spoor.push('promote:' + nr);
      if (status === 200) stand.leider = true;
      if (stand.vertraging) { stand.bezig = true; setTimeout(() => { stand.bezig = false; }, stand.vertraging); }
    } else if (pad === '/api/cluster/demote') {
      status = stand.demote; spoor.push('demote:' + nr);
      if (stand.bijDemote) stand.bijDemote();
      if (status === 200) stand.leider = false;
    }
    setTimeout(() => { res.writeHead(status); res.end(lijf); }, pad === '/api/cluster/promote' ? (stand.vertraging || 0) : 0);
  });
  return new Promise((klaar) => s.listen(port, '127.0.0.1', () => klaar(s)));
}

function nepKind(nr, spoor, sterft) {
  const k = new EventEmitter();
  k.exitCode = null; k.signalCode = null;
  k.kill = (sig) => {
    spoor.push('kill:' + nr + ':' + sig);
    if (sterft) process.nextTick(() => { k.signalCode = sig; k.emit('exit', null, sig); });
  };
  return k;
}

async function opstelling({ sterft }) {
  const basis = await tweePoorten();
  const spoor = [];
  const stand = [{ gezond: true, promote: 200, demote: 200 }, { gezond: false, promote: 200, demote: 200 }];
  const nep = [await nepServer(basis, 1, stand[0], spoor), await nepServer(basis + 1, 2, stand[1], spoor)];
  const w = maakWacht({ AANTAL: 2, BASISPOORT: basis, SLEUTEL: 'toets', FAILBACK_MS: 10000, log: () => {} });
  w.servers[0].child = nepKind(1, spoor, sterft);
  w.servers[1].child = nepKind(2, spoor, true);
  await w.kiesActieve('start');
  assert.equal(w.actieve(), 0, 'server 1 is eerst leider');
  spoor.length = 0;
  // server 1 loopt vast: geen gezondheid en geen bevestigde demote; server 2 staat klaar
  stand[0].gezond = false; stand[0].demote = 500;
  stand[1].gezond = true;
  return { w, spoor, stand, sluit: () => Promise.all(nep.map((s) => new Promise((r) => s.close(r)))) };
}

test('1. een vastgelopen leider wordt GESTOPT voordat een ander leider wordt', async () => {
  const { w, spoor, sluit } = await opstelling({ sterft: true });
  try {
    await w.kiesActieve('server 1 reageert niet meer');
    const kill = spoor.indexOf('kill:1:SIGKILL'), promote = spoor.indexOf('promote:2');
    assert.ok(kill >= 0, 'het proces van de oude leider hoort gestopt te worden: ' + spoor.join(', '));
    assert.ok(promote > kill, 'de nieuwe leider pas NA het stoppen van de oude: ' + spoor.join(', '));
    assert.equal(w.actieve(), 1, 'server 2 is daarna leider');
  } finally { w.stop(); await sluit(); }
});

test('2. lukt het stoppen niet, dan wordt er NIEMAND gepromoveerd (liever geen leider dan twee)', { timeout: 20000 }, async () => {
  const { w, spoor, sluit } = await opstelling({ sterft: false });
  try {
    await w.kiesActieve('server 1 reageert niet meer');
    assert.ok(spoor.includes('kill:1:SIGKILL'), 'er is geprobeerd te stoppen: ' + spoor.join(', '));
    assert.ok(!spoor.includes('promote:2'), 'zonder bevestigd einde geen tweede leider: ' + spoor.join(', '));
    assert.equal(w.actieve(), 0, 'de rol blijft staan tot de volgende ronde');
  } finally { w.stop(); await sluit(); }
});

test('3. een bevestigde afzetting stopt niets, en dan volgt de promotie', async () => {
  const { w, spoor, stand, sluit } = await opstelling({ sterft: true });
  try {
    stand[0].demote = 200;   // de oude leider antwoordt nog op de demote
    await w.kiesActieve('server 1 reageert niet meer');
    assert.ok(!spoor.some((s) => s.startsWith('kill:')), 'wie zijn afzetting bevestigt, wordt niet gestopt: ' + spoor.join(', '));
    assert.ok(spoor.indexOf('demote:1') >= 0 && spoor.indexOf('promote:2') > spoor.indexOf('demote:1'),
      'eerst afzetten, dan promoveren: ' + spoor.join(', '));
    assert.equal(w.actieve(), 1);
  } finally { w.stop(); await sluit(); }
});

/* ----------------------------------------------------------------------------
   DE SPIEGELKANT (tweede herkeuring van C6): een promotie die bij de
   poortwachter een TIME-OUT geeft, is niet mislukt. De server kan hem gewoon
   hebben uitgevoerd -- laden, migreren en een backup gaan voor het antwoord
   uit -- en is dan leider. Wie daarna een volgende promoveert, heeft er twee.
   Op de code van ronde 1 zakken 4 en 5 met twee leiders, en 6 met verkeer naar
   een server die net is afgezet.
   -------------------------------------------------------------------------- */
const leiders = (stand) => stand.map((st, i) => (st.leider ? i + 1 : 0)).filter(Boolean);

test('4. een promotie die een time-out geeft maar WEL is uitgevoerd, wordt afgezet voordat de volgende leider wordt', { timeout: 20000 }, async () => {
  const basis = await tweePoorten(3);
  const spoor = [];
  const stand = [{ gezond: true, promote: 200, demote: 200 }, { gezond: false, promote: 200, demote: 200 },
    { gezond: false, promote: 200, demote: 200 }];
  const nep = await Promise.all(stand.map((st, i) => nepServer(basis + i, i + 1, st, spoor)));
  const w = maakWacht({ AANTAL: 3, BASISPOORT: basis, SLEUTEL: 'toets', FAILBACK_MS: 10000, PROMOTE_MS: 300, log: () => {} });
  w.servers.forEach((s, i) => { s.child = nepKind(i + 1, spoor, true); });
  try {
    await w.kiesActieve('start');
    assert.deepEqual(leiders(stand), [1]);
    stand[0].gezond = false;                                   // server 1 valt weg
    stand[1].gezond = true; stand[1].vertraging = 2000;        // server 2 promoveert traag
    stand[2].gezond = true;                                    // server 3 staat klaar
    await w.kiesActieve('server 1 reageert niet meer');
    assert.deepEqual(leiders(stand), [3], 'precies een leider (' + spoor.join(', ') + ')');
    assert.ok(spoor.indexOf('demote:2') > spoor.indexOf('promote:2') && spoor.indexOf('promote:3') > spoor.indexOf('demote:2'),
      'eerst de trage kandidaat afzetten, dan pas de volgende: ' + spoor.join(', '));
    assert.equal(w.actieve(), 2);
  } finally { w.stop(); await Promise.all(nep.map((s) => new Promise((r) => s.close(r)))); }
});

/* Een failback-opstelling: server 2 is leider, server 1 is terug en wordt na
   FAILBACK_MS (hier 0) weer leider. */
async function failback(promoteVertraging, PROMOTE_MS = 300) {
  const basis = await tweePoorten(2);
  const spoor = [];
  const stand = [{ gezond: false, promote: 200, demote: 200 }, { gezond: true, promote: 200, demote: 200 }];
  const nep = await Promise.all(stand.map((st, i) => nepServer(basis + i, i + 1, st, spoor)));
  const w = maakWacht({ AANTAL: 2, BASISPOORT: basis, SLEUTEL: 'toets', FAILBACK_MS: 0, PROMOTE_MS, log: () => {} });
  w.servers.forEach((s, i) => { s.child = nepKind(i + 1, spoor, true); });
  await w.hartslag();
  assert.equal(w.actieve(), 1, 'server 2 is eerst leider');
  spoor.length = 0;
  stand[0].gezond = true; stand[0].vertraging = promoteVertraging;
  return { w, spoor, stand, sluit: () => Promise.all(nep.map((s) => new Promise((r) => s.close(r)))) };
}

test('5. failback: een trage promotie van de terugkeerder geeft geen twee leiders', { timeout: 20000 }, async () => {
  const { w, spoor, stand, sluit } = await failback(2000);
  try {
    await w.hartslag();                       // server 1 is weer gezond
    await w.hartslag();                       // en neemt het werk terug
    assert.deepEqual(leiders(stand), [2], 'de oude leider is teruggezet en de trage terugkeerder afgezet: ' + spoor.join(', '));
    assert.equal(w.actieve(), 1);
  } finally { w.stop(); await sluit(); }
});

test('6. failback: tijdens de wissel stuurt de poortwachter niets naar de server die wordt afgezet', { timeout: 20000 }, async () => {
  const { w, stand, sluit } = await failback(0);
  try {
    let actiefBijDemote = null;
    stand[1].bijDemote = () => { actiefBijDemote = w.actieve(); };
    await w.hartslag();
    await w.hartslag();
    assert.equal(actiefBijDemote, -1, 'een afgezette stand-by antwoordt 200 en bewaart niets; tijdens de wissel hoort er geen actieve te zijn');
    assert.equal(w.actieve(), 0, 'na de wissel is server 1 actief');
    assert.deepEqual(leiders(stand), [1]);
  } finally { w.stop(); await sluit(); }
});

test('7. kan een trage kandidaat niet aantoonbaar worden afgezet, dan wordt er niemand anders leider', { timeout: 20000 }, async () => {
  const basis = await tweePoorten(3);
  const spoor = [];
  const stand = [{ gezond: true, promote: 200, demote: 200 }, { gezond: false, promote: 200, demote: 500 },
    { gezond: false, promote: 200, demote: 200 }];
  const nep = await Promise.all(stand.map((st, i) => nepServer(basis + i, i + 1, st, spoor)));
  const w = maakWacht({ AANTAL: 3, BASISPOORT: basis, SLEUTEL: 'toets', FAILBACK_MS: 10000, PROMOTE_MS: 300, log: () => {} });
  w.servers.forEach((s, i) => { s.child = nepKind(i + 1, spoor, i !== 1); });   // server 2 sterft niet
  try {
    await w.kiesActieve('start');
    stand[0].gezond = false;
    stand[1].gezond = true; stand[1].vertraging = 2000;
    stand[2].gezond = true;
    await w.kiesActieve('server 1 reageert niet meer');
    assert.ok(!spoor.includes('promote:3'), 'geen tweede kandidaat zolang de eerste misschien leider is: ' + spoor.join(', '));
    assert.equal(w.actieve(), 1, 'de onzekere kandidaat geldt als actief, zodat de volgende ronde hem eerst afzet');
  } finally { w.stop(); await Promise.all(nep.map((s) => new Promise((r) => s.close(r)))); }
});

/* ----------------------------------------------------------------------------
   DE DERDE HERKEURING vond twee wegen die de reparatie van ronde 2 liet liggen
   of zelf opende, en drie mutanten die geen toets ving.
   -------------------------------------------------------------------------- */
test('8. een kiesActieve van de proxy TIJDENS de failback-wissel promoveert de oude leider niet terug', { timeout: 20000 }, async () => {
  const { w, stand, sluit } = await failback(1200, 5000);
  try {
    const wissel = w.hartslag();                     // server 1 is terug en neemt het werk terug: zijn promote duurt 1,2 s
    await new Promise((r) => setTimeout(r, 300));
    await w.kiesActieve('server 2 liet een verzoek vallen');   // zoals trio-proxy.js en trio-werkers.js doen
    await wissel;
    assert.deepEqual(leiders(stand), [1], 'precies een leider na de wissel');
    assert.equal(w.actieve(), 0);
  } finally { w.stop(); await sluit(); }
});

test('9. een actieve die zegt GEEN leider te zijn (herstart als stand-by) wordt opnieuw gepromoveerd', { timeout: 20000 }, async () => {
  const { w, spoor, stand, sluit } = await failback(0);
  try {
    assert.deepEqual(leiders(stand), [2]);
    stand[0].gezond = false;                        // server 1 blijft weg, er is geen failback
    stand[1].leider = false;                        // server 2 crashte en kwam terug als stand-by
    await w.hartslag();
    assert.ok(spoor.includes('promote:2'), 'de stand-by wordt weer leider: ' + spoor.join(', '));
    assert.deepEqual(leiders(stand), [2]);
    assert.equal(w.actieve(), 1);
  } finally { w.stop(); await sluit(); }
});

test('10. een promote die langer duurt dan een gezondheidscontrole krijgt de tijd (PROMOTE_MS)', { timeout: 20000 }, async () => {
  const basis = await tweePoorten(2);
  const spoor = [];
  const stand = [{ gezond: true, promote: 200, demote: 200, vertraging: 2000 }, { gezond: false, promote: 200, demote: 200 }];
  const nep = await Promise.all(stand.map((st, i) => nepServer(basis + i, i + 1, st, spoor)));
  const w = maakWacht({ AANTAL: 2, BASISPOORT: basis, SLEUTEL: 'toets', FAILBACK_MS: 10000, log: () => {} });
  w.servers.forEach((s, i) => { s.child = nepKind(i + 1, spoor, true); });
  try {
    await w.kiesActieve('start');
    assert.ok(!spoor.some((x) => x.startsWith('demote:') || x.startsWith('kill:')), 'een trage maar gewone promote wordt niet afgeschoten: ' + spoor.join(', '));
    assert.equal(w.actieve(), 0);
  } finally { w.stop(); await Promise.all(nep.map((s) => new Promise((r) => s.close(r)))); }
});

test('11. failback: lukken de terugkeerder EN het terugdraaien niet, dan is er geen actieve (en niet stil de oude)', { timeout: 20000 }, async () => {
  const { w, stand, sluit } = await failback(0);
  try {
    stand[0].promote = 500; stand[1].promote = 500;   // geen van beide wordt leider
    await w.hartslag();                               // server 1 is weer gezond: failback (FAILBACK_MS 0)
    assert.deepEqual(leiders(stand), [], 'niemand is leider');
    assert.equal(w.actieve(), -1, 'dan kiest de volgende hartslag; de oude blijft niet stil de actieve');
  } finally { w.stop(); await sluit(); }
});

test('12. failback: een terugkeerder die "onzeker" blijft, geldt als actief (de oude wordt niet teruggezet)', { timeout: 20000 }, async () => {
  const { w, stand, spoor, sluit } = await failback(2000);
  try {
    stand[0].demote = 500;                                          // afzetten lukt niet
    w.servers[0].child = nepKind(1, spoor, false);                  // en stoppen ook niet
    await w.hartslag();
    await w.hartslag();
    assert.deepEqual(leiders(stand), [1], 'de oude is niet teruggezet naast een mogelijke nieuwe leider');
    assert.equal(w.actieve(), 0);
  } finally { w.stop(); await sluit(); }
});
