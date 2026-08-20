/* ============================================================================
   DE COMMERCIELE RONDE: het werk dat wel gebouwd was en nooit werd gedaan.

   Vier dingen stonden klaar en werden door niemand aangeroepen. Dat is een eigen
   soort fout -- geen ontbrekende functie maar een functie zonder beller -- en die
   is stiller dan een ontbrekende, want de code ziet er compleet uit en de
   toetsen staan groen. `grep` op de aanroep buiten de eigen module gaf voor drie
   van de vier een dikke nul.

     fee.herkans()            een mislukte kostenboeking bleef mislukt
     contract.verlengbaar()   geen contract werd ooit VERLENGBAAR
     tegoed gewaarschuwdOp    de 80%-waarschuwing werd gezet en niet gemeld
     verrekening.*            drie verplichtingen die bestonden en niet bewogen

   DE BEWERINGEN DIE ERTOE DOEN:

     toets 3  de ronde is idempotent -- twee keer draaien betaalt niet twee keer
     toets 6  zonder RTF_IBAN gebeurt er NIETS met de sociale afdracht
     toets 8  een stap die vastloopt neemt de rest niet mee

   Draai los: node --experimental-sqlite --test test/ronde.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const { maakRonde } = require('../server/kern/commercie/ronde');
const { maakVerrekening } = require('../server/kern/commercie/verrekening');
const { maakFees } = require('../server/kern/commercie/fee');
const { maakContracten } = require('../server/kern/commercie/contract');
const { maakTegoed } = require('../server/kern/commercie/tegoed');
const { maakAllocatie } = require('../server/kern/commercie/allocatie');
const { maakPrijsmeldingen } = require('../server/kern/commercie/prijsmelding');
const subsidie = require('../server/kern/commercie/subsidie');

const NU = Date.parse('2026-08-20T10:00:00Z');

function wereld(opties) {
  const o = opties || {};
  const db = { data: { orders: [], prijsmeldingen: [], contracten: [], betaaldienstFees: [], socialeAfdrachten: [], aiTegoed: {} } };
  const save = () => {};
  const nu = () => NU;
  const geboekt = [];
  const boekAsync = async (b) => {
    geboekt.push(b);
    if (o.boekFaalt) return { error: 'motor onbereikbaar' };
    return { boeking: { id: 'b' + geboekt.length } };
  };
  const meldingen = [];
  const fees = maakFees({ db, save, nu });
  const contracten = maakContracten({ db, save, nu });
  const tegoed = maakTegoed({ db, save, nu });
  const allocatie = maakAllocatie({ db, save, nu });
  const prijsmeldingen = maakPrijsmeldingen({ db, save, nu });
  const verrekening = maakVerrekening({ db, save, boekAsync, prijsmeldingen, allocatie,
    rekLid: k => 'lid:' + k, rekPartner: c => 'partner:' + c, nu });
  const ronde = maakRonde({ fees, contracten, tegoed, verrekening, allocatie, boekAsync,
    melden: m => meldingen.push(m), env: o.env || {}, nu });
  return { db, fees, contracten, tegoed, allocatie, prijsmeldingen, verrekening, ronde, geboekt, meldingen };
}

// een betaalde bestelling met ledenvoordeel, zoals lidacties/betalen.js hem achterlaat
function bestellingMetVoordeel(w, ref, bruto, voordeel) {
  const o = { ref, supplierCode: 'KIKUNOI', total: bruto,
    voordeelOpbouw: subsidie.opbouwVan(bruto, voordeel) };
  w.db.data.orders.push(o);
  return o;
}

test('1. het ledenvoordeel wordt echt aan de zaak betaald', async () => {
  const w = wereld();
  bestellingMetVoordeel(w, 'RTG-1', 22, 2.20);
  const r = await w.ronde.draai();

  assert.equal(r.verrekening.ledenvoordeel.gelukt, 1);
  assert.equal(r.verrekening.ledenvoordeel.centen, 220);
  const boeking = w.geboekt.find(b => b.soort === 'ledenvoordeel');
  assert.ok(boeking, 'er is een boeking');
  assert.equal(boeking.van, 'rtg:ledenvoordeel', 'RTG legt bij -- dat was de belofte');
  assert.equal(boeking.naar, 'partner:KIKUNOI');
  assert.equal(boeking.centen, 220);
  assert.equal(w.db.data.orders[0].voordeelOpbouw.status, 'verrekend');
});

test('2. het rechtgezette prijsverschil gaat naar het lid', async () => {
  const w = wereld();
  const m = w.prijsmeldingen.meld({ codenaam: 'Anemoon', supplierCode: 'KIKUNOI',
    omschrijving: 'Ramen', betaaldCenten: 2200, gezienCenten: 1900 }).melding;
  w.prijsmeldingen.erken(m.id, 'Kikunoi');
  w.prijsmeldingen.zetRecht(m.id);

  const r = await w.ronde.draai();
  assert.equal(r.verrekening.prijsgarantie.gelukt, 1);
  const boeking = w.geboekt.find(b => b.soort === 'prijsgarantie');
  assert.equal(boeking.van, 'rtg:prijsgarantie');
  assert.equal(boeking.naar, 'lid:Anemoon');
  assert.equal(boeking.centen, 300, 'het verschil uit de melding, niet een nieuw bedrag');
});

/* DE BEWERING. Een ronde die per ongeluk twee keer loopt, zou anders twee keer
   betalen. */
test('3. twee keer draaien betaalt niet twee keer', async () => {
  const w = wereld();
  bestellingMetVoordeel(w, 'RTG-1', 22, 2.20);
  await w.ronde.draai();
  const naEerste = w.geboekt.length;

  const tweede = await w.ronde.draai();
  assert.equal(tweede.verrekening.ledenvoordeel.geprobeerd, 0,
    'de tweede ronde vindt niets: de stand is het stempel');
  assert.equal(w.geboekt.length, naEerste, 'en er is geen tweede boeking bij gekomen');
});

test('4. een opbouw die niet meer klopt wordt niet betaald maar afgekeurd', async () => {
  const w = wereld();
  const o = bestellingMetVoordeel(w, 'RTG-1', 22, 2.20);
  o.voordeelOpbouw.zaakOntvangtCenten = 1980;   // iemand heeft eraan gezeten

  const r = await w.ronde.draai();
  assert.equal(r.verrekening.ledenvoordeel.gelukt, 0);
  assert.equal(r.verrekening.ledenvoordeel.afgekeurd, 1);
  assert.equal(o.voordeelOpbouw.status, 'afgekeurd',
    'niet uitbetalen en niet stil overslaan: een mens hoort ernaar te kijken');
  assert.match(o.voordeelOpbouw.bezwaar, /volle bedrag/);
  assert.equal(w.geboekt.filter(b => b.soort === 'ledenvoordeel').length, 0);
});

test('5. een mislukte betaaldienstboeking krijgt zijn herkansing', async () => {
  const w = wereld();
  const f = w.fees.incasseer({ supplierCode: 'KIKUNOI', centen: 32, transactieCenten: 2200 });
  w.fees.mislukt(f, 'motor weg');
  assert.equal(w.fees.openstaand().centen, 32);

  const r = await w.ronde.draai();
  assert.equal(r.fees.gelukt, 1);
  assert.equal(w.fees.openstaand().centen, 0, 'na de ronde staat er niets meer open');
});

/* DE TWEEDE BEWERING. Zolang RTF_IBAN leeg is, hoort er niets te gebeuren -- en
   dat is precies wat de claim ook zegt. Een lege omgevingsvariabele mag geen
   betaalbaarstelling veroorzaken. */
test('6. zonder bestemming blijft de sociale afdracht gereserveerd', async () => {
  const w = wereld({ env: {} });
  w.allocatie.reserveer({ bronSoort: 'lidmaatschap', bronId: 't1', bedragCenten: 6500 });

  const r = await w.ronde.draai();
  assert.equal(r.verrekening.sociaal.gelukt, 0);
  assert.match(r.verrekening.sociaal.reden, /geen bestemming/);
  assert.equal(w.allocatie.stand().perDeel.lokaal.gereserveerd, 1300, 'nog steeds gereserveerd');

  // en MET een bestemming gebeurt het wel
  const w2 = wereld({ env: { RTF_IBAN: 'NL00RTFO0000000000', RTF_LOKAAL: 'gemeente-ibiza' } });
  w2.allocatie.reserveer({ bronSoort: 'lidmaatschap', bronId: 't1', bedragCenten: 6500 });
  const r2 = await w2.ronde.draai();
  assert.equal(r2.verrekening.sociaal.gelukt, 1);
  assert.equal(w2.allocatie.stand().perDeel.foundation.betaalbaar, 650);
});

test('7. een contract waarvan de verbintenis afloopt wordt VERLENGBAAR, en gemeld', async () => {
  const w = wereld();
  // start elf maanden geleden: het einde van de verbintenis komt binnen het venster
  const start = new Date(NU); start.setUTCMonth(start.getUTCMonth() - 11);
  const c = w.contracten.open({ pas: 'rtg', startAt: start.toISOString(), afgesprokenCenten: 6500 });
  w.contracten.bied(c); w.contracten.accepteer(c); w.contracten.activeer(c);

  const r = await w.ronde.draai();
  assert.equal(r.contracten.gezet, 1);
  assert.equal(c.status, 'VERLENGBAAR');
  assert.ok(w.meldingen.some(m => m.soort === 'contract-verlengbaar'),
    'er moet iets gebeuren, en dat hoort iemand te weten');

  /* En de ronde VERLENGT niet: dat is een besluit. Een stilzwijgende verlenging
     is precies wat `verlenging: opzegbaar` niet betekent. */
  assert.notEqual(c.status, 'ACTIEF');
  assert.equal(c.periode, 1);
});

/* DE DERDE BEWERING. Een herkansing die vastloopt mag de verlengingsronde niet
   meenemen. */
test('8. een stap die vastloopt neemt de rest niet mee', async () => {
  const w = wereld({ boekFaalt: true });
  const f = w.fees.incasseer({ supplierCode: 'A', centen: 32, transactieCenten: 2200 });
  w.fees.mislukt(f, 'weg');
  bestellingMetVoordeel(w, 'RTG-1', 22, 2.20);
  const start = new Date(NU); start.setUTCMonth(start.getUTCMonth() - 11);
  const c = w.contracten.open({ pas: 'rtg', startAt: start.toISOString(), afgesprokenCenten: 6500 });
  w.contracten.bied(c); w.contracten.accepteer(c); w.contracten.activeer(c);

  const r = await w.ronde.draai();
  assert.equal(r.fees.mislukt, 1, 'de boeking faalt');
  assert.equal(r.verrekening.ledenvoordeel.mislukt, 1, 'die ook');
  assert.equal(r.contracten.gezet, 1, 'maar de verlengingsronde is gewoon gedraaid');
  assert.equal(w.db.data.orders[0].voordeelOpbouw.status, 'te_verrekenen',
    'en een mislukte verrekening blijft openstaan');
});

/* Toets 8 test een MISLUKTE boeking (de motor zegt nee). Dat is iets anders dan
   een stap die GOOIT -- en alleen dat tweede bewijst de try per onderdeel. Een
   mutatie die de foutisolatie weghaalde, liet toets 8 groen: die kwam er nooit
   aan toe om te gooien. */
test('8b. een stap die GOOIT laat de ronde niet omvallen', async () => {
  const w = wereld();
  bestellingMetVoordeel(w, 'RTG-1', 22, 2.20);
  // de contractlaag ontploft midden in de ronde
  w.contracten.verlooptBinnen = () => { throw new Error('contractentabel stuk'); };

  const r = await w.ronde.draai();
  assert.match(r.contracten.fout, /contractentabel stuk/,
    'wat er misging hoort in de uitslag te staan, niet in een log dat niemand leest');
  assert.equal(r.verrekening.ledenvoordeel.gelukt, 1,
    'en de verrekening is gewoon gedraaid');
});

test('9. een tegoed dat tegen het plafond loopt wordt een keer gemeld, niet elke ronde', async () => {
  const w = wereld();
  w.tegoed.verbruik('Anemoon', 'rtg', 1900);      // 95%
  await w.ronde.draai();
  assert.equal(w.meldingen.filter(m => m.soort === 'ai-tegoed').length, 1);
  await w.ronde.draai();
  assert.equal(w.meldingen.filter(m => m.soort === 'ai-tegoed').length, 1,
    'een tweede ronde meldt niet nog eens hetzelfde');
});

test('10. de ronde telt op wat er nog openstaat', async () => {
  const w = wereld({ boekFaalt: true });
  bestellingMetVoordeel(w, 'RTG-1', 22, 2.20);
  bestellingMetVoordeel(w, 'RTG-2', 50, 5);
  const r = await w.ronde.draai();
  assert.equal(r.openstaand.ledenvoordeel.aantal, 2);
  assert.equal(r.openstaand.ledenvoordeel.centen, 220 + 500,
    'drie verplichtingen die wel bestonden en die niemand optelde -- nu wel');
});
