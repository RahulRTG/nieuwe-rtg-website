/* ============================================================================
   RTG PAY OPLADEN (server/kern/pay/opladen.js), MET EEN NEPBETAALWAARHEID.

   laadOp, oplaadAfronden, zorgSaldo, reconcileVanMotor, betaalMetDekking en
   bestaatLid zonder server. De betaalwaarheid is een nepobject dat per geval
   bevestigt, wacht, weigert of gooit; de idem-laag is de echte
   (server/lib/idem.js) op een opslag in het geheugen. Getoetst wordt wat er
   met geld gebeurt: de grens van 1 tot 5000 euro, het plafond VOOR de kaart,
   precies een bijschrijving per betaling, de bank als eerste dekking en het
   afronden op tientjes dat terugvalt op het exacte tekort.
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const maakIdem = require('../server/lib/idem');
const { maakOpladen } = require('../server/kern/pay/opladen');

const rek = c => 'lid:' + c;

function nepWaarheid(gedrag) {
  const rijen = {};
  let n = 0;
  const w = {
    afhandelaars: {}, gemaakt: [],
    registreerAfhandeling(soort, fn) { w.afhandelaars[soort] = fn; },
    maak(v) {
      if (gedrag.maak) gedrag.maak(v);
      const id = 'BW-' + (++n);
      rijen[id] = Object.assign({ id }, v);
      w.gemaakt.push(v);
      return rijen[id];
    },
    async begin(id) {
      const g = gedrag.begin ? await gedrag.begin(rijen[id]) : 'bevestigd';
      if (g === 'bevestigd') { await w.afhandelaars['pay-oplaad'](rijen[id]); rijen[id].afgehandeldAt = 'nu'; return { betaling: { status: 'paid' } }; }
      return g;
    },
    van(id) { return gedrag.van ? gedrag.van(rijen[id]) : rijen[id]; }
  };
  return w;
}

function opzet(extra) {
  const data = { paySaldi: {} };
  const boekingen = [];
  const saldoVan = k => data.paySaldi[k] || 0;
  let plafond = 1000000;
  const boekAsync = async ({ van, naar, centen, soort, ref, economischeSleutel }) => {
    if (soort === 'betaal' && saldoVan(van) < centen) return { status: 402, error: 'te weinig saldo' };
    if (boekingen.some(b => economischeSleutel && b.economischeSleutel === economischeSleutel)) return { ok: true, herhaald: true };
    data.paySaldi[van] = saldoVan(van) - centen;
    data.paySaldi[naar] = saldoVan(naar) + centen;
    boekingen.push({ van, naar, centen, soort, ref, economischeSleutel });
    return { ok: true };
  };
  const basis = Object.assign({
    metIdem: maakIdem({ d: () => data, save: () => {}, naam: 'payIdem' }),
    boekAsync, rekLid: rek, saldoVan, nu: () => 1, d: () => data, save: () => {},
    vrijgavePoort: null, motorklant: {}, geldModus: 'schaduw',
    keyVanCodenaam: async c => (c === 'LID-A' ? 'k-a' : c === 'GOOI' ? (() => { throw new Error('kluis'); })() : null),
    plafondFout: (r, c) => (saldoVan(r) + c > plafond ? { status: 409, error: 'plafond' } : null),
    betaalWaarheid: nepWaarheid({}),
    reserveerSleutel: () => null,
    OPLAAD_MIN: 100, MAX_CENTEN: 500000, AUTOLAAD_STAP: 1000
  }, extra || {});
  const p = maakOpladen(basis);
  return { p, data, boekingen, basis, zetPlafond: x => { plafond = x; } };
}

test('laadOp: 1 tot 5000 euro, en het plafond valt voor de kaart', async () => {
  const { p, basis, zetPlafond } = opzet();
  assert.equal((await p.laadOp({ codenaam: 'A', centen: 99, idem: 'i' })).status, 400);
  assert.equal((await p.laadOp({ codenaam: 'A', centen: 500001, idem: 'i' })).status, 400);
  assert.equal((await p.laadOp({ codenaam: 'A', centen: 'abc', idem: 'i' })).status, 400);
  zetPlafond(1000);
  assert.equal((await p.laadOp({ codenaam: 'A', centen: 2000, idem: 'i' })).error, 'plafond');
  assert.equal(basis.betaalWaarheid.gemaakt.length, 0, 'er is geen betaling aangemaakt');
});

test('laadOp zonder sleutel is een geldweigering; met sleutel bevestigd en een keer bijgeschreven', async () => {
  const { p, data, boekingen, basis } = opzet();
  const zonder = await p.laadOp({ codenaam: 'A', centen: 2500 });
  assert.equal(zonder.code, 'IDEMPOTENTIESLEUTEL_VERPLICHT');
  const r = await p.laadOp({ codenaam: 'A', centen: 2500, idem: 'tik-1', userId: 'u1' });
  assert.deepEqual(r, { ok: true, saldo: 2500, geladen: 2500, betalingId: 'BW-1' });
  assert.equal(basis.betaalWaarheid.gemaakt[0].idem, 'pay-oplaad:A:tik-1');
  assert.deepEqual(basis.betaalWaarheid.gemaakt[0].context, { codenaam: 'A', userId: 'u1', oms: 'Opladen' });
  const nog = await p.laadOp({ codenaam: 'A', centen: 2500, idem: 'tik-1' });
  assert.equal(nog.herhaald, true);
  assert.equal(data.paySaldi[rek('A')], 2500);
  assert.equal(boekingen.length, 1);
  assert.match(boekingen[0].economischeSleutel, /^pay-oplaad:[0-9a-f]{64}$/);
  assert.equal((await p.laadOp({ codenaam: 'A', centen: 3000, idem: 'tik-1' })).status, 409, 'andere afdruk, zelfde sleutel');
});

test('laadOp zonder betaalwaarheid: 503 en niets afgeschreven', async () => {
  const { p } = opzet({ betaalWaarheid: null });
  const r = await p.laadOp({ codenaam: 'A', centen: 1000, idem: 'x' });
  assert.equal(r.status, 503);
  assert.match(r.error, /niets afgeschreven/);
});

test('laadOp: maak gooit, begin gooit (twee soorten), of de betaling wacht', async () => {
  const geval = async (gedrag) => {
    const { p } = opzet({ betaalWaarheid: nepWaarheid(gedrag) });
    return p.laadOp({ codenaam: 'A', centen: 1000, idem: 'x' });
  };
  const maak = await geval({ maak: () => { throw new Error('dubbele sleutel'); } });
  assert.deepEqual([maak.status, maak.error], [409, 'dubbele sleutel']);
  const afh = await geval({ begin: () => { const e = new Error('x'); e.code = 'BETAAL_AFHANDELING_MISLUKT'; throw e; } });
  assert.equal(afh.status, 502);
  assert.equal(afh.onbekend, undefined);
  assert.match(afh.error, /bevestigd maar nog niet bijgeschreven/);
  const vaag = await geval({ begin: () => { throw new Error('time-out'); } });
  assert.equal(vaag.onbekend, true);
  assert.equal(vaag.betalingId, 'BW-1');
  const leeg = await geval({ begin: () => { throw null; } }); // eslint-disable-line no-throw-literal
  assert.equal(leeg.onbekend, true);
  const wacht = await geval({ begin: () => ({ betaling: { status: 'pending' } }) });
  assert.deepEqual([wacht.status, wacht.betaalStatus], [402, 'pending']);
  const provider = await geval({ begin: () => ({}), van: r => Object.assign({}, r, { providerStatus: 'open' }) });
  assert.equal(provider.betaalStatus, 'open');
  const niets = await geval({ begin: () => null, van: () => null });
  assert.equal(niets.betaalStatus, null);
});

test('laadOp: de opwaardeerpoort sluit, ook als interne stap', async () => {
  const { p, basis } = opzet({ vrijgavePoort: { opwaarderen: () => ({ status: 503, code: 'tijdelijk-uit', error: 'uit' }) } });
  assert.equal((await p.laadOp({ codenaam: 'A', centen: 1000, idem: 'x' })).code, 'tijdelijk-uit');
  assert.equal((await p.laadOp({ codenaam: 'A', centen: 1000, interneStap: true })).code, 'tijdelijk-uit');
  assert.equal(basis.betaalWaarheid.gemaakt.length, 0);
});

test('oplaadAfronden: geldig bedrag en een ref, de kostenmeter na de boeking', async () => {
  const { p, data } = opzet();
  assert.equal((await p.oplaadAfronden({ codenaam: 'A', centen: 0, ref: 'r' })).status, 400);
  assert.equal((await p.oplaadAfronden({ codenaam: 'A', centen: 'x', ref: 'r' })).status, 400);
  assert.match((await p.oplaadAfronden({ codenaam: 'A', centen: 10 })).error, /id van haar betaling/);
  assert.equal((await p.oplaadAfronden({ codenaam: 'A', centen: 10, ref: '' })).status, 400);
  const gemeten = [];
  p.koppelKosten(async v => { gemeten.push(v); });
  const r = await p.oplaadAfronden({ codenaam: 'A', centen: 750, ref: 'BW-7' });
  assert.deepEqual(r, { ok: true, saldo: 750, geladen: 750 });
  assert.deepEqual(gemeten, [{ codenaam: 'A', centen: 750, ref: 'BW-7' }]);
  p.koppelKosten(async () => { throw new Error('boekhouding stuk'); });
  assert.equal((await p.oplaadAfronden({ codenaam: 'A', centen: 50, ref: 'BW-8' })).ok, true, 'een kapotte meter raakt de oplading niet');
  p.koppelKosten('geen functie');
  assert.equal((await p.oplaadAfronden({ codenaam: 'A', centen: 50, ref: 'BW-9' })).ok, true);
  assert.equal(data.paySaldi[rek('A')], 850);
});

test('oplaadAfronden geeft een boekfout ongewijzigd terug', async () => {
  const { p } = opzet({ boekAsync: async () => ({ status: 403, error: 'waardepoort' }) });
  assert.deepEqual(await p.oplaadAfronden({ codenaam: 'A', centen: 10, ref: 'r' }), { status: 403, error: 'waardepoort' });
});

test('zorgSaldo: genoeg saldo laadt niets; anders eerst de bank', async () => {
  const { p, data } = opzet();
  data.paySaldi[rek('A')] = 5000;
  assert.deepEqual(await p.zorgSaldo({ codenaam: 'A', centen: 4000 }), { ok: true, bijgeladen: 0 });
  const gevraagd = [];
  p.koppelBank(async v => { gevraagd.push(v); return { ok: true }; });
  assert.deepEqual(await p.zorgSaldo({ codenaam: 'A', centen: 5321, idem: 'b1' }), { ok: true, bijgeladen: 321, via: 'bank' });
  assert.deepEqual(gevraagd, [{ codenaam: 'A', centen: 321, idem: 'b1' }]);
});

test('zorgSaldo: valt de bank weg, dan de kaart, afgerond op tientjes', async () => {
  const { p, data, basis } = opzet();
  p.koppelBank(async () => { throw new Error('bank dicht'); });
  const r = await p.zorgSaldo({ codenaam: 'A', centen: 1234, idem: 'z1' });
  assert.deepEqual(r, { ok: true, bijgeladen: 2000, via: 'kaart' });
  assert.equal(basis.betaalWaarheid.gemaakt[0].idem, 'pay-oplaad:A:z1:autolaad');
  assert.equal(basis.betaalWaarheid.gemaakt[0].context.oms, 'Automatisch bijgeladen');
  assert.equal(data.paySaldi[rek('A')], 2000);
  p.koppelBank(async () => ({ ok: false }));
  const tweede = await p.zorgSaldo({ codenaam: 'B', centen: 50 });
  assert.equal(tweede.bijgeladen, 1000, 'zonder sleutel een interne stap, zonder geldweigering');
  assert.match(basis.betaalWaarheid.gemaakt[1].idem, /^pay-oplaad:B:los:/);
  p.koppelBank(null);
});

test('zorgSaldo: past het tientje niet onder het plafond, dan exact het tekort (minstens het minimum)', async () => {
  const { p, data, zetPlafond } = opzet();
  data.paySaldi[rek('A')] = 1000;
  zetPlafond(2100);
  const r = await p.zorgSaldo({ codenaam: 'A', centen: 2050, idem: 'p1' });
  assert.deepEqual(r, { ok: true, bijgeladen: 1050, via: 'kaart' });
  data.paySaldi[rek('B')] = 1990;
  zetPlafond(2100);
  assert.equal((await p.zorgSaldo({ codenaam: 'B', centen: 2000, idem: 'p2' })).bijgeladen, 100, 'tekort 10, minimum 100');
});

test('zorgSaldo geeft een mislukte oplading door', async () => {
  const { p } = opzet({ betaalWaarheid: null });
  const r = await p.zorgSaldo({ codenaam: 'A', centen: 500, idem: 'q' });
  assert.equal(r.status, 503);
});

test('betaalMetDekking: eerst boeken, bij 402 bijladen en met dezelfde sleutel opnieuw', async () => {
  const { p, data } = opzet();
  data.paySaldi[rek('A')] = 300;
  const boeking = { van: rek('A'), naar: 'zaak:Z', centen: 800, soort: 'betaal' };
  const r = await p.betaalMetDekking({ codenaam: 'A', centen: 800, idem: 'd1', boeking });
  assert.equal(r.z.bijgeladen, 1000);
  assert.equal(r.b.ok, true);
  assert.equal(data.paySaldi['zaak:Z'], 800);
  const genoeg = await p.betaalMetDekking({ codenaam: 'A', centen: 100, idem: 'd2', boeking: Object.assign({}, boeking, { centen: 100 }) });
  assert.equal(genoeg.z.bijgeladen, 0);
  assert.equal(genoeg.b.ok, true);
});

test('bestaatLid: ja, nee, en een kluis die gooit is nee', async () => {
  const { p } = opzet();
  assert.equal(await p.bestaatLid('LID-A'), true);
  assert.equal(await p.bestaatLid('NIEMAND'), false);
  assert.equal(await p.bestaatLid('GOOI'), false);
});

test('reconcileVanMotor: overgeslagen buiten motorstand, anders de saldi van de motor', async () => {
  assert.deepEqual(await opzet().p.reconcileVanMotor(), { ok: true, overgeslagen: true });
  const saldi = Object.create({ geerfd: 5 });
  Object.assign(saldi, { 'lid:A': '1200', 'lid:B': 0, 'zaak:Z': -200.4 });
  const { p, data } = opzet({ geldModus: 'motor', motorklant: { saldiSnapshot: async () => ({ saldi }) } });
  assert.deepEqual(await p.reconcileVanMotor(), { ok: true, rekeningen: 2, som: 1000 });
  assert.deepEqual(data.paySaldi, { 'lid:A': 1200, 'zaak:Z': -200 });
  const fout = opzet({ geldModus: 'motor', motorklant: { saldiSnapshot: async () => ({ error: 'motor weg' }) } });
  assert.deepEqual(await fout.p.reconcileVanMotor(), { ok: false, error: 'motor weg' });
  const leeg = opzet({ geldModus: 'motor', motorklant: { saldiSnapshot: async () => null } });
  assert.match((await leeg.p.reconcileVanMotor()).error, /Geen saldi/);
});
