/* ============================================================================
   DE SCHRIJFWEG VAN RTG PAY (server/kern/pay/boeking.js), MET NEPMOTOR.

   boek, boekAsync en reserveerSleutel, afslag voor afslag: betalingen uit,
   de synchrone guard die in motorstand luid weigert, bedrag- en
   rekeningcontroles, de waardepoort, de sleutel van de aanroeper (goed en
   fout van vorm), de sleutel uit de idem-handeling, en in motorstand de
   bevestiging van de motor die exact wordt overgenomen -- of juist niet,
   als de motor weigert, zwijgt of geen saldi teruggeeft. Alles in het
   geheugen; de motor is een nepobject.
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const maakBoeking = require('../server/kern/pay/boeking');
const { maakSleutel } = require('../server/db/economische-identiteit');
const { handeling } = require('../server/lib/idem-handeling');

const OUD_ENV = process.env.NODE_ENV;
test.before(() => { process.env.NODE_ENV = 'test'; });
test.after(() => { if (OUD_ENV === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = OUD_ENV; });

function opzet(extra) {
  const staat = { saldi: {}, boekingen: [], saves: 0, gespiegeld: [], n: 0, motor: [] };
  const deps = Object.assign({
    saldi: () => staat.saldi,
    saldoVan: k => staat.saldi[k] || 0,
    grootboek: () => staat.boekingen,
    payBoekingenVoegToe: rij => staat.boekingen.push(rij),
    save: () => { staat.saves++; },
    id: p => p + '-' + (++staat.n),
    schoon: (s, n) => String(s || '').slice(0, n),
    nu: () => '2026-10-01T09:00:00.000Z',
    waardePoort: () => null,
    betalingenUit: false,
    uitFout: () => ({ status: 503, error: 'betalingen staan uit' }),
    geldModus: 'schaduw',
    motorklant: {},
    schaduw: { spiegel: rij => staat.gespiegeld.push(rij.id) },
    MIN_CENTEN: 1, MAX_CENTEN: 500000
  }, extra || {});
  return { b: maakBoeking(deps), staat };
}

test('met betalingen uit boekt niets, synchroon en async', async () => {
  const { b, staat } = opzet({ betalingenUit: true });
  assert.equal(b.boek({ van: 'a', naar: 'b', centen: 5 }).status, 503);
  assert.equal((await b.boekAsync({ van: 'a', naar: 'b', centen: 5 })).error, 'betalingen staan uit');
  assert.equal(staat.boekingen.length, 0);
});

test('boek: bedrag, rekeningen en de waardepoort worden eerst getoetst', () => {
  let dicht = null;
  const { b, staat } = opzet({ waardePoort: v => dicht && Object.assign({ gezien: v }, dicht) });
  assert.equal(b.boek({ van: 'a', naar: 'b', centen: 0 }).status, 400);
  assert.equal(b.boek({ van: 'a', naar: 'b', centen: 'x' }).status, 400);
  assert.equal(b.boek({ van: 'a', naar: 'b', centen: 500001 }).status, 400);
  assert.match(b.boek({ van: '', naar: 'b', centen: 5 }).error, /Van en naar/);
  assert.match(b.boek({ van: 'a', naar: 'a', centen: 5 }).error, /Van en naar/);
  dicht = { status: 403, error: 'waardeklasse' };
  const w = b.boek({ van: 'a', naar: 'b', centen: 5.4, soort: 'x', genre: 'g', dagBesteed: 3 });
  assert.equal(w.status, 403);
  assert.deepEqual(w.gezien, { van: 'a', naar: 'b', centen: 5, soort: 'x', genre: 'g', dagBesteed: 3 });
  assert.equal(staat.boekingen.length, 0);
  dicht = null;
  const r = b.boek({ van: 'a', naar: 'b', centen: 250, oms: 'koffie' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.boeking, { id: 'PB-1', van: 'a', naar: 'b', centen: 250, soort: 'boeking', oms: 'koffie', ref: null,
    at: '2026-10-01T09:00:00.000Z' });
  assert.deepEqual(staat.saldi, { a: -250, b: 250 });
  assert.deepEqual(staat.gespiegeld, ['PB-1']);
  assert.equal(staat.saves, 1);
});

test('pasToe past een rij toe zonder poort', () => {
  const { b, staat } = opzet();
  staat.saldi.a = 1000;
  b.pasToe({ id: 'X', van: 'a', naar: 'c', centen: 400 });
  assert.deepEqual(staat.saldi, { a: 600, c: 400 });
  assert.equal(staat.boekingen.length, 1);
});

test('de synchrone guard gooit in motorstand', () => {
  const { b } = opzet({ geldModus: 'motor' });
  assert.throws(() => b.boek({ van: 'a', naar: 'b', centen: 5 }), /niet toegestaan in RTG_MOTOR_GELD=motor/);
});

test('boekAsync in schaduwstand: zonder sleutel gewoon boek, met sleutel een keer', async () => {
  const { b, staat } = opzet();
  const los = await b.boekAsync({ van: 'a', naar: 'b', centen: 100, soort: 'oplaad' });
  assert.equal(los.boeking.id, 'PB-1');
  const sleutel = maakSleutel('pay-oplaad', ['BW-1']);
  const een = await b.boekAsync({ van: 'x', naar: 'y', centen: 300, soort: 'oplaad', ref: 'BW-1', economischeSleutel: sleutel });
  assert.equal(een.ok, true);
  const twee = await b.boekAsync({ van: 'x', naar: 'y', centen: 300, soort: 'oplaad', ref: 'BW-1', economischeSleutel: sleutel });
  assert.equal(twee.herhaald, true);
  assert.equal(twee.boeking.id, een.boeking.id);
  assert.equal(staat.saldi.y, 300, 'een herhaling schrijft niet twee keer bij');
  assert.equal(b.reserveerSleutel(), null, 'buiten motorstand geen sleutel');
});

test('boekAsync met een duurzame opslag: boekEenmaal draagt de sleutel', async () => {
  const gezien = [];
  const { b } = opzet({ boekEenmaal: async (v, werk) => { gezien.push(v); return werk(); } });
  const sleutel = maakSleutel('pay-oplaad', ['BW-2']);
  const r = await b.boekAsync({ van: 'x', naar: 'y', centen: 70, soort: 'oplaad', ref: 'BW-2', economischeSleutel: sleutel });
  assert.equal(r.ok, true);
  assert.equal(gezien.length, 1);
  assert.equal(gezien[0].sleutel, sleutel);
  assert.deepEqual(gezien[0].collecties, ['paySaldi', 'payBoekingen']);
});

test('een sleutel van de verkeerde vorm gooit luid, en er is niets geboekt', async () => {
  const { b, staat } = opzet();
  await assert.rejects(b.boekAsync({ van: 'a', naar: 'b', centen: 5, economischeSleutel: 'pay-oplaad:BW-1' }),
    e => e.code === 'ECONOMISCHE_SLEUTEL_ONGELDIG');
  assert.equal(staat.boekingen.length, 0);
});

test('motorstand zonder sleutel en buiten een handeling gooit', async () => {
  const { b } = opzet({ geldModus: 'motor' });
  await assert.rejects(b.boekAsync({ van: 'a', naar: 'b', centen: 5 }), e => e.code === 'ECONOMISCHE_SLEUTEL_ONTBREEKT');
  assert.throws(() => b.reserveerSleutel(), e => e.code === 'ECONOMISCHE_SLEUTEL_ONTBREEKT');
});

function motorMet(antwoord, bekend) {
  const vragen = [];
  return { vragen, klant: {
    boekGuard: async v => { vragen.push(['guard', v]); return typeof antwoord === 'function' ? antwoord(v) : antwoord; },
    boekBekend: async v => { vragen.push(['bekend', v]); return bekend; }
  } };
}

test('motorstand: de bevestigde boeking wordt exact overgenomen, met de stapsleutel', async () => {
  const m = motorMet(v => ({ ok: true, saldoVan: '-500', saldoNaar: 500,
    boeking: { id: 'M-1', van: v.van, naar: v.naar, centen: '500' } }));
  const { b, staat } = opzet({ geldModus: 'motor', motorklant: m.klant });
  const r = await handeling.run({ naam: 'payIdem', sleutel: 'k1', stappen: 0 }, async () => {
    const vooraf = b.reserveerSleutel();
    const boek = await b.boekAsync({ van: 'lid', naar: 'zaak', centen: 500, soort: 'betaal', oms: 'x' });
    return { vooraf, boek };
  });
  assert.equal(r.vooraf, maakSleutel('pay-stap', ['payIdem', 'k1', 0]));
  assert.equal(m.vragen[0][1].economischeSleutel, maakSleutel('pay-stap', ['payIdem', 'k1', 1]), 'elke stap een eigen sleutel');
  assert.deepEqual(r.boek.boeking, { id: 'M-1', van: 'lid', naar: 'zaak', centen: 500, soort: 'boeking', oms: '', ref: null,
    at: '2026-10-01T09:00:00.000Z' });
  assert.equal(r.boek.herhaald, false);
  assert.deepEqual(staat.saldi, { lid: -500, zaak: 500 });
  assert.equal(staat.boekingen.length, 1);
});

test('motorstand: een herhaling met een bekende id voegt geen regel toe', async () => {
  const sleutel = maakSleutel('pay-oplaad', ['BW-9']);
  const m = motorMet({ ok: true, herhaald: true, saldoVan: 0, saldoNaar: 900,
    boeking: { id: 'M-9', van: 'extern', naar: 'lid', centen: 900, soort: 'oplaad', oms: 'op', ref: 'BW-9', at: 'toen' } });
  const { b, staat } = opzet({ geldModus: 'motor', motorklant: m.klant });
  staat.boekingen.push(null, { id: 'M-9' });
  const r = await b.boekAsync({ van: 'extern', naar: 'lid', centen: 900, soort: 'oplaad', ref: 'BW-9', economischeSleutel: sleutel });
  assert.equal(r.herhaald, true);
  assert.equal(r.boeking.at, 'toen');
  assert.equal(staat.boekingen.length, 2);
  assert.equal(staat.saldi.lid, 900);
});

test('motorstand: weigering, stilte of geen saldi laten de spiegel ongemoeid', async () => {
  const sleutel = maakSleutel('pay-oplaad', ['BW-3']);
  const args = { van: 'a', naar: 'b', centen: 5, ref: 'BW-3', economischeSleutel: sleutel };
  const geval = async antwoord => {
    const { b, staat } = opzet({ geldModus: 'motor', motorklant: motorMet(antwoord).klant });
    const r = await b.boekAsync(args);
    return { r, staat };
  };
  const w = await geval({ status: 402, error: 'te weinig' });
  assert.deepEqual([w.r.status, w.r.error], [402, 'te weinig']);
  const zonderStatus = await geval({ error: 'stuk' });
  assert.equal(zonderStatus.r.status, 502);
  const stil = await geval(null);
  assert.deepEqual([stil.r.status, stil.r.error], [502, 'Motor onbereikbaar.']);
  const geenSaldi = await geval({ ok: true, boeking: { id: 'M', van: 'a', naar: 'b', centen: 5 } });
  assert.match(geenSaldi.r.error, /geen actuele saldi/);
  assert.deepEqual(geenSaldi.staat.saldi, {});
  assert.equal(geenSaldi.staat.saves, 0);
});

test('motorstand met een dichte poort: alleen een bekende boeking komt terug', async () => {
  const sleutel = maakSleutel('pay-oplaad', ['BW-4']);
  const dicht = { status: 403, error: 'poort dicht' };
  const onbekend = motorMet(null, { ok: false });
  const a = opzet({ geldModus: 'motor', motorklant: onbekend.klant, waardePoort: () => dicht });
  assert.equal(await a.b.boekAsync({ van: 'a', naar: 'b', centen: 5, economischeSleutel: sleutel }), dicht);
  assert.deepEqual(onbekend.vragen.map(v => v[0]), ['bekend'], 'de motor boekt hier niets');
  const leeg = motorMet(null, null);
  const c = opzet({ geldModus: 'motor', motorklant: leeg.klant, waardePoort: () => dicht });
  assert.equal(await c.b.boekAsync({ van: 'a', naar: 'b', centen: 5, economischeSleutel: sleutel }), dicht);
  const bekend = motorMet(null, { ok: true, herhaald: true, saldoVan: 0, saldoNaar: 5,
    boeking: { id: 'M-4', van: 'a', naar: 'b', centen: 5 } });
  const d = opzet({ geldModus: 'motor', motorklant: bekend.klant, waardePoort: () => dicht });
  const r = await d.b.boekAsync({ van: 'a', naar: 'b', centen: 5, economischeSleutel: sleutel });
  assert.equal(r.ok, true);
  assert.equal(r.herhaald, true);
  assert.equal(d.staat.boekingen.length, 1);
});
