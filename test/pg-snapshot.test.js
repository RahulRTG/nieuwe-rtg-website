/* ============================================================================
   DE REM OP DE LOKALE SNAPSHOT ZAT MAAR OP EEN VAN DE TWEE PADEN.

   In de Postgres-stand is Postgres de duurzame waarheid en is db.json alleen
   een warme-start-cache. Die cache volledig wegschrijven kost een
   JSON.stringify van de HELE datastore, versleuteld, met een fsync op bestand
   en map -- synchroon, op de event-loop. Daarom staat er boven de teller in
   server/db/postgres.js: ten hoogste eens per PG_SNAP_MS (standaard vijf
   minuten).

   In flushNu stond die controle ook echt. In de LISTEN/NOTIFY-luisteraar niet:
   die deed `.then(schrijfLokaleSnapshotStil)`, onvoorwaardelijk, bij elke
   melding. En meldingen komen per weggeschreven collectie per flush-ronde
   (elke 150 ms; voor de geld-sleutels elke 60), ook van je eigen instance --
   de luisteraar hangt aan een eigen verbinding en hoort dus zijn eigen NOTIFY.
   Wat het commentaar belooft te voorkomen, gebeurde daardoor meerdere keren
   per seconde, en de p99 van elk verzoek hing eraan: inloggen en betalen
   inbegrepen.

   Wat deze toets vastlegt: onder aanhoudend schrijfverkeer wordt db.json
   binnen het venster HOOGUIT EEN keer geschreven. Niet nul (de cache moet er
   komen), niet bij elke melding.

   Draai:  DATABASE_URL=postgresql://postgres@127.0.0.1:5433/rtgtest \
           node --experimental-sqlite --test test/pg-snapshot.test.js
   ========================================================================== */
/* LET OP -- deze toets vraagt de database VOOR ZICHZELF (zie leden-gids-pg). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const HEEFT_PG = !!(process.env.DATABASE_URL || process.env.PG_URL);
const OVERSLAAN = HEEFT_PG ? false : 'geen DATABASE_URL: de snapshot-rem bestaat alleen in de Postgres-stand';

function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
const wacht = ms => new Promise(r => setTimeout(r, ms));

test('de lokale snapshot wordt binnen het venster hoogstens een keer geschreven',
  { skip: OVERSLAAN }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-pgsnap-'));
  const SNAP = path.join(TMP, 'db.json');
  /* Het venster staat ruim (twee minuten): binnen deze toets hoort er dus
     NA de eerste geen tweede meer bij te komen. Zou de rem alleen "te kort"
     staan, dan zakt dit niet -- daarom een venster dat de looptijd ruim
     overspant. */
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, PG_SNAP_MS: '120000' } });
  try {
    /* WACHTEN TOT DE SNAPSHOT VAN HET OPSTARTEN IS UITGERAASD, en niet 1500 ms
       gokken. De eerste flush schrijft er een; zolang de mtime nog beweegt is
       het opstarten bezig, en dan zou `voor` hieronder een moment vastleggen
       waar nog een schrijfactie achteraan komt -- die telt dan mee als de
       "tweede snapshot" die er juist niet mag zijn.

       Stil is hier: het bestand bestaat en zijn mtime is drie keer op rij
       hetzelfde. */
    let voor = 0;
    {
      const eind = Date.now() + 20000;
      let vorige = -1, stil = 0;
      for (;;) {
        const nu = fs.existsSync(SNAP) ? fs.statSync(SNAP).mtimeMs : 0;
        stil = (nu > 0 && nu === vorige) ? stil + 1 : 0;
        vorige = nu;
        if (stil >= 3) { voor = nu; break; }
        if (Date.now() >= eind) throw new Error('de warme cache kwam niet tot rust binnen 20 s (mtime ' + nu + ')');
        await wacht(100);
      }
    }

    /* Aanhoudend schrijfverkeer: elke registratie zet meerdere collecties vuil,
       elke flush-ronde stuurt per collectie een NOTIFY, en elke NOTIFY schreef
       vroeger een volledige snapshot. Vijftien rondes over ~3 seconden is
       ruim voorbij de flush-cyclus van 150 ms. */
    for (let i = 0; i < 15; i++) {
      const u = Date.now().toString(36) + i;
      await api(srv.base, '/api/auth/register', { name: 'Snap ' + u, email: 's' + u + '@voorbeeld.test',
        phone: '06' + String(10000000 + Math.floor(Math.random() * 8e7)), password: 'Geheim' + u + '!',
        geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
      await wacht(200);
    }
    /* HIER BLIJFT EEN WACHT STAAN, en dat is een besluit. De bewering hieronder
       gaat over iets dat NIET gebeurt: er is geen tweede snapshot bij gekomen.
       Op een afwezigheid kun je niet wachten; deze seconde is de ruimte waarin
       een losgeslagen luisteraar zich zou verraden -- ruim voorbij de
       flush-cyclus van 150 ms. Zie KLOKWACHT.json. */
    await wacht(1000);

    /* DE BEWERING. Er is in dit venster hooguit EEN snapshot bij gekomen.
       Zonder de rem op de luisteraar zijn het er tientallen -- elke melding
       een. De mtime is daarvoor genoeg bewijs: bleef hij staan, dan is er
       niets herschreven. */
    const na = fs.existsSync(SNAP) ? fs.statSync(SNAP).mtimeMs : 0;
    assert.ok(na > 0, 'de warme cache bestaat (de rem is geen uit-knop)');
    assert.equal(na, voor, 'binnen het venster is db.json niet opnieuw geschreven (' + voor + ' -> ' + na + ')');

    // en de toets mag niet vacuous slagen: er is echt geschreven verkeer geweest
    const st = await fetch(srv.base + '/api/health').then(r => r.json()).catch(() => ({}));
    assert.ok(st, 'de server draaide de hele tijd door');
  } finally {
    stop(srv && srv.child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
