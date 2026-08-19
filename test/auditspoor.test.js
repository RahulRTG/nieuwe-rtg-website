/* ============================================================================
   HET API-SPOOR (server/opzet/auditspoor.js): laat elke geslaagde
   schrijfhandeling een regel na die niemand ongemerkt kan wijzigen?

   WAT HIER OP HET SPEL STAAT. De AUDIT-kolom van de bewijsmatrix stond op
   ONGEMETEN voor alle 4182 routes -- er werd niet eens gekeken. Deze laag vult
   die kolom, en dan is de eerste vraag niet "schrijft hij iets" maar "schrijft
   hij het JUISTE, en houdt hij zijn mond waar dat hoort". Een auditspoor dat
   ook geweigerde pogingen noteert, is binnen een dag ruis; een auditspoor dat
   het verzoeklijf bewaart, is zelf een datalek; en een auditspoor waarin de
   beller zijn eigen naam mag zetten, is geen auditspoor.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - de statuscontrole eruit (ook 4xx noteren)
     -> "een geweigerde handeling laat niets na" ZAKT (RAAK)
   - de actor uit het LIJF halen in plaats van uit de sessie
     -> "de actor komt uit de sessie en nooit uit het lijf" ZAKT (RAAK)
   - de OVERSLAAN-lijst leegmaken
     -> "het interne verkeer blijft eruit" ZAKT (RAAK)
   - `vorig` niet meer zetten in kern/command/journaal.js
     -> "een gewijzigde regel breekt de keten" ZAKT (RAAK, via de ketencontrole)
   - na een wissing niet opnieuw zegelen
     -> "een gewist lid verdwijnt uit het spoor" ZAKT op de ketencontrole (RAAK)

   Los: node --test test/auditspoor.test.js
   ========================================================================== */
const { test } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const { maakAuditspoor } = require('../server/opzet/auditspoor');

function maakServer(auditspoor, handler) {
  const mw = auditspoor.middleware();
  const srv = http.createServer((req, res) => {
    const brokken = [];
    req.on('data', c => brokken.push(c));
    req.on('end', () => {
      try { req.body = JSON.parse(Buffer.concat(brokken).toString() || '{}'); } catch (e) { req.body = {}; }
      req.path = String(req.url).split('?')[0];
      req.ip = '127.0.0.1';
      req.get = (naam) => req.headers[String(naam).toLowerCase()];
      res.set = (n, w) => { res.setHeader(n, w); return res; };
      res.status = (c) => { res.statusCode = c; return res; };
      res.json = (data) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(data)); return res; };
      mw(req, res, () => handler(req, res));
    });
  });
  return new Promise(k => srv.listen(0, '127.0.0.1', () => k({ srv, poort: srv.address().port })));
}

function opzet(opties) {
  const db = { data: {} };
  const auditspoor = maakAuditspoor(Object.assign({ db, save: () => {} }, opties || {}));
  return { db, auditspoor };
}

async function roep(poort, methode, pad, lijf, koppen) {
  const r = await fetch('http://127.0.0.1:' + poort + pad, {
    method: methode,
    headers: Object.assign({ 'content-type': 'application/json' }, koppen || {}),
    body: methode === 'GET' ? undefined : JSON.stringify(lijf || {})
  });
  await r.text();
  /* Het spoor wordt op res.finish geschreven; dat is bij de server al gebeurd
     voordat wij hier klaar zijn, maar een tel marge maakt de toets stabiel
     zonder iets te verbergen -- zonder spoor blijft hij ook na deze marge leeg. */
  await new Promise(k => setTimeout(k, 25));
  return r.status;
}

test('een geslaagde schrijfhandeling laat precies een regel na, met wie en wat', async () => {
  const { auditspoor } = opzet();
  const { srv, poort } = await maakServer(auditspoor, (req, res) => {
    req.session = { key: 'user-42' };
    res.status(200).json({ ok: true });
  });
  try {
    await roep(poort, 'POST', '/api/concern/nieuw', { naam: 'Iets' });
    const regels = auditspoor.journaal.recent(10);
    assert.strictEqual(regels.length, 1);
    assert.strictEqual(regels[0].actie, 'POST /api/concern/nieuw');
    assert.strictEqual(regels[0].actor, 'user-42');
    assert.strictEqual(regels[0].uitslag, '200');
    assert.strictEqual(regels[0].niveau, 'api');
  } finally { srv.close(); }
});

test('het verzoeklijf komt er NIET in -- een auditlog met alle lijven is zelf het datalek', async () => {
  const { auditspoor } = opzet();
  const { srv, poort } = await maakServer(auditspoor, (req, res) => {
    req.session = { key: 'user-1' };
    res.status(200).json({ ok: true });
  });
  try {
    await roep(poort, 'POST', '/api/lid/gegevens', { iban: 'NL91ABNA0417164300', naam: 'Echte Naam' });
    const alles = JSON.stringify(auditspoor.journaal.recent(10));
    assert.ok(!alles.includes('NL91ABNA0417164300'), 'geen IBAN in het spoor');
    assert.ok(!alles.includes('Echte Naam'), 'geen naam in het spoor');
  } finally { srv.close(); }
});

test('de actor komt uit de sessie en nooit uit het lijf', async () => {
  const { auditspoor } = opzet();
  const { srv, poort } = await maakServer(auditspoor, (req, res) => {
    req.session = { key: 'user-7' };
    res.status(200).json({ ok: true });
  });
  try {
    await roep(poort, 'POST', '/api/iets', { actor: 'de directeur', wie: 'iemand anders' });
    const r = auditspoor.journaal.recent(1)[0];
    assert.strictEqual(r.actor, 'user-7', 'wie het lijf schrijft, schrijft anders de naam van een ander onder zijn handeling');
  } finally { srv.close(); }
});

test('een geweigerde handeling laat niets na', async () => {
  const { auditspoor } = opzet();
  const { srv, poort } = await maakServer(auditspoor, (req, res) => res.status(403).json({ error: 'nee' }));
  try {
    await roep(poort, 'POST', '/api/verboden', {});
    assert.strictEqual(auditspoor.journaal.aantal(), 0, 'een gescande deurklink hoort niet tussen de echte handelingen');
  } finally { srv.close(); }
});

test('lezen laat niets na', async () => {
  const { auditspoor } = opzet();
  const { srv, poort } = await maakServer(auditspoor, (req, res) => res.status(200).json({ ok: true }));
  try {
    await roep(poort, 'GET', '/api/overzicht');
    assert.strictEqual(auditspoor.journaal.aantal(), 0);
  } finally { srv.close(); }
});

test('het interne verkeer blijft eruit', async () => {
  const { auditspoor } = opzet();
  const { srv, poort } = await maakServer(auditspoor, (req, res) => res.status(200).json({ ok: true }));
  try {
    await roep(poort, 'POST', '/api/cluster/hartslag', {});
    await roep(poort, 'POST', '/api/command/apispoor', {});
    assert.strictEqual(auditspoor.journaal.aantal(), 0,
      'de hartslag elke seconde en het lezen van het spoor zelf zouden het venster vullen met wat niemand terugzoekt');
    await roep(poort, 'POST', '/api/echt/werk', {});
    assert.strictEqual(auditspoor.journaal.aantal(), 1, 'en de rest komt er wel in');
  } finally { srv.close(); }
});

test('de zaak-actor draagt zijn code en de medewerker die aan het werk was', async () => {
  const { auditspoor } = opzet();
  const { srv, poort } = await maakServer(auditspoor, (req, res) => {
    req.supplier = { code: 'HOSHI' };
    req.actor = { name: 'Beheer', staffId: 'p12' };
    res.status(200).json({ ok: true });
  });
  try {
    await roep(poort, 'POST', '/api/supplier/kassa/afrekenen', {});
    assert.strictEqual(auditspoor.journaal.recent(1)[0].actor, 'zaak-HOSHI/p12');
  } finally { srv.close(); }
});

test('een kantoorsessie zonder eigen account heet ook zo', async () => {
  const { auditspoor } = opzet({ sessionFor: () => ({ role: 'office' }) });
  const { srv, poort } = await maakServer(auditspoor, (req, res) => res.status(200).json({ ok: true }));
  try {
    await roep(poort, 'POST', '/api/office/iets', {}, { authorization: 'Bearer kantoortoken' });
    assert.strictEqual(auditspoor.journaal.recent(1)[0].actor, 'kantoor-gedeelde-code',
      'een gedeelde code heeft geen persoon; dat hoort in het spoor te staan en niet weggepoetst');
  } finally { srv.close(); }
});

/* DE KERN VAN DE HELE LAAG. Zonder deze toets is het spoor een lijst die je op
   je woord moet geloven. */
test('een gewijzigde regel breekt de keten, en de controle wijst hem aan', async () => {
  const { db, auditspoor } = opzet();
  const { srv, poort } = await maakServer(auditspoor, (req, res) => {
    req.session = { key: 'user-3' };
    res.status(200).json({ ok: true });
  });
  try {
    for (const pad of ['/api/een', '/api/twee', '/api/drie']) await roep(poort, 'POST', pad, {});
    assert.strictEqual(auditspoor.journaal.controleer().heel, true, 'ongeschonden hoort heel te zijn');

    // iemand met schrijftoegang zet er een andere actor in
    const rij = db.data.apiSpoor.commandJournaal;
    assert.strictEqual(rij.length, 3);
    rij[1].actor = 'iemand-anders';
    const kapot = auditspoor.journaal.controleer();
    assert.strictEqual(kapot.heel, false);
    assert.strictEqual(kapot.bij, rij[1].id, 'en hij wijst de regel aan waar het misgaat');
  } finally { srv.close(); }
});

test('een weggeknipte regel breekt de keten ook', async () => {
  const { db, auditspoor } = opzet();
  const { srv, poort } = await maakServer(auditspoor, (req, res) => {
    req.session = { key: 'user-3' };
    res.status(200).json({ ok: true });
  });
  try {
    for (const pad of ['/api/een', '/api/twee', '/api/drie']) await roep(poort, 'POST', pad, {});
    db.data.apiSpoor.commandJournaal.splice(1, 1);           // de middelste eruit
    assert.strictEqual(auditspoor.journaal.controleer().heel, false);
    /* WAT DIT NIET ZIET, en dat hoort erbij: wie de NIEUWSTE regels weggooit,
       houdt een kloppende keten over. Daarvoor is een anker buiten deze database
       nodig -- server/lib/keten-anker.js, en die staat bewust op
       niet-in-bedrijf. */
    const vers = opzet();
    assert.strictEqual(vers.auditspoor.journaal.controleer().heel, true);
  } finally { srv.close(); }
});

/* HET RECHT OP VERGETELHEID TEGENOVER DE ONVERANDERLIJKE KETEN. Allebei waar,
   en de uitweg is niet kiezen maar opschrijven: de actor gaat eruit, de keten
   wordt opnieuw gezegeld, en de herschrijving staat er als regel in met de kop
   van vóór de wissing erbij. */
test('een gewist lid verdwijnt uit het spoor, en de wissing staat er zelf in', async () => {
  const { db, auditspoor } = opzet();
  const { srv, poort } = await maakServer(auditspoor, (req, res) => {
    req.session = { key: req.headers['x-wie'] || 'user-9' };
    res.status(200).json({ ok: true });
  });
  try {
    await roep(poort, 'POST', '/api/een', {}, { 'x-wie': 'user-9' });
    await roep(poort, 'POST', '/api/twee', {}, { 'x-wie': 'user-9' });
    await roep(poort, 'POST', '/api/drie', {}, { 'x-wie': 'user-8' });
    const kopVoor = auditspoor.journaal.recent(1)[0].zegel;

    const uit = auditspoor.journaal.wisActor('user-9', 'recht op vergetelheid (AVG art. 17)');
    assert.strictEqual(uit.geraakt, 2, 'precies de twee regels van dit lid');

    const alles = JSON.stringify(db.data.apiSpoor);
    assert.ok(!/user-9(?![0-9])/.test(alles), 'de sleutel van het lid staat er nergens meer in');
    assert.ok(alles.includes('user-8'), 'en die van iemand anders staat er nog gewoon');
    assert.strictEqual(auditspoor.journaal.controleer().heel, true, 'de keten klopt na het opnieuw zegelen');

    const laatste = auditspoor.journaal.recent(1)[0];
    assert.match(laatste.actie, /wissing/, 'de herschrijving staat als regel in het spoor');
    assert.strictEqual(laatste.voor.kopVoorWissing, kopVoor, 'met de kop van vóór de wissing erbij');
    assert.match(laatste.reden, /AVG/, 'en met de grond');
  } finally { srv.close(); }
});

test('wissen van een actor die er niet in staat, laat de keten met rust', async () => {
  const { auditspoor } = opzet();
  const { srv, poort } = await maakServer(auditspoor, (req, res) => {
    req.session = { key: 'user-1' };
    res.status(200).json({ ok: true });
  });
  try {
    await roep(poort, 'POST', '/api/een', {});
    const voor = auditspoor.journaal.recent(1)[0].zegel;
    const uit = auditspoor.journaal.wisActor('user-999');
    assert.strictEqual(uit.geraakt, 0);
    assert.strictEqual(auditspoor.journaal.recent(1)[0].zegel, voor,
      'geen wissing, geen herschrijving: het spoor blijft bit voor bit gelijk');
  } finally { srv.close(); }
});

test('het spoor houdt een verzoek nooit op, ook niet als het schrijven faalt', async () => {
  const { auditspoor } = opzet();
  auditspoor.journaal.noteer = () => { throw new Error('opslag stuk'); };
  const { srv, poort } = await maakServer(auditspoor, (req, res) => res.status(200).json({ ok: true }));
  try {
    const status = await roep(poort, 'POST', '/api/iets', {});
    assert.strictEqual(status, 200, 'een geslaagde handeling mag niet alsnog stukgaan op zijn eigen boekhouding');
  } finally { srv.close(); }
});
