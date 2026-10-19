/* Een betaling op controle wordt afgerond door een mens op naam
   (kern/betaalwaarheid/controle.js, routes/kantoren/betaalproviders.js).

   Een geweigerde terugbetaling zet de HELE betaling op CONTROLE_NODIG, met
   opzet (kop van kern/betaalwaarheid/terug.js): daarna gaat er niets meer
   terug, ook geen tweede ticket onder dezelfde betaling, tot een mens keek.
   Maar uit die stand bestond geen weg: CONTROLE_NODIG heeft in staten.js geen
   enkele uitgaande overgang, en ook de mens kon niets. Het tweede ticket bleef
   voor altijd op 409. Eigenaarsbesluit van 19 oktober 2026 (derde reeks): een
   mens op naam rondt de controle af, met een reden, en zet de betaling terug
   op de laatste definitieve stand voor de controle. naar() maakt die overgang
   nooit automatisch, en de geweigerde opdracht zelf blijft CONTROLE_NODIG. */
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
const { OVERGANGEN, mag } = require('../server/kern/betaalwaarheid/staten');
const { WACHT_MS } = require('../server/kern/betaalwaarheid/terugveeg');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');

const AAN = { RTG_SIMULATIEBANK: '1', NODE_ENV: 'test' };
const h = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

async function wereld() {
  const klok = { nu: Date.parse('2026-10-19T09:00:00Z') };
  const sim = synthetisch({ crypto, env: AAN, echteRail: null, nu: () => klok.nu });
  const opslag = new Map();
  const betaal = maakOntvangst({ crypto, standaard: 'simulatie', get: (k) => opslag.get(k), set: (k, v) => opslag.set(k, v),
    env: AAN, uit: false, simulatie: sim, vrijgave: { eis: () => {} } });
  const data = {};
  const nu = () => new Date(klok.nu).toISOString();
  const bw = maakBetaalWaarheid({ d: () => data, save: () => {}, crypto, betaal, nu });
  bw.registreerAfhandeling('proef', async () => {});
  const regie = maakBetaalregie({ d: () => data, save: () => {}, betaal, env: AAN, nu });
  /* een terugbetaling van 2500 met de gevraagde afloop, op een idem met dit merk */
  const terug = async (r, afloop, merk) => {
    for (let i = 0; i < 4000; i++) {
      const idem = merk + i;
      const sleutel = 'terug:' + r.id + ':' + h('idem:' + h(idem)).slice(0, 24);
      if (sim.terugScenarioVan({ idempotentieSleutel: sleutel }) === afloop) return bw.terugbetalen(r.id, { centen: 2500, idem, reden: 'ticket' });
    }
    throw new Error('geen sleutel voor ' + afloop);
  };
  return { sim, bw, data, klok, regie, terug };
}

/* een betaling van twee tickets (5000), en het eerste ticket gaat mis: stil,
   geescaleerd, en de mens zag bij de provider dat het geld niet terug is */
async function opControle(w) {
  let r;
  for (let i = 0; i < 2000 && !r; i++) {
    const idem = 'b' + i;
    const id = 'BW-' + h('lid:x|' + idem).slice(0, 20).toUpperCase();
    if (w.sim.scenarioVan({ idempotentieSleutel: 'waarheid:' + id }) !== 'betaald') continue;
    r = w.bw.maak({ actor: 'lid:x', soort: 'proef', idem, centen: 5000, valuta: 'eur' });
    await w.bw.begin(r.id, { aanbieder: 'simulatie' });
  }
  await w.terug(r, 'stil', 'een');
  for (let i = 0; i < WACHT_MS.length + 1; i++) { w.klok.nu += 25 * 3600 * 1000; await w.bw.ronde({ tot: w.klok.nu }); }
  const op = r.terugbetaalOpdrachten[0];
  const af = await w.bw.terugAfhandelen({ betalingId: r.id, opdrachtId: op.id, uitkomst: 'niet-terug', door: 'user-7',
    reden: 'provider: refund geweigerd door de bank' });
  assert.equal(af.ok, true, JSON.stringify(af));
  assert.equal(r.status, 'CONTROLE_NODIG');
  return { r, op };
}

test('zonder afronden gaat het tweede ticket niet terug; na afronden door een mens op naam wel, en de geweigerde opdracht blijft op controle', async () => {
  const w = await wereld();
  const { r, op } = await opControle(w);
  await assert.rejects(() => w.terug(r, 'bevestigd', 'twee'), /bevestigd geld/, 'zonder afronden: niets');

  const af = await w.bw.controleAfronden({ betalingId: r.id, door: 'user-8', reden: 'met het lid gebeld; kaart vervangen, tweede ticket mag terug' });
  assert.equal(af.ok, true, JSON.stringify(af));
  assert.equal(r.status, 'BEVESTIGD', 'de laatste definitieve stand voor de controle');
  assert.equal(op.status, 'CONTROLE_NODIG', 'de geweigerde opdracht zelf blijft staan');
  assert.equal(r.controleAfgerond.door, 'user-8');
  assert.ok(r.gebeurtenissen.some((g) => g.soort === 'CONTROLE_AFGEROND'));

  await w.terug(r, 'bevestigd', 'twee');
  assert.equal(r.terugbetaaldCenten, 2500, 'het tweede ticket gaat terug, een keer');
  assert.equal(r.status, 'GEDEELTELIJK_TERUGBETAALD');
});

test('naar() maakt de overgang nooit automatisch: elke andere weg uit CONTROLE_NODIG zakt', async () => {
  assert.deepEqual(OVERGANGEN.CONTROLE_NODIG, [], 'geen uitgaande overgang in de statenmachine');
  for (const s of Object.keys(OVERGANGEN)) if (s !== 'CONTROLE_NODIG') assert.equal(mag('CONTROLE_NODIG', s), false, s);
  const w = await wereld();
  const { r } = await opControle(w);
  /* een provider die alsnog "betaald" meldt, of een veegronde, haalt hem er niet uit */
  await w.bw.providerMelding({ eventId: 'laat-1', aanbieder: 'simulatie', providerId: r.providerId, referentie: r.id,
    status: 'betaald', bedrag: 5000, valuta: 'eur' });
  w.klok.nu += 48 * 3600 * 1000; await w.bw.ronde({ tot: w.klok.nu });
  await w.bw.begin(r.id, {}).catch(() => {});
  assert.equal(r.status, 'CONTROLE_NODIG');
});

test('afronden vraagt een naam en een reden, gebeurt een keer, en kan niet waar nooit geld binnenkwam', async () => {
  const w = await wereld();
  const { r } = await opControle(w);
  assert.equal((await w.bw.controleAfronden({ betalingId: r.id, reden: 'met het lid gebeld en nagekeken' })).status, 403);
  assert.equal((await w.bw.controleAfronden({ betalingId: r.id, door: 'user-8', reden: 'kort' })).status, 400);
  assert.equal((await w.bw.controleAfronden({ betalingId: 'BW-NIET', door: 'user-8', reden: 'met het lid gebeld en nagekeken' })).status, 404);
  assert.equal((await w.bw.controleAfronden({ betalingId: r.id, door: 'user-8', reden: 'met het lid gebeld en nagekeken' })).ok, true);
  assert.equal((await w.bw.controleAfronden({ betalingId: r.id, door: 'user-9', reden: 'nog een keer, door een collega' })).status, 409);

  /* een betaling die nooit bevestigd was (het bedrag week af bij de start) heeft geen definitieve stand om naar terug te gaan */
  const n = w.bw.maak({ actor: 'lid:y', soort: 'proef', idem: 'nooit', centen: 1000, valuta: 'eur' });
  await w.bw.providerMelding({ eventId: 'afwijk-1', aanbieder: 'simulatie', providerId: 'sim_betaald_x', referentie: n.id,
    status: 'betaald', bedrag: 999, valuta: 'eur' });
  assert.equal(w.bw.van(n.id).status, 'CONTROLE_NODIG');
  assert.equal((await w.bw.controleAfronden({ betalingId: n.id, door: 'user-8', reden: 'met het lid gebeld en nagekeken' })).status, 409);
});

test('de betaalkamer toont een betaling op controle met wat de knop nodig heeft, en na afronden niet meer', async () => {
  const w = await wereld();
  const { r } = await opControle(w);
  const regels = () => w.regie.overzicht().problemen.filter((p) => p.code === 'BETALING-OP-CONTROLE');
  assert.equal(regels().length, 1);
  assert.equal(regels()[0].betalingId, r.id);
  assert.match(regels()[0].tekst, /50,00/);
  await w.bw.controleAfronden({ betalingId: r.id, door: 'user-8', reden: 'met het lid gebeld en nagekeken' });
  assert.equal(regels().length, 0);
});

test('de route: zonder inlog niets, de gedeelde kantoorcode is geen mens, een kantoormens op naam komt erdoor', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-controle-'));
  const CODE = 'KANTOOR-CONTROLE-1';
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: CODE } });
  try {
    const post = (tok, body) => fetch(srv.base + '/api/office/betalingen/controle/afrond', { method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
      body: JSON.stringify(body || {}) }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));
    const body = { betalingId: 'BW-BESTAATNIET', reden: 'met het lid gebeld en nagekeken' };
    assert.equal((await post(null, body)).status, 401);
    const code = await (await fetch(srv.base + '/api/office/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: CODE }) })).json();
    assert.equal((await post(code.token, body)).status, 403);
    const mens = await kantoorAlsPersoon(srv.base, CODE);
    assert.ok(mens);
    const r = await post(mens, body);
    assert.equal(r.status, 404, JSON.stringify(r.body));
  } finally { await stop(srv); }
});
