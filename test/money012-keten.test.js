/* MONEY-012, DE EINDPROEF -- de keten als een systeem en niet als losse modules.

   test/money012.test.js en test/money012-inkomend.test.js beproeven elk een
   module met een nagemaakte buitenwereld. Deze proef draait de ECHTE keten in
   een proces, van intentie tot grootboek:

     pay.laadOp (kern/pay)
       -> de betaalwaarheid (vastleggen voor de aanroep, vaste sleutel)
       -> server/betaal.js met de simulatiebank (de echte naad, de echte rail)
       -> een storingslaag: het antwoord raakt kwijt, of de aanroep valt om
          voordat de rail iets doet
       -> een herstart: het geheugen weg, de opslag door JSON zoals op schijf
       -> de veegronde van de betaalwaarheid
       -> de afhandelaar van RTG Pay (precies een bijschrijving)
       -> het grootboek: saldo, sluitcontrole, en wat er nog openstaat

   De eis in een zin: EEN CRASH, RETRY, TIME-OUT OF ONBEKENDE PROVIDERUITKOMST
   MAG DE FINANCIELE WAARHEID NIET VERANDEREN. Dus na elke volgorde:
     - de rail heeft de kaart precies een keer belast;
     - de wallet staat op precies het bedrag;
     - het grootboek sluit (de som van alle rekeningen is nul);
     - er staat niets meer open, niets onbekend en niets geescaleerd.
   En als de rail nooit antwoordt: niets belast, niets bijgeschreven, het
   grootboek sluit, en de betaling staat geescaleerd voor een mens.

   Wat dit NIET bewijst staat in docs/money-012.md: een echte provider, de
   geldmotor, en een verloren antwoord in een draaiende HTTP-server.
   Draai los: node --test test/money012-keten.test.js */
'use strict';
/* VOOR de require van server/betaal: die leest de omgeving eenmalig. */
process.env.RTG_SIMULATIEBANK = '1';
delete process.env.STRIPE_SECRET_KEY;
delete process.env.MOLLIE_API_KEY;
delete process.env.ADYEN_API_KEY;

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const betaal = require('../server/betaal');

const CODENAAM = 'Proef';
const BEDRAG = 5000;

/* De storingslaag tussen de keten en de echte naad. `kwijt`: de rail voert uit,
   het antwoord komt niet aan. `stil`: de aanroep valt om voordat de rail iets
   doet. Hij telt hoe vaak de rail ECHT uitvoerde: een antwoord met `herhaald`
   komt uit het geheugen van de rail en is geen tweede uitvoering. */
function maakStoring() {
  let rij = [];
  const s = { uitgevoerd: 0, aanroepen: 0, altijdStil: false,
    zet(volgorde) { rij = volgorde.slice(); },
    async maakBetaling(o) {
      s.aanroepen++;
      const modus = s.altijdStil ? 'stil' : (rij.length ? rij.shift() : 'ok');
      if (modus === 'stil') throw new Error('time-out voor de rail');
      const uit = await betaal.maakBetaling(o);
      if (!uit.herhaald) s.uitgevoerd++;
      if (modus === 'kwijt') throw new Error('verbinding verbroken na verzending');
      return uit;
    },
    haalBetaling: (...a) => betaal.haalBetaling(...a),
    AANBIEDER: betaal.AANBIEDER
  };
  return s;
}

/* De wereld: een schijf, een klok, en de echte betaalwaarheid en kern/pay
   eroverheen. `herstart()` gooit het geheugen weg en bouwt opnieuw op uit wat
   er op schijf staat. Het geheugen van de RAIL blijft -- dat is de
   buitenwereld, en die onthoudt wat hij heeft uitgevoerd. */
function maakWereld(storing) {
  const db = { data: {} };
  const klok = { t: Date.parse('2026-09-24T12:00:00Z') };
  const w = {};
  function bouw() {
    w.betaalWaarheid = require('../server/kern/betaalwaarheid')({ d: () => db.data, save: () => {},
      crypto, betaal: storing, nu: () => new Date(klok.t).toISOString(), log: null });
    w.pay = require('../server/kern/pay')({ db, save: () => {}, bijeen: async (werk) => werk(),
      payBoekingenVoegToe: require('../server/kern/pay/loshistorie')(db), crypto, betaal: storing,
      keyVanCodenaam: (c) => (c === CODENAAM ? 'proef:' + c : null), sseToCustomer: () => {},
      schoon: (x) => String(x || ''), betaaldienstKosten: () => 0,
      betaalOpdrachten: { registreerTeruggang() {}, maak: () => ({ id: 'proef' }), dienIn: async () => ({}) },
      betaalWaarheid: w.betaalWaarheid }).pay;
  }
  bouw();
  w.klok = klok;
  w.herstart = () => { db.data = JSON.parse(JSON.stringify(db.data)); bouw(); };
  w.saldo = () => w.pay.saldoVan(w.pay.rekLid(CODENAAM));
  return w;
}

/* Een idem-sleutel waarvoor de simulatiebank 'betaald' kiest, zodat de afloop
   van de RAIL vooraf vaststaat en alleen de storingen de volgorde bepalen. */
let volgnummer = 0;
function betaaldeIdem() {
  const b = require('../server/betaal/synthetisch')({ crypto, env: { RTG_SIMULATIEBANK: '1' }, echteRail: false });
  for (let i = 0; i < 1000; i++) {
    const idem = 'keten-' + (volgnummer++);
    const sleutel = 'waarheid:BW-' + crypto.createHash('sha256')
      .update('pay:' + CODENAAM + '|pay-oplaad:' + CODENAAM + ':' + idem).digest('hex').slice(0, 20).toUpperCase();
    if (b.scenarioVan({ idempotentieSleutel: sleutel }) === 'betaald') return idem;
  }
  throw new Error('geen betaalde sleutel gevonden');
}

const MODI = ['ok', 'kwijt', 'stil'];
function volgordes() {
  const uit = [];
  for (const a of MODI) for (const b of MODI) for (const c of MODI) uit.push([a, b, c]);
  return uit;
}

async function loopKeten(volgorde, { herstart, klantHerhaalt }) {
  const storing = maakStoring();
  storing.zet(volgorde);
  const w = maakWereld(storing);
  const idem = betaaldeIdem();
  await w.pay.laadOp({ codenaam: CODENAAM, centen: BEDRAG, idem });
  if (klantHerhaalt) {
    if (herstart) w.herstart();
    await w.pay.laadOp({ codenaam: CODENAAM, centen: BEDRAG, idem });   // de klant drukt nog eens, met dezelfde sleutel
  }
  for (let i = 0; i < 8; i++) {
    if (herstart) w.herstart();
    w.klok.t += 25 * 3600 * 1000;
    await w.betaalWaarheid.ronde({ tot: w.klok.t });
  }
  return { w, storing };
}

test('de eindproef: 27 storingsvolgordes x herstart x klant drukt opnieuw -- een waarheid', async () => {
  const fouten = [];
  for (const v of volgordes()) for (const herstart of [false, true]) for (const klantHerhaalt of [false, true]) {
    const naam = v.join('>') + (herstart ? ' +herstart' : '') + (klantHerhaalt ? ' +klant' : '');
    const { w, storing } = await loopKeten(v, { herstart, klantHerhaalt });
    const sluit = w.pay.sluitcontrole();
    const open = w.betaalWaarheid.openstaand();
    if (storing.uitgevoerd !== 1) fouten.push(naam + ': de rail voerde ' + storing.uitgevoerd + ' keer uit');
    if (w.saldo() !== BEDRAG) fouten.push(naam + ': de wallet staat op ' + w.saldo() + ' in plaats van ' + BEDRAG);
    if (!sluit || sluit.klopt !== true || sluit.som !== 0) fouten.push(naam + ': het grootboek sluit niet (' + JSON.stringify(sluit) + ')');
    if (open.aantal || open.onbekend || open.escalatie)
      fouten.push(naam + ': er staat nog iets open ' + JSON.stringify(open));
  }
  assert.deepEqual(fouten, []);
});

test('de rail antwoordt nooit: niets belast, niets bijgeschreven, grootboek sluit, en een mens ziet het', async () => {
  const storing = maakStoring();
  storing.altijdStil = true;
  const w = maakWereld(storing);
  const r = await w.pay.laadOp({ codenaam: CODENAAM, centen: BEDRAG, idem: betaaldeIdem() });
  assert.equal(r.status, 502);
  assert.equal(r.onbekend, true, 'het antwoord zegt dat de uitkomst onbekend is, en niet dat het mislukte');
  for (let i = 0; i < 10; i++) { w.herstart(); w.klok.t += 30 * 3600 * 1000; await w.betaalWaarheid.ronde({ tot: w.klok.t }); }
  assert.equal(storing.uitgevoerd, 0);
  assert.equal(w.saldo(), 0);
  assert.equal(w.pay.sluitcontrole().klopt, true);
  const open = w.betaalWaarheid.openstaand();
  assert.equal(open.escalatie, 1, 'geescaleerd voor een mens');
  assert.equal(open.onbekend, 1, 'en nog steeds eerlijk onbekend -- niet stil op mislukt gezet');
});

/* DE TEGENPROEF. De oude weg (een kale maakBetaling zonder vastlegging, en een
   nieuwe sleutel bij elke poging) moet in dezelfde meting een dubbele belasting
   laten zien; anders meet deze proef niets. */
test('tegenproef: een poging zonder vaste sleutel belast de kaart twee keer', async () => {
  const storing = maakStoring();
  storing.zet(['kwijt', 'ok']);
  for (let poging = 0; poging < 2; poging++) {
    try { await storing.maakBetaling({ bedrag: BEDRAG, referentie: 'oud-' + poging + '-' + Date.now(), omschrijving: 'oude weg' }); }
    catch (e) { /* antwoord kwijt; de oude weg legde niets vast en probeerde opnieuw */ }
  }
  assert.equal(storing.uitgevoerd, 2, 'twee keer belast: precies het gat dat deze ronde dichtzet');
});
