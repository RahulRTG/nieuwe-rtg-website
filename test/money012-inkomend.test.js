/* MONEY-012, de inkomende kant -- geld dat het huis BINNENKOMT eindigt na elke
   onderbreking in precies een verklaarbare waarheid.

   Dezelfde vier wetten als test/money012.test.js (de uitgaande kant), nu op
   kern/betaalwaarheid met de afhandelaar van RTG Pay (kern/pay/oplaadwaarheid.js):

     1. BEHOUD         de kaart wordt hooguit een keer belast, en de wallet
                       wordt precies zo vaak bijgeschreven als de provider
                       definitief bevestigde -- nooit bijgeschreven zonder dat,
                       en nooit belast zonder dat het uiteindelijk bijgeschreven
                       wordt of zichtbaar geescaleerd staat.
     2. EEN GEVOLG     elke poging en elke hervatting draagt dezelfde sleutel,
                       dus de provider voert hooguit een keer uit; de
                       afhandelaar schrijft hooguit een keer bij, ook als de
                       afhandeling wordt herhaald.
     3. HERSTEL        de veegronde brengt een betaling zonder uitsluitsel naar
                       BEVESTIGD of GEWEIGERD zodra de provider zich uitspreekt,
                       ook met een herstart na elke stap.
     4. AFSTEMMING     een betaling zonder referentie heet `onbekend` en telt
                       mee in het overzicht; na zes hervattingen zonder
                       uitsluitsel is er een ESCALATIE, en er wordt niets gewist.

   Vier soorten aanroep bij de provider en drie rondes: 64 volgordes, allemaal.
   Draai los: node --test test/money012-inkomend.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const SOORTEN = ['betaald', 'kwijt', 'stil', 'open'];
/*  betaald  de provider belast en antwoordt 'betaald'
    kwijt    de provider belast, het antwoord raakt onderweg kwijt
    stil     time-out zonder dat de provider iets deed
    open     de provider neemt aan en zegt: nog niet rond */

/* De provider: kent zijn eigen waarheid per sleutel, herkent een herhaalde
   sleutel, en belast hooguit een keer. `haalBetaling` is de opzoeking op zijn
   eigen referentie; een `open` betaling wordt daar na een tijd `betaald`. */
function maakProvider(volgorde, { eerlijk = true } = {}) {
  const belast = new Map();     // sleutel -> { id, status }
  const sleutels = [];
  let i = 0, daarna = 'betaald';
  return {
    belast, sleutels, zetDaarna(s) { daarna = s; },
    AANBIEDER: 'proef',
    aanbieders: [],
    async maakBetaling(o) {
      sleutels.push(o.idempotentieSleutel);
      this.aanbieders.push(o.aanbieder || null);
      const soort = i < volgorde.length ? volgorde[i] : daarna; i++;
      const bestaand = belast.get(o.idempotentieSleutel);
      if (bestaand) return { id: bestaand.id, status: bestaand.status, aanbieder: 'demo', bedrag: o.bedrag, valuta: 'eur' };
      const voer = (status) => {
        const b = { id: 'pi_' + belast.size, status };
        belast.set(o.idempotentieSleutel, b);
        return { id: b.id, status, aanbieder: 'demo', bedrag: o.bedrag, valuta: 'eur' };
      };
      if (soort === 'betaald') return voer('betaald');
      if (soort === 'open') return voer('open');
      if (soort === 'kwijt') { voer(eerlijk ? 'betaald' : 'betaald'); throw new Error('verbinding verbroken na verzending'); }
      throw new Error('time-out');
    },
    async haalBetaling(_a, id) {
      for (const b of belast.values()) if (b.id === id) {
        if (b.status === 'open' && daarna === 'betaald') b.status = 'betaald';
        return { id: b.id, status: b.status, aanbieder: 'demo' };
      }
      throw new Error('onbekende betaling');
    }
  };
}

/* De wereld: een schijf, een klok, de betaalwaarheid en de echte afhandelaar
   van RTG Pay, met een boeking die telt hoe vaak er is bijgeschreven -- in
   DEZELFDE schijf, zodat het bewijs van de afhandelaar en de boeking samen
   bewaard worden, precies zoals in productie. */
function maakWereld(provider, { oudeAfhandelaar = false } = {}) {
  const schijf = { data: {} };
  const klok = { t: Date.parse('2026-09-24T10:00:00Z') };
  let w;
  function bouw() {
    w = require('../server/kern/betaalwaarheid')({ d: () => schijf.data, save: () => {}, crypto,
      betaal: provider, nu: () => new Date(klok.t).toISOString(), log: null });
    const oplaadAfronden = async ({ ref }) => {
      schijf.data.bijgeschreven = (schijf.data.bijgeschreven || []).concat(ref);
      return { ok: true };
    };
    if (oudeAfhandelaar) w.registreerAfhandeling('pay-oplaad', async (r) => { await oplaadAfronden({ ref: r.id }); });
    else require('../server/kern/pay/oplaadwaarheid')({ betaalWaarheid: w, oplaadAfronden, nu: () => klok.t });
  }
  bouw();
  return { get w() { return w; }, schijf, klok,
    herstart() { schijf.data = JSON.parse(JSON.stringify(schijf.data)); bouw(); },
    bijgeschreven: () => (schijf.data.bijgeschreven || []).length };
}

function alleVolgordes() {
  const uit = [];
  const bouw = (p) => { if (p.length === 3) { uit.push(p); return; } for (const s of SOORTEN) bouw([...p, s]); };
  bouw([]); return uit;
}

async function schendingen(volgorde, { herstart = false, oudeAfhandelaar = false } = {}) {
  const fout = [];
  const naam = volgorde.join('>') + (herstart ? ' (herstart)' : '');
  const p = maakProvider(volgorde);
  const wereld = maakWereld(p, { oudeAfhandelaar });
  const r0 = wereld.w.maak({ actor: 'pay:Proef', idem: 'pay-oplaad:Proef:1', soort: 'pay-oplaad', centen: 5000, context: { codenaam: 'Proef' } });
  const id = r0.id;
  try { await wereld.w.begin(id, { omschrijving: 'opladen' }); } catch (e) { /* uitkomst onbekend of wachtend */ }
  for (let ronde = 0; ronde < 2; ronde++) {
    if (herstart) wereld.herstart();
    wereld.klok.t += 3 * 3600 * 1000;
    await wereld.w.ronde({ tot: wereld.klok.t });
  }
  // de provider spreekt zich uit en de veegronde loopt nog een paar keer
  p.zetDaarna('betaald');
  for (let ronde = 0; ronde < 4; ronde++) {
    if (herstart) wereld.herstart();
    wereld.klok.t += 25 * 3600 * 1000;
    await wereld.w.ronde({ tot: wereld.klok.t });
  }
  const r = wereld.w.van(id);
  const belast = p.belast.has('waarheid:' + id) && p.belast.get('waarheid:' + id).status === 'betaald' ? 1 : 0;

  if (new Set(p.sleutels).size > 1) fout.push(naam + ': de pogingen droegen verschillende sleutels');
  if (p.belast.size > 1) fout.push(naam + ': de provider belastte ' + p.belast.size + ' keer');
  if (wereld.bijgeschreven() > 1) fout.push(naam + ': ' + wereld.bijgeschreven() + ' keer bijgeschreven');
  if (wereld.bijgeschreven() > belast) fout.push(naam + ': bijgeschreven zonder belasting');
  if (belast && wereld.bijgeschreven() !== 1 && !r.escalatie) fout.push(naam + ': belast, niet bijgeschreven en niet geescaleerd');
  if (!Object.keys(wereld.schijf.data.betaalWaarheid || {}).includes(id)) fout.push(naam + ': de betaling is gewist');
  if (r.status !== 'BEVESTIGD' && !r.escalatie && ['AANGEMAAKT', 'WACHT_OP_KLANT', 'IN_BEHANDELING'].includes(r.status))
    fout.push(naam + ': hangt op ' + r.status + ' zonder escalatie');
  /* De provider sprak zich binnen zes hervattingen uit, dus hier is escalatie
     GEEN uitweg: elke volgorde hoort op bevestigd en precies een keer
     bijgeschreven uit te komen. Zonder deze regel bleef de sweep groen terwijl
     de veegronde de provider helemaal niet meer vroeg -- hij escaleerde dan
     gewoon op tijd. */
  if (r.status !== 'BEVESTIGD' || wereld.bijgeschreven() !== 1)
    fout.push(naam + ': de provider sprak zich uit, maar de betaling eindigt op ' + r.status +
      ' met ' + wereld.bijgeschreven() + ' bijschrijving(en)');
  return fout;
}

test('wet 1-4 over alle 64 volgordes aan de inkomende kant', async () => {
  const alle = [];
  for (const v of alleVolgordes()) alle.push(...await schendingen(v, {}));
  assert.deepEqual(alle, []);
});

test('wet 1-4 over alle 64 volgordes, met een herstart na elke ronde', async () => {
  const alle = [];
  for (const v of alleVolgordes()) alle.push(...await schendingen(v, { herstart: true }));
  assert.deepEqual(alle, []);
});

test('het scherpste geval: belast, antwoord kwijt -- onbekend, dan precies een keer bijgeschreven', async () => {
  const p = maakProvider(['kwijt']);
  const wereld = maakWereld(p);
  const r0 = wereld.w.maak({ actor: 'pay:Proef', idem: 'pay-oplaad:Proef:2', soort: 'pay-oplaad', centen: 2500, context: { codenaam: 'Proef' } });
  await assert.rejects(() => wereld.w.begin(r0.id, {}));
  const publiek = wereld.w.publiek(wereld.w.van(r0.id));
  assert.equal(publiek.onbekend, true, 'geen referentie, misschien belast: dat heet onbekend');
  assert.equal(wereld.w.openstaand().onbekend, 1, 'en telt mee in het overzicht');
  assert.equal(wereld.bijgeschreven(), 0);

  wereld.klok.t += 11 * 60 * 1000;
  await wereld.w.ronde({ tot: wereld.klok.t });
  assert.equal(wereld.w.van(r0.id).status, 'BEVESTIGD', 'de hervatting met dezelfde sleutel vond de betaling');
  assert.equal(p.belast.size, 1, 'en belastte niet opnieuw');
  assert.equal(wereld.bijgeschreven(), 1, 'precies een keer bijgeschreven');
});

test('zonder uitsluitsel: na zes hervattingen een escalatie, de stand blijft en niets wordt gewist', async () => {
  const p = maakProvider(['stil']);
  p.zetDaarna('stil');
  const wereld = maakWereld(p);
  const r0 = wereld.w.maak({ actor: 'pay:Proef', idem: 'pay-oplaad:Proef:3', soort: 'pay-oplaad', centen: 1000, context: { codenaam: 'Proef' } });
  await assert.rejects(() => wereld.w.begin(r0.id, {}));
  for (let i = 0; i < 10; i++) { wereld.klok.t += 30 * 3600 * 1000; await wereld.w.ronde({ tot: wereld.klok.t }); }
  const r = wereld.w.van(r0.id);
  assert.ok(r.escalatie, 'er staat een escalatie voor een mens');
  assert.equal(r.status, 'AANGEMAAKT', '"wij weten het niet" is geen "niet betaald": de stand blijft');
  assert.equal(r.hervatPogingen, 6);
  assert.equal(wereld.w.openstaand().escalatie, 1);
  const pogingen = p.sleutels.length;
  wereld.klok.t += 1e10; await wereld.w.ronde({ tot: wereld.klok.t });
  assert.equal(p.sleutels.length, pogingen, 'een geescaleerde betaling wordt niet eindeloos opnieuw aangeboden');
});

test('een betaling die nooit is aangeboden, start de veegronde niet zelf', async () => {
  const p = maakProvider([]);
  const wereld = maakWereld(p);
  wereld.w.maak({ actor: 'pay:Proef', idem: 'pay-oplaad:Proef:4', soort: 'pay-oplaad', centen: 1000, context: { codenaam: 'Proef' } });
  wereld.klok.t += 1e9;
  await wereld.w.ronde({ tot: wereld.klok.t });
  assert.equal(p.sleutels.length, 0, 'een machine begint geen betaling namens iemand die afhaakte');
});

test('de afhandelaar schrijft niet dubbel bij als de afhandeling na een storing wordt herhaald', async () => {
  const p = maakProvider(['betaald']);
  const wereld = maakWereld(p);
  const r0 = wereld.w.maak({ actor: 'pay:Proef', idem: 'pay-oplaad:Proef:5', soort: 'pay-oplaad', centen: 700, context: { codenaam: 'Proef' } });
  await wereld.w.begin(r0.id, {});
  assert.equal(wereld.bijgeschreven(), 1);
  // storing: de afhandeling staat niet als afgerond op schijf, het bewijs wel
  const r = wereld.w.van(r0.id);
  delete r.afgehandeldAt;
  wereld.herstart();
  wereld.klok.t += 1e9;
  await wereld.w.ronde({ tot: wereld.klok.t });
  assert.ok(wereld.w.van(r0.id).afgehandeldAt, 'de ronde maakte de afhandeling af');
  assert.equal(wereld.bijgeschreven(), 1, 'zonder een tweede bijschrijving');
});

/* DE TEGENPROEF. Een afhandelaar zonder bewijs (het patroon van voor deze
   ronde) moet de dubbele bijschrijving laten zien, anders meet dit niets. */
test('tegenproef: een afhandelaar zonder bewijs schrijft dubbel bij bij een herhaalde afhandeling', async () => {
  const p = maakProvider(['betaald']);
  const wereld = maakWereld(p, { oudeAfhandelaar: true });
  const r0 = wereld.w.maak({ actor: 'pay:Proef', idem: 'pay-oplaad:Proef:6', soort: 'pay-oplaad', centen: 700, context: { codenaam: 'Proef' } });
  await wereld.w.begin(r0.id, {});
  delete wereld.w.van(r0.id).afgehandeldAt;
  wereld.klok.t += 1e9;
  await wereld.w.ronde({ tot: wereld.klok.t });
  assert.equal(wereld.bijgeschreven(), 2, 'zonder het bewijs in dezelfde opslag wordt er dubbel bijgeschreven');
});

test('een hervatting gebruikt dezelfde aanbieder als de eerste poging', async () => {
  /* Met een andere aanbieder is "opnieuw proberen" geen opzoeking maar een
     tweede betaling bij een tweede partij. */
  const p = maakProvider(['kwijt']);
  const wereld = maakWereld(p);
  const r0 = wereld.w.maak({ actor: 'pay:Proef', idem: 'pay-oplaad:Proef:7', soort: 'pay-oplaad', centen: 900, context: { codenaam: 'Proef' } });
  await assert.rejects(() => wereld.w.begin(r0.id, { aanbieder: 'mollie', methode: 'ideal' }));
  wereld.herstart();
  wereld.klok.t += 11 * 60 * 1000;
  await wereld.w.ronde({ tot: wereld.klok.t });
  assert.deepEqual(p.aanbieders, ['mollie', 'mollie'], 'ook na een herstart dezelfde aanbieder');
});

/* Vergeten (AVG art. 17): de betaalwaarheid houdt, net als het grootboek van RTG
   Pay, de codenaam als bewijs van binnengekomen geld -- maar de SLEUTEL van het
   lid gaat eruit, uit de eigenaar en uit de context. test/vergeten.test.js
   raakt alleen een oplading (codenaam), dus dit pad wordt hier gemeten. */
test('vergeten haalt de sleutel uit de betaalwaarheid en laat bedrag en codenaam staan', () => {
  const key = 'user-7';
  const db = { data: { cvs: {}, live: {}, posts: [], notifications: {}, betaalWaarheid: {
    'BW-A': { id: 'BW-A', actor: 'dp:' + key, centen: 1200, soort: 'direct',
      context: { key, codename: 'Stille Reiger', supplierCode: 'ZAAK' } },
    'BW-B': { id: 'BW-B', actor: 'dp:user-70', centen: 500, soort: 'direct', context: { key: 'user-70' } }
  } } };
  const { wisEigen } = require('../server/kern/vergeten/eigen')({ db });
  wisEigen(key, () => {}, [], 'Stille Reiger');
  const a = db.data.betaalWaarheid['BW-A'];
  assert.ok(!JSON.stringify(a).includes(key), 'de sleutel is weg: ' + JSON.stringify(a));
  assert.equal(a.actor, 'dp:vergeten');
  assert.equal(a.centen, 1200, 'het bedrag blijft, dat is het bewijs');
  assert.equal(a.context.codename, 'Stille Reiger', 'de codenaam blijft, zonder sleutel leidt hij nergens heen');
  // een ander lid wiens sleutel met dezelfde tekens begint, blijft ongemoeid
  assert.equal(db.data.betaalWaarheid['BW-B'].context.key, 'user-70');
});
