/* ============================================================================
   EEN SERVER DIE WACHT OP ZIJN DATABASE, IN PLAATS VAN VOORGOED OP 503.

   In de Postgres-stand houdt de opslagpoortwachter ELKE API tegen met 503 tot
   de opslag echt geladen is -- terecht: liever niets serveren dan verkeerde
   data. Maar het aanzetten van die opslag gebeurde een keer, met een .catch die
   de fout logde en verder niets deed. Was de database bij het opstarten even
   niet bereikbaar -- een herstart, een netwerkhikje, een container die net iets
   eerder start dan zijn database -- dan bleef die instance voorgoed op 503
   staan. Niet een storing van een halve minuut, maar een storing tot iemand
   kijkt. En juist bij het opstarten van een heel cluster tegelijk is dat het
   moment waarop het gebeurt.

   Wat deze toets doet: de server starten met een DATABASE_URL die naar een
   database wijst die nog NIET bestaat, controleren dat hij netjes dichtblijft
   (503, geen halve waarheid en geen crash), en dan de database aanmaken. Hij
   hoort er vanzelf bovenop te komen -- zonder herstart.

   Draai:  DATABASE_URL=postgresql://postgres@127.0.0.1:5433/rtgtest \
           node --experimental-sqlite --test test/pg-wachten.test.js
   ========================================================================== */
/* LET OP -- deze toets maakt en dropt een EIGEN database (naam met achtervoegsel
   -wacht) en raakt de database uit DATABASE_URL alleen om die aan te maken. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const BRON = process.env.DATABASE_URL || process.env.PG_URL || '';
const OVERSLAAN = BRON ? false : 'geen DATABASE_URL: het wachten op Postgres bestaat alleen in de Postgres-stand';
const wacht = ms => new Promise(r => setTimeout(r, ms));

test('een onbereikbare database bij de start is tijdelijk, geen dode instance',
  { skip: OVERSLAAN }, async () => {
  const { maakPg } = require('../server/pg');
  const u = new URL(BRON);
  const NAAM = 'rtgwacht' + Date.now().toString(36);
  const doel = new URL(BRON); doel.pathname = '/' + NAAM;

  // een verbinding naar de BESTAANDE database, om de nieuwe straks aan te maken
  const beheer = maakPg({ merge3: (a, b) => b, kluis: require('../server/kluis'), log: { warn() {} }, url: BRON });
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-pgwacht-'));
  let srv = null;
  try {
    /* De server start met een database die niet bestaat. wachtPad op /api/health,
       want /api/ready is precies wat hier (terecht) dicht staat. */
    srv = await startServer({ wachtPad: '/api/health', env: {
      SMTP_URL: '', RTG_DATA_DIR: TMP, DATABASE_URL: doel.toString(), PG_HERKANS_MS: '300'
    } });

    // 1. hij leeft, en hij houdt de deur dicht
    const gezond = await fetch(srv.base + '/api/health').then(r => r.json());
    assert.equal(gezond.pid, srv.child.pid, 'de server draait gewoon');
    const dicht = await fetch(srv.base + '/api/ready');
    assert.equal(dicht.status, 503, 'en laat niets door zolang de opslag er niet is');
    const api = await fetch(srv.base + '/api/state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(api.status, 503, 'ook de gewone API blijft dicht -- geen halve waarheid uit een lege kast');

    // 2. laat hem een paar herkansingen doen; hij hoort niet op te geven
    await wacht(1500);
    assert.equal(srv.child.exitCode, null, 'de server heeft zichzelf niet beeindigd');

    // 3. en nu komt de database er
    await beheer.pool.query('CREATE DATABASE ' + NAAM);

    /* DE BEWERING DIE ERTOE DOET. Zonder herstart, zonder handeling van
       buiten: de instance komt er vanzelf bovenop. Ruim de tijd geven -- de
       pauzes verdubbelen -- maar niet oneindig. */
    let klaar = false;
    for (let i = 0; i < 60 && !klaar; i++) {
      await wacht(500);
      klaar = (await fetch(srv.base + '/api/ready').catch(() => ({ status: 0 }))).status === 200;
    }
    assert.equal(klaar, true, 'de server pakte de database op zodra die er was, zonder herstart');

    // en hij doet dan ook echt zijn werk
    const reg = await fetch(srv.base + '/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Geduld', email: 'g' + Date.now().toString(36) + '@voorbeeld.test',
        phone: '06' + String(10000000 + Math.floor(Math.random() * 8e7)), password: 'Geheim123!',
        geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })
    });
    assert.equal(reg.status, 200, 'en bedient daarna gewoon verkeer');
  } finally {
    stop(srv && srv.child);
    await wacht(300);
    try { await beheer.pool.query('DROP DATABASE IF EXISTS ' + NAAM); } catch (e) {}
    try { await beheer.pool.end(); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
