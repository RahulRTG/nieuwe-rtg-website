/* Een tweede ticket onder dezelfde betaling, door de assetlaag heen
   (server/kern/assets/aanvraag-betaal.js, kern/betaalwaarheid/controle.js).

   Vraag van LivingOS-A: een aanvraag met meer tickets is EEN betaling. Weigert
   de bank de terugbetaling van het ene ticket, dan staat de hele betaling op
   controle (kop van kern/betaalwaarheid/terug.js), en de herroeping van het
   tweede ticket gaf daarna voor altijd 409. Sinds het eigenaarsbesluit van 19
   oktober 2026 (derde reeks) rondt een mens op naam de controle af, op de
   regel "Betaling op controle" van de betaalkamer; daarna gaat het tweede
   ticket terug. De kerntoets staat in test/controleafronden.test.js; deze loopt
   de hele weg met de echte routes en de simulatiebank, en kiest de afloop met
   test/lib/assetkoop.js#terugAfloop. */
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
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_SIMULATIEBANK: '1', OFFICE_CODE: CODE } });
  base = srv.base;
  zakelijk = (await api('login', { tier: 'business' })).body.token;
  opNaam = await kantoorAlsPersoon(base, CODE);
  gedeeld = (await api('office/login', { code: CODE })).body.token;
  assert.ok(zakelijk && opNaam && gedeeld);
});
test.after(async () => { await stop(srv); });

test('na een geweigerde terugbetaling gaat het tweede ticket pas terug als een mens op naam de controle afrondt', async () => {
  const villa = (await api('assets', {}, zakelijk)).body.assets.find((a) => a.soort === 'villa');
  /* een aanvraag van vijf tickets waarin de bank er een weigert en een ander betaalt */
  let aanvraag, geweigerd, betaald;
  for (let poging = 0; poging < 12 && !(geweigerd && betaald); poging++) {
    const k = await assetkoop.gekocht(api, { token: zakelijk, pas: 'business', opNaam,
      body: { assetId: villa.id, smaak: 'access', aantal: 5 } });
    assert.equal(k.status, 200, JSON.stringify(k.body));
    aanvraag = k.body.aanvraag;
    const afloop = (id) => assetkoop.terugAfloop('business', aanvraag.id, id);
    geweigerd = k.body.ticketIds.find((id) => afloop(id) === 'geweigerd');
    betaald = k.body.ticketIds.find((id) => afloop(id) === 'betaald');
  }
  assert.ok(geweigerd && betaald, 'een aanvraag met een geweigerde en een betaalde terugbetaling');

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
