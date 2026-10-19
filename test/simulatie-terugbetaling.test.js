/* De simulatiebank kan terugbetalen en opzoeken (server/betaal/naslag.js,
   server/betaal/synthetisch.js).

   Gevonden door LivingOS-A bij de asset-koop: naslag.js kende de aanbieder
   'simulatie' niet. Een herroeping na een simulatiebetaling bleef daardoor
   eeuwig op "terugbetaling loopt" staan, en een trage simulatiebetaling kon de
   veegronde niet opzoeken: zes hervattingen met dezelfde fout en dan een
   escalatie voor een mens, voor een betaling die per definitie nooit komt.

   Nu: terugbetalen met de afloop bevestigd, geweigerd of traag (uit de sleutel,
   zoals de rest van de simulatiebank), en opzoeken geeft de stand van de
   betaling; een trage betaling verloopt na VERLOOP_MS, zoals een open betaling
   bij een echte provider verloopt. Alleen met de vlag, nooit in productie.
   Hier met de echte betaalwaarheid en de echte ontvangst- en naslaglaag. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const synthetisch = require('../server/betaal/synthetisch');
const maakOntvangst = require('../server/betaal/ontvangst');
const maakBetaalWaarheid = require('../server/kern/betaalwaarheid');

const AAN = { RTG_SIMULATIEBANK: '1', NODE_ENV: 'test' };

function wereld(env, opties = {}) {
  const klok = { nu: Date.parse('2026-10-19T09:00:00Z') };
  const sim = synthetisch({ crypto, env, echteRail: null, nu: () => klok.nu });
  const opslag = new Map();
  const gevraagd = [];
  const vrijgave = { eis: (cap, ctx) => { gevraagd.push({ cap, ctx }); if (opties.dicht) throw new Error('Deze functie staat tijdelijk uit.'); } };
  const betaal = maakOntvangst({ crypto, standaard: 'simulatie', get: (k) => opslag.get(k), set: (k, v) => opslag.set(k, v),
    env, uit: false, simulatie: sim, vrijgave });
  const data = {};
  const bw = maakBetaalWaarheid({ d: () => data, save: () => {}, crypto, betaal, nu: () => new Date(klok.nu).toISOString() });
  bw.registreerAfhandeling('proef', async () => {});
  return { sim, bw, data, klok, gevraagd };
}

/* een betaling via de betaalwaarheid met de gevraagde afloop (sleutel waarheid:<id>) */
async function betaling(w, afloop, merk) {
  for (let i = 0; i < 2000; i++) {
    const idem = (merk || 'b') + i;
    const id = 'BW-' + crypto.createHash('sha256').update('lid:x|' + idem).digest('hex').slice(0, 20).toUpperCase();
    if (w.sim.scenarioVan({ idempotentieSleutel: 'waarheid:' + id }) !== afloop) continue;
    const r = w.bw.maak({ actor: 'lid:x', soort: 'proef', idem, centen: 2500, valuta: 'eur' });
    await w.bw.begin(r.id, { aanbieder: 'simulatie' });
    return w.bw.van(r.id);
  }
  throw new Error('geen sleutel voor ' + afloop);
}
/* een terugbetaalsleutel met de gevraagde afloop */
function terugIdem(w, r, afloop, merk) {
  for (let i = 0; i < 2000; i++) {
    const idem = (merk || 't') + i;
    const h = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
    const sleutel = 'terug:' + r.id + ':' + h('idem:' + h(idem)).slice(0, 24);
    if (w.sim.terugScenarioVan({ idempotentieSleutel: sleutel }) === afloop) return idem;
  }
  throw new Error('geen terugsleutel voor ' + afloop);
}
const opdracht = (w, id) => w.bw.van(id) && w.data.betaalWaarheid[id].terugbetaalOpdrachten[0];

test('met de vlag: een bevestigde terugbetaling boekt de betaling precies een keer terug, ook bij twee tikken', async () => {
  const w = wereld(AAN);
  const r = await betaling(w, 'betaald');
  assert.equal(r.status, 'BEVESTIGD');
  const idem = terugIdem(w, r, 'bevestigd');
  await Promise.all([w.bw.terugbetalen(r.id, { centen: 2500, idem, reden: 'herroepen' }),
    w.bw.terugbetalen(r.id, { centen: 2500, idem, reden: 'herroepen' })]);
  await w.bw.terugbetalen(r.id, { centen: 2500, idem, reden: 'herroepen' });
  const na = w.data.betaalWaarheid[r.id];
  assert.equal(na.status, 'TERUGBETAALD');
  assert.equal(na.terugbetaaldCenten, 2500, 'een keer');
  assert.equal(na.terugbetalingen.length, 1);
  assert.equal(opdracht(w, r.id).status, 'BEVESTIGD');
  assert.ok(w.gevraagd.some((g) => g.cap === 'geld.terugbetaling' && g.ctx.rail === 'simulatie'), 'achter de vrijgavepoort');
});

test('met de vlag: een geweigerde terugbetaling boekt niets terug en gaat zichtbaar naar een mens', async () => {
  const w = wereld(AAN);
  const r = await betaling(w, 'betaald', 'g');
  await w.bw.terugbetalen(r.id, { centen: 2500, idem: terugIdem(w, r, 'geweigerd'), reden: 'herroepen' });
  const na = w.data.betaalWaarheid[r.id];
  assert.equal(na.terugbetaaldCenten || 0, 0);
  assert.equal(na.status, 'CONTROLE_NODIG');
  assert.equal(na.blokkade, 'terugbetaling-mislukt');
});

test('met de vlag: een trage terugbetaling wacht bij de provider en telt pas na de bevestiging, een keer', async () => {
  const w = wereld(AAN);
  const r = await betaling(w, 'betaald', 'tr');
  await w.bw.terugbetalen(r.id, { centen: 2500, idem: terugIdem(w, r, 'traag'), reden: 'herroepen' });
  const op = opdracht(w, r.id);
  assert.equal(op.status, 'BIJ_PROVIDER');
  assert.equal(w.data.betaalWaarheid[r.id].terugbetaaldCenten || 0, 0, 'nog niets teruggeboekt');
  const melding = { aanbieder: 'simulatie', providerRefundId: op.providerRefundId, providerPaymentId: r.providerId, centen: 2500, valuta: 'eur' };
  await w.bw.providerTerugbetaling(melding);
  await w.bw.providerTerugbetaling(Object.assign({ eventId: 'nog-eens' }, melding));
  assert.equal(w.data.betaalWaarheid[r.id].terugbetaaldCenten, 2500);
  assert.equal(w.data.betaalWaarheid[r.id].status, 'TERUGBETAALD');
});

test('zonder de vlag of met een dichte poort: geen terugbetaling, en niets geboekt', async () => {
  assert.throws(() => synthetisch({ crypto, env: {} }).terugbetaal({ providerId: 'sim_betaald_x', bedrag: 100 }), /staat uit/);
  assert.throws(() => synthetisch({ crypto, env: { RTG_SIMULATIEBANK: '1', NODE_ENV: 'production' } }).haal('sim_betaald_x'), /nooit in productie/);
  const zonder = maakOntvangst({ crypto, standaard: 'uit', get: () => null, set: () => {}, env: {}, uit: false,
    simulatie: synthetisch({ crypto, env: {} }) });
  await assert.rejects(() => zonder.maakTerugbetaling({ aanbieder: 'simulatie', providerId: 'sim_betaald_x', bedrag: 100 }), /niet beschikbaar|staat uit/);
  await assert.rejects(() => zonder.haalBetaling('simulatie', 'sim_traag_x'), /niet beschikbaar|staat uit/);
  const w = wereld(AAN, { dicht: false });
  const r = await betaling(w, 'betaald', 'd');
  const dicht = wereld(AAN, { dicht: true });
  dicht.data.betaalWaarheid = w.data.betaalWaarheid;
  await assert.rejects(() => dicht.bw.terugbetalen(r.id, { centen: 2500, idem: 'x', reden: 'herroepen' }), /tijdelijk uit/);
  assert.equal(dicht.data.betaalWaarheid[r.id].terugbetaaldCenten || 0, 0);
});

test('de veegronde rondt een trage simulatiebetaling eerlijk af: verlopen, niet eeuwig lopend en niet geescaleerd', async () => {
  const w = wereld(AAN);
  const r = await betaling(w, 'traag', 'v');
  assert.equal(r.status, 'WACHT_OP_KLANT');
  w.klok.nu += 11 * 60 * 1000;
  await w.bw.ronde({ tot: w.klok.nu });
  assert.equal(w.data.betaalWaarheid[r.id].status, 'WACHT_OP_KLANT', 'binnen de looptijd blijft hij open');
  assert.ok(!w.data.betaalWaarheid[r.id].escalatie);
  w.klok.nu += synthetisch.VERLOOP_MS;
  for (let i = 0; i < 3; i++) { w.klok.nu += 24 * 3600 * 1000; await w.bw.ronde({ tot: w.klok.nu }); }
  const na = w.data.betaalWaarheid[r.id];
  assert.equal(na.status, 'GEANNULEERD', 'verlopen: er kwam geen geld binnen');
  assert.ok(!na.escalatie, 'geen mens nodig voor een simulatie die uitliep');
});

test('opzoeken geeft de stand van de afloop; een betaalde blijft betaald', async () => {
  const w = wereld(AAN);
  assert.equal(w.sim.haal('sim_betaald_abc').status, 'betaald');
  assert.equal(w.sim.haal('sim_geweigerd_abc').status, 'geweigerd');
  assert.equal(w.sim.haal('sim_terugboeking_abc').status, 'teruggeboekt');
  const r = await betaling(w, 'betaald', 'z');
  await w.bw.begin(r.id, {});
  assert.equal(w.data.betaalWaarheid[r.id].status, 'BEVESTIGD');
});
