/* Een tweede ticket onder dezelfde betaling, door de assetlaag heen
   (server/kern/assets/aanvraag-betaal.js, kern/betaalwaarheid/controle.js).

   Vraag van LivingOS-A: een aanvraag met meer tickets is EEN betaling. Weigert
   de bank de terugbetaling van het ene ticket, dan staat de hele betaling op
   controle (kop van kern/betaalwaarheid/terug.js), en de herroeping van het
   tweede ticket gaf daarna voor altijd 409. Sinds het eigenaarsbesluit van 19
   oktober 2026 (derde reeks) rondt een mens op naam de controle af, op de
   regel "Betaling op controle" van de betaalkamer; daarna gaat het tweede
   ticket terug. De kerntoets staat in test/controleafronden.test.js; deze loopt
   de hele weg met de echte routes en de simulatiebank. Alleen de twee
   terugbetalingsscenario’s worden in de geïsoleerde testserver vastgezet;
   autorisatie, betaalwaarheid en providerafhandeling blijven echt. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');
const assetkoop = require('./lib/assetkoop');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-assets-controle-'));
const CODE = 'KANTOOR-ASSETS-CONTROLE';
let srv, base, zakelijk, opNaam, gedeeld;
const api = (pad, body, t) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, t ? { Authorization: 'Bearer ' + t } : {}),
  body: JSON.stringify(body || {})
}).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  // De oude fixture kocht maximaal 60 willekeurige tickets en hoopte op een
  // weigering (7% per ticket). Dat faalt circa 1,3% van de runs vóór de proef.
  // Injecteer de scenariofunctie in de bestaande provider, alleen in dit kindproces.
  const naslag = require.resolve('../server/betaal/synthetisch-naslag');
  const script = path.join(TMP, 'controle-server.cjs');
  fs.writeFileSync(script, `
    const pad = ${JSON.stringify(naslag)};
    const origineel = require(pad);
    const scenarioPerSleutel = new Map();
    require.cache[pad].exports = Object.assign(function (ctx) {
      return origineel({ ...ctx, scenarioVan(o) {
        const sleutel = o.idempotentieSleutel;
        if (!scenarioPerSleutel.has(sleutel)) scenarioPerSleutel.set(sleutel,
          scenarioPerSleutel.size === 0 ? 'geweigerd' : 'betaald');
        return scenarioPerSleutel.get(sleutel);
      } });
    }, origineel);
    require(${JSON.stringify(require.resolve('../server/server'))});
  `);
  srv = await startServer({ script, env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_SIMULATIEBANK: '1', OFFICE_CODE: CODE } });
  base = srv.base;
  zakelijk = (await api('login', { tier: 'business' })).body.token;
  opNaam = await kantoorAlsPersoon(base, CODE);
  gedeeld = (await api('office/login', { code: CODE })).body.token;
  assert.ok(zakelijk && opNaam && gedeeld);
});
test.after(async () => {
  await stop(srv);
  fs.rmSync(TMP, { recursive: true, force: true });
});

test('na een geweigerde terugbetaling gaat het tweede ticket pas terug als een mens op naam de controle afrondt', async () => {
  const villa = (await api('assets', {}, zakelijk)).body.assets.find((a) => a.soort === 'villa');
  const k = await assetkoop.gekocht(api, { token: zakelijk, pas: 'business', opNaam,
    body: { assetId: villa.id, smaak: 'access', aantal: 2 } });
  assert.equal(k.status, 200, JSON.stringify(k.body));
  assert.equal(k.body.ticketIds.length, 2);
  const [geweigerd, betaald] = k.body.ticketIds;

  const eerste = await api('asset/herroep', { ticketId: geweigerd }, zakelijk);
  assert.equal(eerste.status, 409, JSON.stringify(eerste.body));
  assert.match(eerste.body.error, /ter controle/);

  const zonder = await api('asset/herroep', { ticketId: betaald }, zakelijk);
  assert.equal(zonder.status, 409, 'zonder afronden: het tweede ticket gaat niet terug (' + JSON.stringify(zonder.body) + ')');

  /* de betaalkamer toont de betaling als regel met een knop */
  const regel = (await api('office/betalingen/status', {}, opNaam)).body.problemen
    .find((p) => p.code === 'BETALING-OP-CONTROLE');
  assert.ok(regel, 'de regel "Betaling op controle" staat op de lijst');
  const body = { betalingId: regel.betalingId, reden: 'met het lid gebeld; kaart vervangen, het tweede ticket mag terug' };
  assert.equal((await api('office/betalingen/controle/afrond', body, gedeeld)).status, 403, 'de gedeelde kantoorcode is geen mens');
  const af = await api('office/betalingen/controle/afrond', body, opNaam);
  assert.equal(af.status, 200, JSON.stringify(af.body));

  const na = await api('asset/herroep', { ticketId: betaald }, zakelijk);
  assert.equal(na.status, 200, JSON.stringify(na.body));
  assert.ok(na.body.terug > 0, 'het tweede ticket is terugbetaald');
  const nog = await api('asset/herroep', { ticketId: geweigerd }, zakelijk);
  assert.equal(nog.status, 409, 'het geweigerde ticket blijft bij de controle staan');
});
