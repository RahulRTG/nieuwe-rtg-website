/* ============================================================================
   EEN VERZOEK DAT ONDERWEG WAS TOEN DE SERVER WERD AFGEZET -- de race van N11
   uit de V1-audit, tegen een echte server.

   DE FOUT: POST /api/sleutelwoorden/zet verstuurd, een paar milliseconden
   later POST /api/cluster/demote. zet hasht vier woorden (een paar honderd ms)
   en roept pas daarna save() aan; die keerde stil terug omdat het proces niet
   meer schreef, en het antwoord was 200 met gezet:true. Na een nieuwe promote
   stond er gezet:false. Op de basis (c881636c) braken alle vijf de pogingen
   van deze toets de invariant.

   DE INVARIANT, per poging: NOOIT 200 terwijl er na een nieuwe promote niets
   staat. Een 503 mag, en dan mag het er wel of niet staan -- dat wordt
   genoteerd en niet beoordeeld, want de tekst van de 503 zegt juist dat het
   niet vaststaat.

   ELKE POGING EEN EIGEN ACCOUNT: dan zegt de stand na de promote alleen iets
   over deze poging, en hoeft er niets te worden opgeruimd dat zelf weer een
   schrijfactie is.

   EN DE HERHALING (de tweede toets, uit de herkeuring): de 503 vraagt om een
   nieuwe poging met dezelfde sleutel. Die mag geen bewaarde 200 krijgen
   (herhaald:true) over iets dat niet staat; hij hoort het werk opnieuw te
   doen. Op 38cdc19d kreeg hij die 200 wel, voor alle drie de sleutelvormen.

   Het deterministische deel staat in test/standbypoort-antwoord.test.js; dit
   bestand bewijst dat de haak in de ECHTE keten zit, voor een echte route.

   Draai los: node --test test/standbypoort-race.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const SLEUTEL = 'toets-clustersleutel';
const VERTRAGINGEN = [0, 5, 15, 30, 60];
const wacht = (ms) => new Promise(r => setTimeout(r, ms));

test('een verzoek dat de afzetting meemaakt, antwoordt nooit 200 over iets dat niet staat', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-n11-race-'));
  const srv = await startServer({ env: { RTG_DATA_DIR: dir, RTG_ROL: 'standby', RTG_CLUSTER_KEY: SLEUTEL } });
  const post = async (pad, body, kop) => {
    const r = await fetch(srv.base + pad, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(kop || {}) },
      body: JSON.stringify(body || {}) });
    return { status: r.status, retry: r.headers.get('retry-after'), body: await r.json().catch(() => ({})) };
  };
  const cluster = (actie) => post('/api/cluster/' + actie, {}, { 'x-rtg-cluster': SLEUTEL });
  const uitslagen = [], breuken = [];
  try {
    for (const [i, ms] of VERTRAGINGEN.entries()) {
      assert.equal((await cluster('promote')).status, 200);
      const reg = await post('/api/auth/register', { name: 'Race Proef', email: 'race' + i + '@voorbeeld.test',
        password: 'geheim12', geboortedatum: '1990-01-01' });
      assert.equal(reg.status, 200, 'registreren als leider: ' + JSON.stringify(reg.body).slice(0, 120));
      const A = { Authorization: 'Bearer ' + reg.body.token };

      const zetBelofte = post('/api/sleutelwoorden/zet', { woorden: ['egel', 'fazant', 'gerbil', 'hamster'] }, A);
      await wacht(ms);
      const demote = await cluster('demote');
      assert.equal(demote.status, 200, 'de demote zelf blijft 200 antwoorden');
      const zet = await zetBelofte;
      assert.equal((await cluster('promote')).status, 200);
      const stand = await post('/api/sleutelwoorden/status', {}, A);
      assert.equal(stand.status, 200);

      const staat = stand.body.gezet === true;
      const uitslag = { ms, zet: zet.status, code: zet.body.code || null, staat };
      uitslagen.push(uitslag);
      t.diagnostic(ms + ' ms: zet ' + zet.status + (zet.body.code ? ' ' + zet.body.code : '') +
        ', na de nieuwe promote ' + (staat ? 'staat het er WEL' : 'staat het er NIET'));

      if (zet.status === 200 && !staat) breuken.push(ms + ' ms: zet antwoordde 200 (' + JSON.stringify(zet.body) +
        ') en na een nieuwe promote staat er niets');
      if (zet.status === 503) {
        assert.equal(zet.retry, '2', 'een 503 zegt wanneer het opnieuw kan');
        assert.match(zet.body.error || '', /stand-by/);
      }
    }
    /* Alle pogingen eerst, dan het oordeel: hoeveel van de vijf er braken zegt
       meer dan alleen de eerste. */
    assert.deepEqual(breuken, [], 'een stille 200 over iets dat niet staat');
    /* Niet leeg geslaagd: minstens een poging moet de afzetting echt midden in
       het verzoek hebben gehad. Anders bewijst een groene uitslag hier niets. */
    const getroffen = uitslagen.filter(u => u.code === 'STANDBY_TIJDENS_VERZOEK').length;
    assert.ok(getroffen >= 1, 'geen enkele poging viel in het venster: ' + JSON.stringify(uitslagen));
  } finally {
    await stop(srv);
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
  }
});

/* De drie vormen waarin een client een sleutel meestuurt. Bij elk ervan hangt
   er in de echte keten minstens een laag op die het antwoord onthoudt: de kop
   bij de idem-poort en de dubbeltik, het lijf bij de dubbeltik en
   middleware/idempotentie. */
const VORMEN = [
  ['kop Idempotency-Key', (k) => ({ kop: { 'Idempotency-Key': k }, lijf: {} })],
  ['lijf idem', (k) => ({ kop: {}, lijf: { idem: k } })],
  ['lijf idempotentieSleutel', (k) => ({ kop: {}, lijf: { idempotentieSleutel: k } })]
];

test('de herhaling waar de 503 om vraagt, doet het werk opnieuw en krijgt geen bewaarde 200', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-n11-herhaal-'));
  const srv = await startServer({ env: { RTG_DATA_DIR: dir, RTG_ROL: 'standby', RTG_CLUSTER_KEY: SLEUTEL } });
  const post = async (pad, body, kop) => {
    const r = await fetch(srv.base + pad, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(kop || {}) },
      body: JSON.stringify(body || {}) });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  };
  const cluster = (actie) => post('/api/cluster/' + actie, {}, { 'x-rtg-cluster': SLEUTEL });
  try {
    for (const [i, [naam, vorm]] of VORMEN.entries()) {
      let geraakt = false;
      /* Zoek een poging die in het venster valt; een vertraging die te laat
         komt, telt niet als bewijs en ook niet als breuk. */
      for (const [j, ms] of VERTRAGINGEN.entries()) {
        assert.equal((await cluster('promote')).status, 200);
        const reg = await post('/api/auth/register', { name: 'Herhaal Proef', email: 'herhaal' + i + '-' + j + '@voorbeeld.test',
          password: 'geheim12', geboortedatum: '1990-01-01' });
        assert.equal(reg.status, 200, 'registreren als leider: ' + JSON.stringify(reg.body).slice(0, 120));
        const A = { Authorization: 'Bearer ' + reg.body.token };
        const { kop, lijf } = vorm('n11-herhaal-' + i + '-' + j);
        const verzoek = { woorden: ['egel', 'fazant', 'gerbil', 'hamster'], ...lijf };

        const zetBelofte = post('/api/sleutelwoorden/zet', verzoek, { ...A, ...kop });
        await wacht(ms);
        assert.equal((await cluster('demote')).status, 200);
        const eerste = await zetBelofte;
        assert.equal((await cluster('promote')).status, 200);
        if (eerste.body.code !== 'STANDBY_TIJDENS_VERZOEK') continue;
        geraakt = true;

        // Dezelfde sleutel, hetzelfde lijf: precies de poging waar de 503 om vraagt.
        const tweede = await post('/api/sleutelwoorden/zet', verzoek, { ...A, ...kop });
        const stand = await post('/api/sleutelwoorden/status', {}, A);
        t.diagnostic(naam + ', ' + ms + ' ms: eerste 503, herhaling ' + tweede.status + ' ' +
          JSON.stringify(tweede.body).slice(0, 60) + ', daarna gezet=' + stand.body.gezet);
        assert.notEqual(tweede.body.herhaald, true,
          naam + ': de herhaling na een 503 kreeg een bewaard antwoord (' + JSON.stringify(tweede.body) + ')');
        assert.equal(tweede.status, 200, naam + ': de herhaling doet het werk gewoon');
        assert.equal(stand.body.gezet, true, naam + ': na een 200 op de herhaling staat het er');
        break;
      }
      assert.ok(geraakt, naam + ': geen enkele poging viel in het venster, dus dit bewijst niets');
    }
  } finally {
    await stop(srv);
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
  }
});

test('een gezonde leider: een POST met Idempotency-Key geeft geen MaxListenersExceededWarning', async () => {
  /* De herstelronde van N11 hing een extra 'finish'-luisteraar aan elk antwoord.
     Met een Idempotency-Key staan idem-poort en dubbeltik er allebei, en dan was
     dat de elfde: een waarschuwing per verzoek op stderr, ook zonder afzetting.
     Dat lijkt op een lek-melding en zou in productie elke regel bevuilen. */
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-standby-luister-'));
  const srv = await startServer({ env: { RTG_DATA_DIR: dir } });
  let stderr = '';
  srv.child.stderr.on('data', (b) => { stderr += b.toString(); });
  try {
    const reg = await (await fetch(srv.base + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Luister Proef', email: 'luister@voorbeeld.test', password: 'geheim12', geboortedatum: '1990-01-01' }) })).json();
    assert.ok(reg.token, 'registratie');
    /* Een muterende route achter idem-poort EN dubbeltik, met de kop. */
    for (let i = 1; i <= 3; i++) {
      const r = await fetch(srv.base + '/api/sleutelwoorden/zet', { method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + reg.token, 'Idempotency-Key': 'luister-sleutel-' + i },
        body: JSON.stringify({ woorden: ['egel', 'fazant', 'gerbil', 'hamster'] }) });
      assert.equal(r.status, 200, 'zet ' + i);
    }
    /* De waarschuwing komt via stderr ACHTER het antwoord aan. Wacht dus tot die
       stroom drie rondes achter elkaar niet meer groeit: een toestand (rust),
       geen vaste tijd. */
    for (let rustig = 0, vorige = -1, i = 0; rustig < 3 && i < 100; i++) {
      rustig = stderr.length === vorige ? rustig + 1 : 0;
      vorige = stderr.length;
      await wacht(50);
    }
    assert.doesNotMatch(stderr, /MaxListenersExceededWarning/, 'geen waarschuwing over te veel luisteraars');
  } finally {
    await stop(srv);
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
  }
});
