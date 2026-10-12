/* ============================================================================
   DE IDEM-LAAG (server/lib/idem.js), TAK VOOR TAK.

   De bestaande toetsen meten de hoofdroute: dezelfde sleutel geeft hetzelfde
   antwoord, een andere afdruk een 409. Hier de randen die daar niet langs
   komen: geen sleutel bij geld, de sleutelplicht, de vrijgavepoort met en
   zonder sleutel, een gelijktijdige vlucht met een andere afdruk, werk dat
   gooit, de ring van bewaarde sleutels, de bundel (bijeen) en een beschadigde
   opslag. Alles in het geheugen; er wordt niets op schijf geschreven.
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const maakIdem = require('../server/lib/idem');

function opzet(extra) {
  const data = {};
  let saves = 0;
  const idem = maakIdem(Object.assign({ d: () => data, save: () => { saves++; }, naam: 'proefIdem' }, extra || {}));
  return { idem, data, saves: () => saves };
}

test('geen sleutel bij een geldopdracht is een 400 met de reden van de aanroeper', async () => {
  const { idem } = opzet();
  let gedaan = 0;
  const r = await idem('', 'a', async () => { gedaan++; return { ok: true }; }, { geld: 'overboeking naar derde' });
  assert.equal(r.status, 400);
  assert.equal(r.code, 'IDEMPOTENTIESLEUTEL_VERPLICHT');
  assert.equal(r.waarom, 'overboeking naar derde');
  assert.equal(gedaan, 0, 'het werk mag niet draaien');
});

test('sleutelplicht weigert zonder sleutel, maar niet als hij uit staat', async () => {
  let plicht = true;
  const { idem } = opzet({ sleutelPlicht: () => plicht });
  let gedaan = 0;
  const werk = async () => { gedaan++; return { ok: true, n: gedaan }; };
  const r1 = await idem(null, null, werk);
  assert.equal(r1.status, 400);
  assert.match(r1.waarom, /grootboek/);
  assert.equal(gedaan, 0);
  plicht = false;
  const r2 = await idem(null, null, werk);
  assert.deepEqual(r2, { ok: true, n: 1 });
});

test('sleutelplicht geldt niet binnen een lopende handeling', async () => {
  const { idem } = opzet({ sleutelPlicht: () => true });
  const r = await idem('buiten', 'x', async () => {
    const binnen = await idem(null, null, async () => ({ ok: true, binnen: true }));
    return { ok: true, binnen };
  });
  assert.equal(r.ok, true);
  assert.deepEqual(r.binnen, { ok: true, binnen: true });
});

test('de vrijgavepoort sluit nieuw werk zonder sleutel en met sleutel', async () => {
  let dicht = { status: 503, code: 'uit', error: 'staat uit' };
  const { idem, data } = opzet({ poort: () => dicht });
  let gedaan = 0;
  const werk = async () => { gedaan++; return { ok: true }; };
  assert.equal((await idem(null, null, werk)).status, 503);
  assert.equal((await idem('k1', 'a', werk)).code, 'uit');
  assert.equal(gedaan, 0);
  assert.equal('k1' in (data.proefIdem || {}), false, 'een weigering wordt niet bewaard');
  dicht = null;
  const r = await idem('k1', 'a', werk);
  assert.equal(r.ok, true);
  assert.equal(gedaan, 1);
});

test('een bewaarde herhaling komt terug, ook als de poort intussen dicht is', async () => {
  let dicht = null;
  const { idem } = opzet({ poort: () => dicht });
  await idem('k', 'a', async () => ({ ok: true, bedrag: 500 }));
  dicht = { status: 503, error: 'uit' };
  const r = await idem('k', 'a', async () => { throw new Error('mag niet draaien'); });
  assert.equal(r.herhaald, true);
  assert.equal(r.bedrag, 500);
});

test('een afwikkeling slaat de poort van de laag over', async () => {
  const { idem } = opzet({ poort: () => ({ status: 503, error: 'uit' }) });
  const r = await idem('t1', 'a', async () => ({ ok: true, terug: 100 }), { afwikkeling: 'terugbetaling' });
  assert.equal(r.terug, 100);
});

test('een poort die gooit is dicht met de veilige code', async () => {
  const { idem } = opzet({ poort: () => { throw new Error('kapot'); } });
  const r = await idem('g1', 'a', async () => ({ ok: true }));
  assert.equal(r.status, 503);
  assert.equal(r.code, 'tijdelijk-uit');
});

test('een gelijktijdige vlucht met een andere afdruk krijgt 409, met dezelfde afdruk het antwoord', async () => {
  const { idem } = opzet();
  let los;
  const poort = new Promise(res => { los = res; });
  let gedaan = 0;
  const eerste = idem('v', 'afdruk-1', async () => { gedaan++; await poort; return { ok: true, id: 7 }; });
  const ander = await idem('v', 'afdruk-2', async () => ({ ok: true, id: 8 }));
  assert.equal(ander.status, 409);
  const tweede = idem('v', 'afdruk-1', async () => ({ ok: true, id: 9 }));
  los();
  const [r1, r2] = await Promise.all([eerste, tweede]);
  assert.equal(r1.id, 7);
  assert.equal(r1.herhaald, undefined);
  assert.equal(r2.id, 7);
  assert.equal(r2.herhaald, true);
  assert.equal(gedaan, 1);
});

test('een wachter op een vlucht die een niet-object teruggeeft krijgt dat ongewijzigd', async () => {
  const { idem, data } = opzet();
  let los;
  const p = new Promise(res => { los = res; });
  const eerste = idem('n', '', async () => { await p; return 'klaar'; });
  const tweede = idem('n', '', async () => 'ander');
  los();
  assert.equal(await eerste, 'klaar');
  assert.equal(await tweede, 'klaar');
  assert.equal('n' in data.proefIdem, false, 'een antwoord zonder ok wordt niet bewaard');
});

test('werk dat gooit: de fout gaat door, een wachter krijgt 500, en een nieuwe poging mag', async () => {
  const { idem, data, saves } = opzet();
  let los;
  const p = new Promise(res => { los = res; });
  const eerste = idem('f', 'a', async () => { await p; throw new Error('bank weg'); });
  const wachter = idem('f', 'a', async () => ({ ok: true }));
  los();
  await assert.rejects(eerste, /bank weg/);
  const w = await wachter;
  assert.equal(w.status, 500);
  assert.equal(w.herhaald, true);
  assert.equal(saves(), 0);
  assert.equal(data.proefIdem._keys.length, 0);
  const opnieuw = await idem('f', 'a', async () => ({ ok: true, tweede: true }));
  assert.equal(opnieuw.tweede, true);
  assert.equal(data.proefIdem._keys.length, 1);
  assert.equal(saves(), 1);
});

test('de ring houdt hoogstens 20000 sleutels en gooit de oudste met afdruk weg', async () => {
  const { idem, data } = opzet();
  const keys = [];
  data.proefIdem = { _keys: keys };
  data.proefIdemAfdruk = {};
  for (let i = 0; i < 20000; i++) { const k = 'o' + i; keys.push(k); data.proefIdem[k] = { ok: true }; data.proefIdemAfdruk[k] = 'x'; }
  await idem('nieuw', 'af', async () => ({ ok: true }));
  assert.equal(data.proefIdem._keys.length, 20000);
  assert.equal('o0' in data.proefIdem, false);
  assert.equal('o0' in data.proefIdemAfdruk, false);
  assert.equal('o1' in data.proefIdem, true);
  assert.equal(data.proefIdemAfdruk.nieuw, 'af');
});

test('bijeen bundelt werk en vastlegging, met en zonder duurzaam', async () => {
  const opties = [];
  const bijeen = async (fn, o) => { opties.push(o); await fn(); };
  const a = opzet({ bijeen });
  const r = await a.idem('b1', 'x', async () => ({ ok: true }));
  assert.equal(r.ok, true);
  assert.equal(a.saves(), 1);
  const b = opzet({ bijeen, duurzaam: true });
  await b.idem('b2', 'x', async () => ({ ok: true }));
  assert.deepEqual(opties, [undefined, { duurzaam: true }]);
});

test('een beschadigde opslag wordt hersteld', async () => {
  const { idem, data } = opzet();
  data.proefIdem = 'kapot';
  data.proefIdemAfdruk = 5;
  await idem('a', 'x', async () => ({ ok: true }));
  assert.deepEqual(data.proefIdem._keys, ['a']);
  assert.equal(data.proefIdemAfdruk.a, 'x');
  data.proefIdem._keys = 'ook kapot';
  const r = await idem('b', '', async () => ({ ok: true, eigen: 1 }));
  assert.equal(r.eigen, 1);
  assert.deepEqual(data.proefIdem._keys, ['b']);
});

test('een oude sleutel zonder afdruk gaat door als herhaling', async () => {
  const { idem, data } = opzet();
  data.proefIdem = { _keys: ['oud'], oud: { ok: true, id: 3 } };
  const r = await idem('oud', 'nieuwe-afdruk', async () => ({ ok: true, id: 4 }));
  assert.equal(r.id, 3);
  assert.equal(r.herhaald, true);
  data.proefIdemAfdruk.oud = 'eerdere';
  const zonder = await idem('oud', '', async () => ({ ok: true, id: 5 }));
  assert.equal(zonder.id, 3, 'zonder afdruk is er niets om tegen te toetsen');
  assert.equal((await idem('oud', 'andere', async () => ({ ok: true }))).status, 409);
});

test('volgendeStap telt binnen de handeling en is null daarbuiten', async () => {
  const { idem } = opzet();
  assert.equal(maakIdem.volgendeStap(), null);
  const r = await idem('s', 'x', async () => ({ ok: true, a: maakIdem.volgendeStap(), b: maakIdem.volgendeStap() }));
  assert.deepEqual(r.a, { naam: 'proefIdem', sleutel: 's', stap: 0 });
  assert.equal(r.b.stap, 1);
});
