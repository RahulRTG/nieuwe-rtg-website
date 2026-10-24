'use strict';
/* De echte idem- en bundellaag, met uitsluitend de opslagbevestiging onder
   testcontrole. De tweede client komt NADAT werk + idemantwoord in het
   geheugen staan, maar VOORDAT de commit bevestigd of teruggedraaid is.
   Geen server, database, timervertraging of productie-instelling nodig. */
const test = require('node:test');
const assert = require('node:assert/strict');
const maakIdem = require('../server/lib/idem');
const maakBundel = require('../server/db/bijeen');
const postgres = require('../server/db/postgres');

function sein() {
  let geef;
  const wacht = new Promise(resolve => { geef = resolve; });
  return { wacht, geef };
}

for (const terugrollen of [false, true]) test('een idem-retry wacht op de echte commituitkomst; rollback: ' + terugrollen,
  { timeout: 5000 }, async t => {
    const begin = { saldo: 1000, boekingen: [] };
    const db = { data: structuredClone(begin) };
    let opgeslagen = structuredClone(begin), werkKeren = 0, tweedeAntwoord;
    let weigerCommit = terugrollen;
    const inCommit = sein(), bevestig = sein();
    t.mock.method(postgres, 'flushVoorrangDirect', async () => {
      inCommit.geef();
      await bevestig.wacht;
      if (weigerCommit) {
        db.data = structuredClone(opgeslagen);
        throw new Error('proef: commit geweigerd en werkkopie teruggerold');
      }
      opgeslagen = structuredClone(db.data);
    });
    const bundel = maakBundel({ save: () => assert.fail('geen write-behind buiten de bundel'),
      saveDuurzaam: () => ({ bevestigbaar: true, duurzaam: true }) });
    const save = () => {
      const doos = bundel.bundelDoos();
      assert.equal(doos?.open, true, 'werk en idemantwoord zitten in dezelfde bundel');
      doos.nodig = true;
    };
    const idem = maakIdem({ d: () => db.data, save, naam: 'bankIdem', bijeen: bundel.bijeen, duurzaam: true });
    const werk = async () => {
      werkKeren++;
      db.data.saldo -= 100;
      db.data.boekingen.push({ id: 'betaling-1', centen: 100 });
      save();
      return { ok: true, boeking: 'betaling-1', centen: 100 };
    };
    const eerste = idem('betaling-1', 'van|naar|100', werk);
    await inCommit.wacht;
    assert.equal(db.data.saldo, 900, 'de mutatie is uitgevoerd maar nog niet bevestigd');
    assert.deepEqual(opgeslagen, begin, 'de duurzame toestand bevat de betaling nog niet');
    const conflict = await idem('betaling-1', 'van|andere-ontvanger|100', async () => {
      assert.fail('een andere ontvanger met dezelfde sleutel mag geen werk uitvoeren');
    });
    assert.equal(conflict.status, 409, 'een andere opdracht blijft tijdens de commit een conflict');
    assert.notEqual(conflict.ok, true);
    assert.equal(werkKeren, 1);
    const tweede = idem('betaling-1', 'van|naar|100', werk).then(r => { tweedeAntwoord = r; return r; });
    // Eén event-loopomloop laat een al opgeloste belofte aankomen; de
    // commitbarrière blijft dicht. Dit is geen gok over opslagtijd.
    await new Promise(resolve => setImmediate(resolve));
    const voortijdig = tweedeAntwoord;
    bevestig.geef();
    const [a, b] = await Promise.all([eerste, tweede]);
    t.diagnostic(JSON.stringify({ terugrollen, conflict: conflict.status, voortijdig: voortijdig || null,
      eerste: a, tweede: b, werkKeren, opgeslagen }));
    assert.equal(werkKeren, 1, 'de retry voert het werk niet opnieuw uit');
    if (terugrollen) {
      assert.deepEqual(opgeslagen, begin, 'de mislukte commit heeft niets duurzaam geboekt');
      assert.equal(a.status, 503);
      assert.equal(b.status, 503, 'ook de retry moet de mislukte commit melden, geen fictieve betaling');
      assert.notEqual(b.ok, true);
      // De mislukte vlucht en haar onbevestigde antwoord mogen een gezonde
      // retry niet tegenhouden of als oud succes terugkomen.
      weigerCommit = false;
      const herstel = await idem('betaling-1', 'van|naar|100', werk);
      assert.equal(herstel.ok, true);
      assert.notEqual(herstel.herhaald, true, 'na rollback is opnieuw uitgevoerd, niet afgespeeld');
      assert.equal(werkKeren, 2, 'één mislukte poging en één werkelijk gecommitteerde poging');
      assert.equal(opgeslagen.saldo, 900);
      assert.equal(opgeslagen.boekingen.length, 1);
      const nogmaals = await idem('betaling-1', 'van|naar|100', werk);
      assert.equal(nogmaals.herhaald, true);
      assert.equal(werkKeren, 2, 'na bevestiging speelt een volgende retry uitsluitend het antwoord af');
      assert.equal(opgeslagen.boekingen.length, 1);
      t.diagnostic(JSON.stringify({ herstel, nogmaals, werkKeren, opgeslagen }));
    } else {
      assert.equal(a.ok, true); assert.equal(b.ok, true);
      assert.equal(opgeslagen.saldo, 900);
      assert.equal(opgeslagen.boekingen.length, 1);
    }
    assert.equal(voortijdig, undefined, 'geen succesantwoord vóór de opslagbevestiging');
  });
