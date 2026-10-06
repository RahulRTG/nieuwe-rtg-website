/* ============================================================================
   EEN VERZOEK DAT ONDERWEG WAS TOEN DE SERVER WERD AFGEZET -- de race van N11
   uit de V1-audit, tegen een echte server.

   DE FOUT: POST /api/sleutelwoorden/zet verstuurd, een paar milliseconden
   later POST /api/cluster/demote. zet hasht vier woorden (een paar honderd ms)
   en roept pas daarna save() aan; die keerde stil terug omdat het proces niet
   meer schreef, en het antwoord was 200 met gezet:true. Na een nieuwe promote
   stond er gezet:false. Op de basis gaf dit zes van de zes keer 200.

   DE INVARIANT, per poging: NOOIT 200 terwijl er na een nieuwe promote niets
   staat. Een 503 mag, en dan mag het er wel of niet staan -- dat wordt
   genoteerd en niet beoordeeld, want de tekst van de 503 zegt juist dat het
   niet vaststaat.

   ELKE POGING EEN EIGEN ACCOUNT: dan zegt de stand na de promote alleen iets
   over deze poging, en hoeft er niets te worden opgeruimd dat zelf weer een
   schrijfactie is.

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
