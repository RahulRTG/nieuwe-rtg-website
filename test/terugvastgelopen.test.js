/* Een vastgelopen terugbetaling staat op de kantoorlijst, en een mens op naam
   handelt hem af (kern/betaalwaarheid/terugveeg.js, kern/betaalregie.js,
   routes/kantoren/betaalproviders.js, apps/kantoren-terugbetaling.js).

   Na de veegronde voor terugbetalingen stond een geescaleerde terugbetaling
   alleen in openstaand() en in de gebeurtenissen; geen scherm toonde hem.
   Eigenaarsbesluit van 19 oktober 2026: hij komt op de bestaande lijst van de
   betaalkamer (Financien), als de regel "terugbetaling vastgelopen", met een
   knop om af te handelen door een mens op naam. Geen nieuw scherm.

   Afhandelen is vastleggen wat de mens bij de provider zag: het geld is terug
   (dan telt de terugbetaling, precies een keer) of het is niet terug (dan gaat
   hij naar controle, zonder boeking). Met naam, tijd en reden; de gedeelde
   kantoorcode is geen mens. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const synthetisch = require('../server/betaal/synthetisch');
const maakOntvangst = require('../server/betaal/ontvangst');
const maakBetaalWaarheid = require('../server/kern/betaalwaarheid');
const maakBetaalregie = require('../server/kern/betaalregie');
const { WACHT_MS } = require('../server/kern/betaalwaarheid/terugveeg');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');

const AAN = { RTG_SIMULATIEBANK: '1', NODE_ENV: 'test' };
const h = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

/* een betaling, een stille terugbetaling, en de veegronde tot de escalatie */
async function vastgelopen() {
  const klok = { nu: Date.parse('2026-10-19T09:00:00Z') };
  const sim = synthetisch({ crypto, env: AAN, echteRail: null, nu: () => klok.nu });
  const opslag = new Map();
  const betaal = maakOntvangst({ crypto, standaard: 'simulatie', get: (k) => opslag.get(k), set: (k, v) => opslag.set(k, v),
    env: AAN, uit: false, simulatie: sim, vrijgave: { eis: () => {} } });
  const data = {};
  const nu = () => new Date(klok.nu).toISOString();
  const bw = maakBetaalWaarheid({ d: () => data, save: () => {}, crypto, betaal, nu });
  bw.registreerAfhandeling('proef', async () => {});
  let r;
  for (let i = 0; i < 2000 && !r; i++) {
    const idem = 'b' + i;
    const id = 'BW-' + h('lid:x|' + idem).slice(0, 20).toUpperCase();
    if (sim.scenarioVan({ idempotentieSleutel: 'waarheid:' + id }) !== 'betaald') continue;
    r = bw.maak({ actor: 'lid:x', soort: 'proef', idem, centen: 2500, valuta: 'eur' });
    await bw.begin(r.id, { aanbieder: 'simulatie' });
  }
  for (let i = 0; !r.terugbetaalOpdrachten; i++) {
    const idem = 't' + i;
    const sleutel = 'terug:' + r.id + ':' + h('idem:' + h(idem)).slice(0, 24);
    if (sim.terugScenarioVan({ idempotentieSleutel: sleutel }) === 'stil') await bw.terugbetalen(r.id, { centen: 2500, idem, reden: 'herroepen' });
  }
  for (let i = 0; i < WACHT_MS.length + 1; i++) { klok.nu += 25 * 3600 * 1000; await bw.ronde({ tot: klok.nu }); }
  const op = r.terugbetaalOpdrachten[0];
  assert.ok(op.escalatie, 'de veegronde escaleerde');
  const regie = maakBetaalregie({ d: () => data, save: () => {}, betaal, env: AAN, nu });
  return { bw, r, op, regie };
}

test('een vastgelopen terugbetaling staat als eigen regel op de lijst van de betaalkamer, met wat de knop nodig heeft', async () => {
  const w = await vastgelopen();
  const regels = w.regie.overzicht().problemen.filter((p) => p.code === 'TERUGBETALING-VASTGELOPEN');
  assert.equal(regels.length, 1);
  assert.match(regels[0].tekst, /^Terugbetaling vastgelopen/);
  assert.match(regels[0].tekst, /25,00/);
  assert.equal(regels[0].betalingId, w.r.id);
  assert.equal(regels[0].opdrachtId, w.op.id);
  assert.equal(regels[0].ernst, 'kritiek');
});

test('een mens op naam handelt hem af: het geld is terug, en dat telt precies een keer', async () => {
  const w = await vastgelopen();
  assert.equal((await w.bw.terugAfhandelen({ betalingId: w.r.id, opdrachtId: w.op.id, uitkomst: 'terug', reden: 'gezien in het providerdashboard' })).status, 403,
    'zonder naam gebeurt er niets');
  assert.equal((await w.bw.terugAfhandelen({ betalingId: w.r.id, opdrachtId: w.op.id, uitkomst: 'terug', door: 'user-7', reden: 'kort' })).status, 400,
    'een reden van een paar letters is geen reden');
  const r = await w.bw.terugAfhandelen({ betalingId: w.r.id, opdrachtId: w.op.id, uitkomst: 'terug', door: 'user-7',
    reden: 'gezien in het providerdashboard: refund voltooid' });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(w.r.status, 'TERUGBETAALD');
  assert.equal(w.r.terugbetaaldCenten, 2500);
  assert.equal(w.op.mens.door, 'user-7');
  assert.ok(w.r.gebeurtenissen.some((g) => g.soort === 'TERUGBETALING_DOOR_MENS'));
  const nog = await w.bw.terugAfhandelen({ betalingId: w.r.id, opdrachtId: w.op.id, uitkomst: 'terug', door: 'user-8',
    reden: 'nog een keer, door een collega' });
  assert.equal(nog.status, 409, 'een tweede afhandeling boekt niets');
  assert.equal(w.r.terugbetaaldCenten, 2500);
  assert.equal(w.regie.overzicht().problemen.filter((p) => p.code === 'TERUGBETALING-VASTGELOPEN').length, 0, 'en hij staat niet meer op de lijst');
});

test('het geld is niet terug: geen boeking, en de betaling gaat naar controle', async () => {
  const w = await vastgelopen();
  const r = await w.bw.terugAfhandelen({ betalingId: w.r.id, opdrachtId: w.op.id, uitkomst: 'niet-terug', door: 'user-7',
    reden: 'provider meldt: refund geweigerd door de bank' });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(w.r.terugbetaaldCenten || 0, 0);
  assert.equal(w.r.status, 'CONTROLE_NODIG');
  assert.equal(w.r.blokkade, 'terugbetaling-mislukt');
});

test('de route: zonder inlog niets, de gedeelde kantoorcode is geen mens, een kantoormens op naam komt erdoor', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-terugvast-'));
  const CODE = 'KANTOOR-TERUG-1';
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: CODE } });
  try {
    const pad = srv.base + '/api/office/betalingen/terug/afhandel';
    const post = (tok, body) => fetch(pad, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' },
      tok ? { Authorization: 'Bearer ' + tok } : {}), body: JSON.stringify(body || {}) })
      .then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));
    const body = { betalingId: 'BW-BESTAATNIET', opdrachtId: 'TR-X', uitkomst: 'terug', reden: 'gezien in het providerdashboard' };
    assert.equal((await post(null, body)).status, 401);
    const code = await (await fetch(srv.base + '/api/office/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: CODE }) })).json();
    const gedeeld = await post(code.token, body);
    assert.equal(gedeeld.status, 403, JSON.stringify(gedeeld.body));
    const mens = await kantoorAlsPersoon(srv.base, CODE);
    assert.ok(mens, 'een kantoormens op naam');
    const r = await post(mens, body);
    assert.equal(r.status, 404, JSON.stringify(r.body));
  } finally { await stop(srv); }
});
