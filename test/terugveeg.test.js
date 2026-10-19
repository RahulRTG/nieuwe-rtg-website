/* De veegronde voor terugbetalingen (server/kern/betaalwaarheid/terugveeg.js).

   Een terugbetaling die de provider aannam maar nog niet bevestigde, staat op
   BIJ_PROVIDER en wacht op een melding. Kwam die melding nooit, dan bleef hij
   daar eeuwig staan, alleen zichtbaar als getal in betaalregie-waarheid.js; dat
   gold voor elke provider. Besluit van de integrator (19 oktober 2026): geen
   afronding IN de simulatie -- dan lost de simulatie op wat bij een echte
   provider open blijft -- maar een veegronde die voor elke provider gelijk is:
   na een wachttijd opnieuw opvragen bij de provider, een bevestiging of
   weigering precies een keer verwerken, en zonder uitsluitsel na het maximum
   escaleren naar een mens. Nooit "terugbetaald" zonder bevestiging.
   Hier met de echte betaalwaarheid, ontvangst- en naslaglaag en de
   simulatiebank, waarvan de trage terugbetaling na een tijd bevestigt en de
   stille nooit antwoordt. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const synthetisch = require('../server/betaal/synthetisch');
const maakOntvangst = require('../server/betaal/ontvangst');
const maakBetaalWaarheid = require('../server/kern/betaalwaarheid');
const { WACHT_MS } = require('../server/kern/betaalwaarheid/terugveeg');

const AAN = { RTG_SIMULATIEBANK: '1', NODE_ENV: 'test' };
const h = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

function wereld() {
  const klok = { nu: Date.parse('2026-10-19T09:00:00Z') };
  const sim = synthetisch({ crypto, env: AAN, echteRail: null, nu: () => klok.nu });
  const opslag = new Map();
  const betaal = maakOntvangst({ crypto, standaard: 'simulatie', get: (k) => opslag.get(k), set: (k, v) => opslag.set(k, v),
    env: AAN, uit: false, simulatie: sim, vrijgave: { eis: () => {} } });
  const data = {};
  const bw = maakBetaalWaarheid({ d: () => data, save: () => {}, crypto, betaal, nu: () => new Date(klok.nu).toISOString() });
  bw.registreerAfhandeling('proef', async () => {});
  return { sim, bw, data, klok, betaal };
}

async function betaald(w) {
  for (let i = 0; i < 2000; i++) {
    const idem = 'b' + i;
    const id = 'BW-' + h('lid:x|' + idem).slice(0, 20).toUpperCase();
    if (w.sim.scenarioVan({ idempotentieSleutel: 'waarheid:' + id }) !== 'betaald') continue;
    const r = w.bw.maak({ actor: 'lid:x', soort: 'proef', idem, centen: 2500, valuta: 'eur' });
    await w.bw.begin(r.id, { aanbieder: 'simulatie' });
    return w.data.betaalWaarheid[r.id];
  }
  throw new Error('geen sleutel');
}
async function terugMet(w, r, afloop) {
  for (let i = 0; i < 2000; i++) {
    const idem = 't' + i;
    const sleutel = 'terug:' + r.id + ':' + h('idem:' + h(idem)).slice(0, 24);
    if (w.sim.terugScenarioVan({ idempotentieSleutel: sleutel }) !== afloop) continue;
    await w.bw.terugbetalen(r.id, { centen: 2500, idem, reden: 'herroepen' });
    return r.terugbetaalOpdrachten[0];
  }
  throw new Error('geen terugsleutel voor ' + afloop);
}
const later = async (w, ms) => { w.klok.nu += ms; return w.bw.ronde({ tot: w.klok.nu }); };

test('een trage terugbetaling die later bevestigt, wordt door de veegronde precies een keer verwerkt', async () => {
  const w = wereld();
  const r = await betaald(w);
  const op = await terugMet(w, r, 'traag');
  assert.equal(op.status, 'BIJ_PROVIDER');
  await later(w, 1000);
  assert.equal(r.terugbetaaldCenten || 0, 0, 'voor de wachttijd vraagt de ronde niets');
  await later(w, WACHT_MS[0]);
  assert.equal(r.terugbetaaldCenten || 0, 0, 'de provider bevestigt nog niet: niets geteld, geen "terugbetaald"');
  assert.equal(r.status, 'TERUGBETALING_WACHT');
  for (let i = 0; i < 3; i++) await later(w, 6 * 3600 * 1000);
  assert.equal(r.status, 'TERUGBETAALD');
  assert.equal(r.terugbetaaldCenten, 2500, 'een keer');
  assert.equal(r.terugbetalingen.length, 1);
  assert.equal(op.status, 'BEVESTIGD');
  assert.ok(!op.escalatie);
});

test('een terugbetaling die nooit antwoordt, escaleert na het maximum naar een mens en telt nooit als terugbetaald', async () => {
  const w = wereld();
  const r = await betaald(w);
  const op = await terugMet(w, r, 'stil');
  for (let i = 0; i < WACHT_MS.length + 2; i++) await later(w, 25 * 3600 * 1000);
  assert.ok(op.escalatie, 'geescaleerd');
  assert.equal(op.status, 'BIJ_PROVIDER', '"wij weten het niet" is geen uitkomst');
  assert.equal(r.terugbetaaldCenten || 0, 0);
  assert.notEqual(r.status, 'TERUGBETAALD');
  assert.ok(r.gebeurtenissen.some((g) => g.soort === 'TERUGBETALING_ESCALATIE'));
  assert.equal(w.bw.openstaand().terugEscalatie, 1, 'zichtbaar in het overzicht');
  const pogingen = op.veegPogingen;
  await later(w, 25 * 3600 * 1000);
  assert.equal(op.veegPogingen, pogingen, 'na de escalatie vraagt de ronde niet eindeloos door');
});

test('een terugbetaling die de provider bij navraag weigert, gaat zichtbaar naar een mens, zonder boeking', async () => {
  const w = wereld();
  const r = await betaald(w);
  const op = await terugMet(w, r, 'traag');
  /* de provider weigert hem alsnog: bij navraag zegt hij "failed" */
  const echt = w.betaal.haalTerugbetaling;
  w.betaal.haalTerugbetaling = async (...a) => Object.assign({}, await echt(...a), { status: 'failed' });
  await later(w, WACHT_MS[0] + 1000);
  assert.equal(r.terugbetaaldCenten || 0, 0);
  assert.equal(r.status, 'CONTROLE_NODIG');
  assert.equal(r.blokkade, 'terugbetaling-mislukt');
});
