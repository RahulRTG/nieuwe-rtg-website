/* De simulatieve uitbetaalrail: terugstorten naar het eigen IBAN, beproefbaar
   zonder echt geld (server/betaal/synthetisch.js `uitbetaal`,
   server/betaal/uitbetaling.js, kern/betaalopdracht/inzending.js).

   Gevraagd door Bevoegd via de integrator: /api/pay/terug was nergens te
   beproeven. Met RTG_SIMULATIEBANK=1 had de INKOMENDE kant een neprail, de
   uitgaande niet -- een terugstorting kwam bij de rail niet verder dan "geen
   betaalrail" en bleef in de opdrachtenrij hangen. Eigenaarsbesluit: lanceren
   zonder echt geld, maar elk geldpad klaar voor meerdere providers. Dus een
   simulatieve uitbetaalrail naast de simulatiebank, met dezelfde drie grendels
   (alleen met de vlag, nooit naast een echte provider, nooit in productie) en
   dezelfde afloop uit de sleutel: betaald, geweigerd, traag. Weigert de rail,
   dan komt het geld precies een keer terug op het saldo. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const synthetisch = require('../server/betaal/synthetisch');
const maakUitbetaalrail = require('../server/betaal/uitbetaling');
const maakBetaalopdrachten = require('../server/kern/betaalopdracht');
const { keurGeld } = require('../server/config/productie-geld');

const IBAN = 'NL91ABNA0417164300';
const AAN = { RTG_SIMULATIEBANK: '1', NODE_ENV: 'test' };
const sim = (env) => synthetisch({ crypto, env, echteRail: null });

/* een sleutel waarmee de simulatiebank deze afloop kiest, op de vorm die de rail gebruikt */
function sleutelVoor(afloop, merk) {
  const s = sim(AAN);
  for (let i = 0; i < 10000; i++) {
    const k = (merk || 'k') + '-' + i;
    if (s.scenarioVan({ idempotentieSleutel: 'uit:' + k }) === afloop) return k;
  }
  throw new Error('geen sleutel voor ' + afloop);
}

function rail(env, vrijgaveFout) {
  const opslag = new Map();
  const gevraagd = [];
  const start = maakUitbetaalrail({ betalenUit: false, haalOp: (k) => opslag.get(k), bewaar: (k, v) => opslag.set(k, v),
    regie: {}, sandbox: null, stripe: null, demoBetalen: false, aanbieder: () => 'uit', crypto,
    eisBetaalrail: () => { throw new Error('Er is geen betaalrail ingesteld.'); },
    vrijgave: { eis: (cap, ctx) => { gevraagd.push({ cap, ctx }); if (vrijgaveFout) throw new Error(vrijgaveFout); } },
    simulatie: sim(env) });
  return { start, gevraagd };
}

test('met de vlag: de simulatieve uitbetaalrail betaalt, weigert of blijft hangen, uit de sleutel, achter de vrijgavepoort', async () => {
  const r = rail(AAN);
  const op = (k) => r.start({ bedrag: 2500, iban: IBAN, begunstigde: 'Lid', referentie: 'BB1', idempotentieSleutel: k, vrijgave: 'geld.lid_iban_uitbetaling' });
  const ok = await op(sleutelVoor('betaald', 'ok'));
  assert.equal(ok.aanbieder, 'simulatie');
  assert.equal(ok.status, 'betaald');
  assert.equal((await op(sleutelVoor('geweigerd', 'nee'))).status, 'geweigerd');
  assert.equal((await op(sleutelVoor('traag', 'traag'))).status, 'open');
  const nog = await op(sleutelVoor('betaald', 'ok'));
  assert.equal(nog.herhaald, true, 'dezelfde sleutel is dezelfde uitbetaling');
  assert.equal(r.gevraagd[0].cap, 'geld.lid_iban_uitbetaling');
  assert.equal(r.gevraagd[0].ctx.rail, 'simulatie', 'de vrijgavepoort weegt de neprail');
});

test('met de vlag maar een dichte vrijgavepoort: niets verstuurd', async () => {
  const r = rail(AAN, 'Deze functie staat tijdelijk uit.');
  await assert.rejects(() => r.start({ bedrag: 2500, iban: IBAN, idempotentieSleutel: 'x', vrijgave: 'geld.lid_iban_uitbetaling' }),
    (e) => e.nietVerstuurd === true);
});

test('zonder de vlag is er geen simulatieve uitbetaalrail', async () => {
  const r = rail({ NODE_ENV: 'test' });
  await assert.rejects(() => r.start({ bedrag: 2500, iban: IBAN, idempotentieSleutel: 'x', vrijgave: 'geld.lid_iban_uitbetaling' }),
    (e) => e.nietVerstuurd === true && /geen betaalrail/.test(e.message));
  assert.throws(() => sim({}).uitbetaal({ bedrag: 100, idempotentieSleutel: 'x' }), /staat uit/);
});

test('in productie is de simulatieve uitbetaalrail onmogelijk, ook met de vlag, en de productiekeuring weigert de vlag', () => {
  assert.throws(() => sim({ RTG_SIMULATIEBANK: '1', NODE_ENV: 'production' }).uitbetaal({ bedrag: 100, idempotentieSleutel: 'x' }),
    /nooit in productie/);
  const fouten = [], waarschuwingen = [];
  keurGeld({ NODE_ENV: 'production', RTG_SIMULATIEBANK: '1', RTG_BETALEN_UIT: '1' }, fouten, waarschuwingen);
  assert.ok(fouten.some((f) => /RTG_SIMULATIEBANK/.test(f)), 'productie start niet met de simulatievlag: ' + JSON.stringify(fouten));
});

/* De hele terugstorting: de echte terugstortkern (kern/pay/terug.js), de echte
   opdrachtenrij en de simulatieve rail; alleen het grootboek en de kluis zijn
   hier klein gehouden. */
function terugwereld(env) {
  const data = {};
  const saldi = { 'lid:Codenaam': 10000 };
  const grootboek = [];
  const boek = (b) => {
    if (!String(b.van).startsWith('extern:') && (saldi[b.van] || 0) < b.centen) return { status: 402, error: 'Onvoldoende saldo.' };
    saldi[b.van] = (saldi[b.van] || 0) - b.centen; saldi[b.naar] = (saldi[b.naar] || 0) + b.centen;
    const r = Object.assign({ id: 'B' + (grootboek.length + 1) }, b); grootboek.unshift(r);
    return { ok: true, boeking: r };
  };
  const r = rail(env);
  const opdrachten = maakBetaalopdrachten({ d: () => data, save: () => {}, crypto, nu: () => Date.now(), maxPogingen: 1,
    railInzenden: (o) => r.start({ bedrag: o.centen, valuta: o.valuta, iban: o.bestemming, begunstigde: o.begunstigde,
      referentie: o.ledgerRef, idempotentieSleutel: o.idemSleutel, omschrijving: o.oms, vrijgave: 'geld.lid_iban_uitbetaling' }) });
  const dossier = { uitbetaal: { iban: IBAN, naam: 'Lid', bruikbaarVanaf: 0, bevestigd: true } };
  const t = require('../server/kern/pay/terug')({
    rekLid: (c) => 'lid:' + c, saldoVan: (rek) => saldi[rek] || 0, metIdem: require('../server/lib/idem')({ d: () => data, save: () => {}, naam: 'payIdem' }),
    boek, boekAsync: async (b) => boek(b), grootboek: () => grootboek, waarde: null, opdrachten,
    seintje: () => {}, nu: () => Date.now(), geldModus: 'schaduw', schoon: (v) => String(v || ''),
    accounts: { getMemberState: () => dossier, saveMemberState: () => {} } });
  t.koppelBevoegdTerug(() => ({ mag: true }));
  return { t, saldi, opdrachten, data };
}
const terug = (w, idem) => w.t.terugstorten({ codenaam: 'Codenaam', userId: 'u1', centen: 2500, idem });
/* de terugstorting biedt zich aan met idemSleutel `pay-terug:<codenaam>:<idem>` */
function terugSleutel(afloop, merk) {
  const s = sim(AAN);
  for (let i = 0; i < 10000; i++) { const x = merk + i; if (s.scenarioVan({ idempotentieSleutel: 'uit:pay-terug:Codenaam:' + x }) === afloop) return x; }
  throw new Error('geen sleutel');
}

test('met de vlag: een terugstorting die de rail betaalt, gaat precies een keer van het saldo af, ook bij een dubbele tik', async () => {
  const w = terugwereld(AAN);
  const idem = terugSleutel('betaald', 'dub');
  const [a, b] = await Promise.all([terug(w, idem), terug(w, idem)]);
  assert.ok(a.ok && b.ok, JSON.stringify([a, b]));
  assert.equal(w.saldi['lid:Codenaam'], 7500, 'een keer afgeboekt');
  const ops = w.data.betaalOpdrachten;
  assert.equal(ops.length, 1);
  assert.equal(ops[0].status, 'AFGEWIKKELD');
});

test('met de vlag: weigert de rail de terugstorting, dan komt het geld precies een keer terug', async () => {
  const w = terugwereld(AAN);
  const idem = terugSleutel('geweigerd', 'nee');
  const r = await terug(w, idem);
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(w.saldi['lid:Codenaam'], 10000, 'teruggeboekt');
  assert.equal(w.data.betaalOpdrachten[0].status, 'TERUGGEBOEKT');
  await w.opdrachten.dienIn(w.data.betaalOpdrachten[0].id);
  assert.equal(w.saldi['lid:Codenaam'], 10000, 'nog eens aanbieden boekt niet nog eens terug');
});

test('met de vlag: blijft de rail hangen, dan is het saldo af en staat de terugstorting klaar, niet "gelukt"', async () => {
  const w = terugwereld(AAN);
  const r = await terug(w, terugSleutel('traag', 'traag'));
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(w.saldi['lid:Codenaam'], 7500);
  assert.equal(w.data.betaalOpdrachten[0].status, 'INGEDIEND');
  assert.match(r.uitleg, /staat klaar/);
});
