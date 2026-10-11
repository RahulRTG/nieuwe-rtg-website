/* EEN NOODSTOP HOUDT NIEUW GELD TEGEN, NIET GELD DAT AL VASTSTOND.

   De eis van de eigenaar, in twee helften die elkaar in de weg kunnen zitten:

     - een noodstop op een geldcapability blokkeert elke NIEUWE handeling;
     - wat al is GEBEURD gaat door: de bevestiging van een betaling die al van
       een kaart ging (de webhook en de veegronde), het terugzetten van geld naar
       wie het betaalde (teruggave, terugbetaling, correctie, intrekken), de
       terugboeking van een uitbetaling die de rail weigerde, en het lezen.

   Daarom hangt de poort voor het interne saldo NIET in de waardepoort of de
   boeking (daar komt de afwikkeling ook langs) maar in de idem-laag
   (server/lib/idem.js `poort`, server/lib/idem-nieuwwerk.js), na het opzoeken
   van een herhaling en voor het werk. Deze toetsen houden die plek vast:

     1. de idem-laag zelf: herhaling eerst, dan de poort, ook zonder sleutel;
        een verklaarde afwikkeling slaat de poort van de laag over, maar nooit
        een poort van de aanroeper; een poort die gooit, is dicht;
     2. een oplading die al ONDERWEG was als de noodstop valt, wordt na de
        bevestiging precies EEN keer bijgeschreven -- ook als die bevestiging
        twee keer komt -- terwijl een NIEUWE oplading geweigerd wordt;
     3. de afwikkelwegen van RTG Pay lopen door een noodstop heen, de nieuwe
        wegen niet;
     4. de brug uit de RTG Bank naar de wallet vraagt dezelfde poort. */
'use strict';
process.env.RTG_SIMULATIEBANK = '1';
delete process.env.STRIPE_SECRET_KEY;
delete process.env.MOLLIE_API_KEY;
delete process.env.ADYEN_API_KEY;

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const maakIdem = require('../server/lib/idem');
const { proefVrijgave } = require('../scripts/lib/proefvrijgave');

const NOOD = { wie: 'user-2', reden: 'noodstop in de proef' };
const AAN = { wie: 'user-1', reden: 'noodstop voorbij in de proef', stapOmhoog: true };

/* ------------------------------------------------------------- 1 idem-laag */
function idemWereld(poort) {
  const data = {};
  return maakIdem({ d: () => data, save: () => {}, naam: 'proefIdem', poort });
}
const DICHT = { status: 503, code: 'tijdelijk-uit', error: 'Deze functie staat tijdelijk uit.', capability: 'proef' };

test('1a herhaling eerst: een bewaard antwoord komt terug als de poort dicht is, nieuw werk niet', async () => {
  let open = true, werk = 0;
  const metIdem = idemWereld(() => (open ? null : DICHT));
  const eerste = await metIdem('k1', 'a', async () => { werk++; return { ok: true, n: werk }; });
  assert.deepEqual(eerste, { ok: true, n: 1 });
  open = false;
  const herhaling = await metIdem('k1', 'a', async () => { werk++; return { ok: true, n: werk }; });
  assert.equal(herhaling.herhaald, true); assert.equal(herhaling.n, 1);
  assert.equal((await metIdem('k2', 'a', async () => { werk++; return { ok: true }; })).code, 'tijdelijk-uit');
  assert.equal((await metIdem(null, 'a', async () => { werk++; return { ok: true }; })).code, 'tijdelijk-uit',
    'zonder sleutel is het nog steeds nieuw werk');
  assert.equal(werk, 1, 'achter een dichte poort draaide werk');
  open = true;
  const weer = await metIdem('k1', 'a', async () => { werk++; return { ok: true, n: werk }; });
  assert.equal(weer.herhaald, true); assert.equal(werk, 1, 'heraanzetten voerde de oude handeling opnieuw uit');
});

test('1b een verzoek dat op een lopende vlucht wacht, krijgt diens antwoord, ook als de poort intussen dichtgaat', async () => {
  let open = true, laat;
  const metIdem = idemWereld(() => (open ? null : DICHT));
  const loopt = metIdem('v1', 'a', () => new Promise(res => { laat = () => res({ ok: true, eerste: true }); }));
  await new Promise(r => setImmediate(r));
  open = false;
  const wacht = metIdem('v1', 'a', async () => ({ ok: true, tweede: true }));
  laat();
  assert.deepEqual(await loopt, { ok: true, eerste: true });
  const r = await wacht;
  assert.equal(r.eerste, true); assert.equal(r.herhaald, true);
});

test('1c afwikkeling slaat de poort van de laag over, maar nooit die van de aanroeper; een gooiende poort is dicht', async () => {
  const metIdem = idemWereld(() => DICHT);
  assert.equal((await metIdem('a1', 'a', async () => ({ ok: true }), { afwikkeling: 'geld terug naar wie betaalde' })).ok, true);
  assert.equal((await metIdem('a2', 'a', async () => ({ ok: true }), { afwikkeling: '   ' })).code, 'tijdelijk-uit',
    'een lege reden is geen verklaring');
  assert.equal((await metIdem('a3', 'a', async () => ({ ok: true }), { afwikkeling: 'x', poort: () => DICHT })).code, 'tijdelijk-uit',
    'een verklaarde afwikkeling opende ook de poort van de aanroeper');
  const gooit = idemWereld(() => { throw new Error('evaluator kapot'); });
  const g = await gooit('g1', 'a', async () => ({ ok: true }));
  assert.equal(g.status, 503); assert.equal(g.code, 'tijdelijk-uit');
  const metOpen = idemWereld(() => null);
  assert.equal((await metOpen('p1', 'a', async () => ({ ok: true }), { poort: () => DICHT })).code, 'tijdelijk-uit',
    'de poort van de aanroeper sluit erbij, ook als de laag open is');
});

/* ------------------------------------------------- 2 een oplading onderweg */
const CODENAAM = 'Proef';
const BEDRAG = 5000;
function payWereld({ betaalVoorPay, betaalWaarheid, db, vrijgave }) {
  return require('../server/kern/pay')({ db, save: () => {}, bijeen: async (werk) => werk(), vrijgave,
    payBoekingenVoegToe: require('../server/kern/pay/loshistorie')(db), crypto, betaal: betaalVoorPay,
    keyVanCodenaam: (c) => (['Proef', 'Ander'].includes(c) ? { key: 'proef:' + c } : null), sseToCustomer: () => {},
    schoon: (x) => String(x || ''), betaaldienstKosten: () => 0,
    betaalOpdrachten: maakOpdrachten(), betaalWaarheid }).pay;
}
function maakOpdrachten() {
  const teruggang = new Map();
  return { teruggang, registreerTeruggang(soort, fn) { teruggang.set(soort, fn); },
    maak: (o) => Object.assign({ id: 'op-' + crypto.randomBytes(3).toString('hex') }, o),
    dienIn: async (o) => Object.assign({}, o, { status: 'INGEDIEND' }) };
}

test('2 een oplading die ONDERWEG was als de noodstop valt: de bevestiging schrijft precies een keer bij, een nieuwe oplading niet', async () => {
  const betaal = require('../server/betaal');
  const b = require('../server/betaal/synthetisch')({ crypto, env: { RTG_SIMULATIEBANK: '1' }, echteRail: false });
  let uitgevoerd = 0, kwijt = true;
  const rail = { AANBIEDER: betaal.AANBIEDER,
    async maakBetaling(o) {
      const uit = await betaal.maakBetaling(o);
      if (!uit.herhaald) uitgevoerd++;
      if (kwijt) { kwijt = false; throw new Error('verbinding verbroken na verzending'); }
      return uit;
    },
    haalBetaling: (...a) => betaal.haalBetaling(...a) };
  const db = { data: {} };
  const klok = { t: Date.parse('2026-10-06T12:00:00Z') };
  const betaalWaarheid = require('../server/kern/betaalwaarheid')({ d: () => db.data, save: () => {}, crypto,
    betaal: rail, nu: () => new Date(klok.t).toISOString(), log: null });
  const v = proefVrijgave();
  const pay = payWereld({ betaalVoorPay: rail, betaalWaarheid, db, vrijgave: v });
  let idem = null;
  for (let i = 0; i < 1000 && !idem; i++) {
    const kandidaat = 'onderweg-' + i;
    const sleutel = 'waarheid:BW-' + crypto.createHash('sha256')
      .update('pay:' + CODENAAM + '|pay-oplaad:' + CODENAAM + ':' + kandidaat).digest('hex').slice(0, 20).toUpperCase();
    if (b.scenarioVan({ idempotentieSleutel: sleutel }) === 'betaald') idem = kandidaat;
  }
  assert.ok(idem, 'een sleutel waarvoor de simulatiebank betaalt');
  const r = await pay.laadOp({ codenaam: CODENAAM, centen: BEDRAG, idem });
  assert.equal(r.status, 502, 'het antwoord van de rail ging verloren: ' + JSON.stringify(r));
  assert.equal(uitgevoerd, 1, 'de kaart is belast');
  assert.equal(pay.saldoVan(pay.rekLid(CODENAAM)), 0, 'nog niet bijgeschreven');

  for (const id of ['geld.intern_saldo', 'geld.opwaarderen']) assert.ok(v.zet(id, 'emergency_disabled', NOOD).ok, id);
  const nieuw = await pay.laadOp({ codenaam: CODENAAM, centen: BEDRAG, idem: 'nieuw-tijdens-noodstop' });
  assert.equal(nieuw.code, 'tijdelijk-uit', 'een NIEUWE oplading ging door de noodstop: ' + JSON.stringify(nieuw));
  for (let i = 0; i < 4; i++) { klok.t += 25 * 3600 * 1000; await betaalWaarheid.ronde({ tot: klok.t }); }
  assert.equal(pay.saldoVan(pay.rekLid(CODENAAM)), BEDRAG, 'de bevestigde betaling werd tijdens de noodstop niet bijgeschreven');
  /* De bevestiging komt nog eens, langs de weg van de webhook: geen tweede keer. */
  const w = Object.values(db.data.betaalWaarheid || {})[0] || null;
  assert.ok(w && w.id, 'de betaalwaarheid kent de betaling');
  const dubbel = await pay.oplaadAfronden({ codenaam: CODENAAM, centen: BEDRAG, ref: w.id });
  assert.ok(dubbel.ok || dubbel.herhaald || !dubbel.error, JSON.stringify(dubbel));
  assert.equal(pay.saldoVan(pay.rekLid(CODENAAM)), BEDRAG, 'een herhaalde bevestiging schreef twee keer bij');
  assert.equal(pay.sluitcontrole().klopt, true);

  for (const id of ['geld.intern_saldo', 'geld.opwaarderen']) assert.ok(v.zet(id, 'sandbox', AAN).ok, id);
  const weer = await pay.laadOp({ codenaam: CODENAAM, centen: BEDRAG, idem });
  assert.ok(!weer.error || weer.herhaald, 'dezelfde sleutel na heraanzetten: ' + JSON.stringify(weer));
  assert.equal(uitgevoerd, 1, 'heraanzetten belastte de kaart een tweede keer');
  assert.equal(pay.saldoVan(pay.rekLid(CODENAAM)), BEDRAG, 'heraanzetten schreef een tweede keer bij');
});

/* ------------------------------------------------ 3 afwikkeling tegen nieuw */
test('3 tijdens een noodstop op het interne saldo: de afwikkelwegen lopen door, de nieuwe wegen niet', async () => {
  const db = { data: {} };
  const v = proefVrijgave();
  const opdrachten = maakOpdrachten();
  const pay = require('../server/kern/pay')({ db, save: () => {}, bijeen: async (werk) => werk(), vrijgave: v,
    payBoekingenVoegToe: require('../server/kern/pay/loshistorie')(db), crypto, betaal: { AANBIEDER: 'simulatie' },
    keyVanCodenaam: (c) => (['Proef', 'Ander'].includes(c) ? { key: 'proef:' + c } : null), sseToCustomer: () => {},
    schoon: (x) => String(x || ''), betaaldienstKosten: () => 0, betaalOpdrachten: opdrachten,
    betaalWaarheid: { maak() {}, begin() {}, van() {}, registreerAfhandeling() {} } }).pay;
  const s = (c) => pay.saldoVan(pay.rekLid(c));
  const zaak = () => pay.saldoVan(pay.rekPartner('ZAAK1'));
  assert.equal((await pay.oplaadAfronden({ codenaam: 'Proef', centen: 20000, ref: 'start-1' })).ok, true);
  const bz = await pay.betaalZaak({ codenaam: 'Proef', supplierCode: 'ZAAK1', centen: 3000, idem: 'bz-1' });
  assert.equal(bz.ok, true, JSON.stringify(bz));
  const vk = await pay.verkoop({ codenaam: 'Proef', naarPartner: 'ZAAK1', brutoCenten: 2000, idem: 'vk-1' });
  assert.equal(vk.ok, true, JSON.stringify(vk));
  assert.equal((await pay.huisIn({ vanCodenaam: 'Proef', centen: 1000, idem: 'hi-1' })).ok, true);

  assert.ok(v.zet('geld.intern_saldo', 'emergency_disabled', NOOD).ok);
  const [p0, z0] = [s('Proef'), zaak()];

  /* NIEUW: allemaal dicht, en er beweegt niets. */
  const nieuw = {
    stuur: await pay.stuur({ van: 'Proef', aanCodenaam: 'Ander', centen: 500, idem: 'st-n' }),
    betaalZaak: await pay.betaalZaak({ codenaam: 'Proef', supplierCode: 'ZAAK1', centen: 500, idem: 'bz-n' }),
    verkoop: await pay.verkoop({ codenaam: 'Proef', naarPartner: 'ZAAK1', brutoCenten: 500, idem: 'vk-n' }),
    huisIn: await pay.huisIn({ vanCodenaam: 'Proef', centen: 500, idem: 'hi-n' }),
    huisUit: await pay.huisUit({ aanCodenaam: 'Proef', centen: 500, idem: 'hu-n' }),
    tegoedKoop: await pay.tegoedKoop({ codenaam: 'Proef', centen: 500, aanCodenaam: 'Ander', idem: 'tk-n' }),
    partnerIn: await pay.partnerIn({ supplierCode: 'ZAAK1', codenaam: 'Proef', centen: 500, idem: 'pi-n' })
  };
  for (const [naam, r] of Object.entries(nieuw)) {
    assert.equal(r.code, 'tijdelijk-uit', naam + ' ging door de noodstop: ' + JSON.stringify(r));
    assert.equal(r.capability, 'geld.intern_saldo', naam);
  }
  assert.deepEqual([s('Proef'), zaak()], [p0, z0], 'een nieuwe weg liet geld bewegen');

  /* AFWIKKELING: alles wat terug moet, gaat terug. */
  const tz = await pay.terugZaak({ codenaam: 'Proef', supplierCode: 'ZAAK1', centen: 3000, idem: 'tz-1' });
  assert.equal(tz.ok, true, 'de terugbetaling van een zaakbetaling: ' + JSON.stringify(tz));
  const tg = await pay.terugGave({ codenaam: 'Proef', vanPartner: 'ZAAK1', partnerCenten: 1000, idem: 'tg-1' });
  assert.equal(tg.ok, true, 'een teruggave: ' + JSON.stringify(tg));
  const hu = await pay.huisUit({ aanCodenaam: 'Proef', centen: 1000, idem: 'hu-corr', afwikkeling: 'correctie op een betaalde RTG-factuur' });
  assert.equal(hu.ok, true, 'een factuurcorrectie: ' + JSON.stringify(hu));
  const af = await pay.oplaadAfronden({ codenaam: 'Proef', centen: 700, ref: 'bevestigd-tijdens-noodstop' });
  assert.equal(af.ok, true, 'een bevestigde oplading: ' + JSON.stringify(af));
  assert.equal(s('Proef'), p0 + 3000 + 1000 + 1000 + 700);
  /* De terugboeking van een uitbetaling die de rail weigerde (kern/pay/terug.js,
     kern/pay/partner-uitbetaal.js): geregistreerd bij de opdrachtenrij. */
  for (const soort of ['pay-terug', 'pay-uit']) assert.equal(typeof opdrachten.teruggang.get(soort), 'function', soort);
  const voorTerug = s('Proef');
  const tb = await opdrachten.teruggang.get('pay-terug')({ bron: 'lid:Proef', centen: 400, ledgerRef: 'PB-proef-1' });
  assert.ok(tb && !tb.error, 'de terugboeking van een geweigerde uitbetaling: ' + JSON.stringify(tb));
  assert.equal(s('Proef'), voorTerug + 400);
  assert.equal(pay.sluitcontrole().klopt, true);
});

/* ------------------------------------------------------ 4 de bankbrug */
test('4 de brug van de RTG Bank naar de wallet vraagt de poort van het interne saldo, na de herhaling', async () => {
  const data = {};
  const metIdem = maakIdem({ d: () => data, save: () => {}, naam: 'bankIdem' });
  const geboekt = [];
  let open = true;
  const brug = require('../server/kern/bank/walletbrug')({
    boekAsync: async (b) => { geboekt.push(b); return { ok: true, boeking: { id: 'b' + geboekt.length } }; },
    rekMeta: () => ({ codenaam: 'Proef' }), saldoVan: () => 100000, seintje: () => {}, metIdem,
    pay: { MAX_CENTEN: 500000, boekAsync: async (b) => { geboekt.push(b); return { ok: true, boeking: { id: 'p' } }; },
      vrijgavePoort: { intern: () => (open ? null : DICHT) } } });
  const eerst = await brug.bankBankNaarWallet({ iban: 'NL00RTGB0000000001', codenaam: 'Proef', centen: 1000, idem: 'nw-1' });
  assert.equal(eerst.ok, true, JSON.stringify(eerst));
  const n = geboekt.length;
  open = false;
  assert.equal((await brug.bankBankNaarWallet({ iban: 'NL00RTGB0000000001', codenaam: 'Proef', centen: 1000, idem: 'nw-2' })).code, 'tijdelijk-uit');
  assert.equal((await brug.bankBankNaarWallet({ iban: 'NL00RTGB0000000001', codenaam: 'Proef', centen: 1000, idem: 'nw-1' })).herhaald, true);
  assert.equal(geboekt.length, n, 'achter de dichte poort werd geboekt');
});
