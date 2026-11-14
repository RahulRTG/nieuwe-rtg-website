'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { plan } = require('../server/kern/commercie/abonnementsverrekening');

const VAN = '2026-01-01T00:00:00.000Z', TOT = '2026-02-01T00:00:00.000Z';
const HALF = '2026-01-16T12:00:00.000Z';
function bron(centen = 25000) {
  return {
    contract: { id: 'C-oud', accountId: 42, startAt: VAN, afgesprokenCenten: centen },
    facturen: [{ id: 'INV-1', desc: 'Maandbijdrage lidmaatschap', status: 'paid', bijdrage: centen / 100,
      abonnement: { contractId: 'C-oud', accountId: 42, van: VAN, tot: TOT, brutoCenten: centen, valuta: 'eur' },
      betaalBewijzen: [{ id: 'BW-1', centen }] }],
    betaalWaarheid: { 'BW-1': { id: 'BW-1', actor: 'acc:42', soort: 'factuur', bronRef: 'INV-1',
      centen, valuta: 'eur', status: 'BEVESTIGD', provider: 'stripe', providerId: 'pi_1',
      context: { own: true, accountId: 42, invoiceId: 'INV-1' }, afgehandeldAt: VAN,
      terugbetaaldCenten: 0 } },
    contracten: [], op: HALF, doelCenten: 40000
  };
}
const factuur = b => b.facturen[0], waarheid = b => b.betaalWaarheid['BW-1'];
function controle(b, tekst) {
  const r = plan(b);
  assert.equal(r.ok, false); assert.equal(r.controleNodig, true);
  for (const k of ['creditCenten', 'teBetalenCenten', 'beschikbaarCenten', 'overCenten']) assert.equal(r[k], null);
  assert.deepEqual(r.regels, []);
  if (tekst) assert.match(r.redenen.join(' '), tekst);
}

test('halve werkelijk betaalde periode geeft halve oorspronkelijke prijs, zonder mutaties', () => {
  const b = bron(), voor = structuredClone(b), r = plan(b);
  assert.equal(r.ok, true); assert.equal(r.creditCenten, 12500); assert.equal(r.teBetalenCenten, 27500);
  assert.equal(r.regels[0].factuurId, 'INV-1'); assert.deepEqual(r.regels[0].betaalWaarheidIds, ['BW-1']);
  assert.deepEqual(b, voor); assert.deepEqual(plan(b), r);
});

test('korting blijft in originele jaarfactuur; geen twaalfmaal actuele maandprijs', () => {
  const b = bron(287500);
  factuur(b).abonnement.tot = '2027-01-01T00:00:00.000Z';
  b.op = '2026-07-02T12:00:00.000Z'; b.doelCenten = 460000;
  const r = plan(b);
  assert.equal(r.creditCenten, 143750); assert.equal(r.teBetalenCenten, 316250);
});

test('afronding is naar beneden op centen, ook bij grote veilige bedragen', () => {
  const b = bron(101); assert.equal(plan(b).creditCenten, 50);
  const groot = bron(9000000000000000); groot.doelCenten = Number.MAX_SAFE_INTEGER;
  assert.equal(plan(groot).creditCenten, 4500000000000000);
});

test('31 dagen en februari gebruiken exacte intervalgrenzen, geen vaste dertig dagen', () => {
  const b = bron(3100); b.op = '2026-01-02T00:00:00.000Z';
  assert.equal(plan(b).creditCenten, 3000);
  factuur(b).abonnement.van = '2028-02-01T00:00:00.000Z';
  factuur(b).abonnement.tot = '2028-03-01T00:00:00.000Z';
  b.op = '2028-02-29T00:00:00.000Z';
  assert.equal(plan(b).creditCenten, Math.floor(3100 / 29));
});

test('start inclusief, einde exclusief, en vooruitbetaalde toekomstige periode geheel ongebruikt', () => {
  const b = bron(); b.op = VAN; assert.equal(plan(b).creditCenten, 25000);
  b.op = TOT; assert.equal(plan(b).creditCenten, 0);
  factuur(b).abonnement.van = TOT; factuur(b).abonnement.tot = '2026-03-01T00:00:00.000Z';
  b.op = HALF; assert.equal(plan(b).creditCenten, 25000);
  b.contract.eindigtOp = HALF; assert.equal(plan(b).creditCenten, 0);
});

test('credit overschrijdt doel niet; overbedrag is geen automatische terugbetaling', () => {
  const b = bron(); b.doelCenten = 1000;
  const r = plan(b);
  assert.equal(r.creditCenten, 1000); assert.equal(r.regels[0].centen, 1000);
  assert.equal(r.beschikbaarCenten, 12500); assert.equal(r.overCenten, 11500); assert.equal(r.teBetalenCenten, 0);
  assert.equal(r.regels[0].overCenten, 11500);
  b.doelCenten = 0; assert.equal(plan(b).creditCenten, 0); assert.equal(plan(b).overCenten, 12500);
});

test('open of administratief voldaan zonder bewijs levert geen credit op', () => {
  for (const status of ['open', 'voldaan']) {
    const b = bron(); factuur(b).status = status; delete factuur(b).betaalBewijzen;
    const r = plan(b); assert.equal(r.creditCenten, 0); assert.equal(r.teBetalenCenten, 40000);
    assert.equal(r.overgeslagen[0].reden, 'niet-aantoonbaar-betaald');
  }
  const b = bron(); delete factuur(b).betaalBewijzen; controle(b, /zonder gekoppeld betaalbewijs/);
});

test('onbewezen oude abonnementsfactuur is onbekend en nooit een stille nul', () => {
  const b = bron(); delete factuur(b).abonnement; controle(b, /periodebinding/);
  factuur(b).abonnement = {}; controle(b, /broncontract/);
  b.facturen = [{ id: 'TRIP', desc: 'Hotel', status: 'paid', bijdrage: 400 }];
  controle(b, /geen gekoppelde bronfactuur/);
  b.facturen = []; controle(b); b.contract.afgesprokenCenten = 0;
  assert.equal(plan(b).creditCenten, 0);
});

test('alle identiteits-, prijs- en valutabindingen zijn vereist', () => {
  const wijzigingen = [
    b => { b.contract.accountId = null; },
    b => { factuur(b).abonnement.accountId = 43; },
    b => { waarheid(b).actor = 'acc:43'; },
    b => { waarheid(b).context.accountId = 43; },
    b => { waarheid(b).context.own = false; },
    b => { waarheid(b).context.invoiceId = 'INV-2'; },
    b => { waarheid(b).bronRef = 'INV-2'; },
    b => { waarheid(b).soort = 'direct'; },
    b => { waarheid(b).id = 'BW-2'; },
    b => { waarheid(b).valuta = 'usd'; },
    b => { factuur(b).abonnement.valuta = 'usd'; },
    b => { factuur(b).bijdrage = 251; },
    b => { waarheid(b).centen -= 1; },
    b => { delete waarheid(b).providerId; },
    b => { delete waarheid(b).afgehandeldAt; },
    b => { waarheid(b).afgehandeldAt = TOT; },
    b => { delete b.contracten; }
  ];
  for (const wijzig of wijzigingen) { const b = bron(); wijzig(b); controle(b); }
});

test('pending, actie nodig, controle en deelbetaling activeren geen broncredit', () => {
  for (const status of ['AANGEMAAKT', 'WACHT_OP_KLANT', 'IN_BEHANDELING', 'CONTROLE_NODIG', 'GEWEIGERD']) {
    const b = bron(); waarheid(b).status = status; controle(b);
  }
  const b = bron(); waarheid(b).centen = 10000; factuur(b).betaalBewijzen[0].centen = 10000;
  controle(b, /niet volledig en exact betaald/);
});

test('dubbel bewijs, dubbele factuur en overlapping geven geen dubbele credit', () => {
  const dubbel = bron(); factuur(dubbel).betaalBewijzen.push({ id: 'BW-1', centen: 25000 }); controle(dubbel, /dubbel/);
  const facturen = bron(); facturen.facturen.push(structuredClone(factuur(facturen))); controle(facturen, /unieke/);
  const overlap = bron(); const f = structuredClone(factuur(overlap)); f.id = 'INV-2'; f.betaalBewijzen = [{ id: 'BW-2', centen: 25000 }];
  const w = structuredClone(waarheid(overlap)); w.id = 'BW-2'; w.bronRef = 'INV-2'; w.context.invoiceId = 'INV-2'; w.providerId = 'pi_2';
  overlap.facturen.push(f); overlap.betaalWaarheid['BW-2'] = w;
  controle(overlap, /overlappen/);
  w.providerPaymentId = 'pi_1'; controle(overlap, /providerbetaling/);
});

test('bevestigde refund wordt volledig van ongebruikt deel afgetrokken, nooit nogmaals naar rato', () => {
  const b = bron(); waarheid(b).status = 'GEDEELTELIJK_TERUGBETAALD'; waarheid(b).terugbetaaldCenten = 5000;
  assert.equal(plan(b).creditCenten, 7500);
  waarheid(b).terugbetaaldCenten = 20000; assert.equal(plan(b).creditCenten, 0);
  waarheid(b).status = 'TERUGBETAALD'; waarheid(b).terugbetaaldCenten = 25000;
  assert.equal(plan(b).creditCenten, 0);
});

test('pending of inconsistente refund blokkeert ook als de betaling definitief heet', () => {
  const wijzigingen = [
    b => { waarheid(b).status = 'TERUGBETALING_WACHT'; },
    b => { waarheid(b).terugbetaalOpdrachten = [{ status: 'VASTGELEGD', centen: 100 }]; },
    b => { waarheid(b).terugbetaalOpdrachten = [{ status: 'CONTROLE_NODIG', centen: 100 }]; },
    b => { waarheid(b).terugbetaalOpdrachten = {}; },
    b => { waarheid(b).terugbetaaldCenten = -1; },
    b => { waarheid(b).terugbetaaldCenten = 25001; },
    b => { waarheid(b).terugbetaaldCenten = 100; },
    b => { waarheid(b).status = 'TERUGBETAALD'; }
  ];
  for (const wijzig of wijzigingen) { const b = bron(); wijzig(b); controle(b, /terugbetaling/i); }
});

test('eerder gereserveerde of gebruikte bron is expliciet uitgesloten, ook bij gedeeltelijke credit', () => {
  for (const status of ['GERESERVEERD', 'TOEGEPAST']) {
    const b = bron(); b.contracten.push({ id: 'C-nieuw', accountId: 42,
      verrekening: { bronContractId: 'C-oud', status, regels: [{ factuurId: 'INV-1', centen: 1 }] } });
    const r = plan(b); assert.equal(r.creditCenten, 0);
    assert.equal(r.overgeslagen[0].doelContractId, 'C-nieuw');
    b.contracten[0].verrekening.status = 'VRIJGEGEVEN'; assert.equal(plan(b).creditCenten, 12500);
  }
});

test('eerdere credit met ontbrekende of vreemde eigenaar en onbekende stand blokkeert', () => {
  const b = bron(); b.contracten = [{ id: 'C-anders', accountId: 43,
    verrekening: { bronContractId: 'C-oud', status: 'TOEGEPAST', regels: [{ factuurId: 'INV-1', centen: 100 }] } }];
  controle(b, /eigenaar of stand/); b.contracten[0].accountId = 42;
  b.contracten[0].verrekening.status = 'ONBEKEND'; controle(b, /eigenaar of stand/);
});

test('ongeldige datums, tijdvakken en onveilige bedragen worden geweigerd', () => {
  const wijzigingen = [
    b => { b.op = '2026-02-30T00:00:00.000Z'; },
    b => { b.op = '2025-12-31T00:00:00.000Z'; },
    b => { factuur(b).abonnement.tot = VAN; },
    b => { factuur(b).abonnement.van = '2025-12-01T00:00:00.000Z'; },
    b => { factuur(b).abonnement.brutoCenten = 1.1; },
    b => { b.contract.eindigtOp = 'ongeldig'; },
    b => { b.doelCenten = Number.MAX_SAFE_INTEGER + 1; },
    b => { b.doelCenten = -1; }
  ];
  for (const wijzig of wijzigingen) { const b = bron(); wijzig(b); controle(b); }
});
