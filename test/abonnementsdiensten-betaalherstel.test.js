/* Echte partner-, dekking-, boeking- en idemmodules; alleen de externe motor
   is een deterministische adapter. Geen claim over live provider/Rust-sockets. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

function wereld(modus = 'motor') {
  const data = {}, ledger = new Map(), saldi = { 'lid:Koper': 10000, 'zaak:ZAAK': 0, 'rtg:betaaldienst': 0 };
  const spiegel = {}, lijst = [], gelezen = [];
  let gemaakt = 0, geladen = 0, toegestaan = true, foutNaBoeken = false, onbereikbaar = false;
  const gelijk = a => JSON.stringify([a.van, a.naar, a.centen, a.soort, a.ref || null]);
  const antwoord = (a, r) => ({ ok: true, herhaald: true, boeking: r.boeking,
    saldoVan: saldi[a.van] || 0, saldoNaar: saldi[a.naar] || 0 });
  const motor = {
    async boekBekend(a) {
      gelezen.push(a.economischeSleutel);
      if (onbereikbaar) throw Error('motor niet bereikbaar');
      const r = ledger.get(a.economischeSleutel);
      if (!r) return { status: 404, onbekend: true };
      return r.afdruk === gelijk(a) ? antwoord(a, r) : { status: 409, error: 'Andere beweging' };
    },
    async boekGuard(a) {
      const r = ledger.get(a.economischeSleutel);
      if (r) return r.afdruk === gelijk(a) ? antwoord(a, r) : { status: 409, error: 'Andere beweging' };
      gemaakt++;
      const boeking = { id: 'PB-' + gemaakt, van: a.van, naar: a.naar, centen: a.centen,
        soort: a.soort, ref: a.ref || null, at: '2026-11-13T10:00:00.000Z' };
      saldi[a.van] = (saldi[a.van] || 0) - a.centen; saldi[a.naar] = (saldi[a.naar] || 0) + a.centen;
      const nieuw = { afdruk: gelijk(a), boeking }; ledger.set(a.economischeSleutel, nieuw);
      return antwoord(a, nieuw);
    }
  };
  const b = require('../server/kern/pay/boeking')({ saldi: () => spiegel, saldoVan: x => spiegel[x] || 0,
    grootboek: () => lijst, payBoekingenVoegToe: r => lijst.push(r), save() {}, id: () => 'JS',
    schoon: x => String(x || ''), nu: () => 1, waardePoort: () => null,
    geldModus: modus, motorklant: motor, schaduw: { spiegel() {} }, MIN_CENTEN: 1, MAX_CENTEN: 1000000 });
  const betaalMetDekking = require('../server/kern/pay/dekking')({ ...b,
    zorgSaldo: async () => { geladen++; return { ok: true, bijgeladen: 1000 }; } });
  const p = require('../server/kern/pay/partner')({ ...b, betaalMetDekking,
    // Geheugenadapter voor de ontvangst; de ingespoten fout modelleert de grens,
    // niet fysieke duurzaamheid. De native proef gebruikt de echte pay-montage.
    metIdem: require('../server/lib/idem')({ d: () => data, save() {}, naam: 'payIdem' }),
    rekLid: x => 'lid:' + x, rekPartner: x => 'zaak:' + x, MIN_CENTEN: 1, MAX_CENTEN: 1000000,
    betaaldienstKosten: () => 50, opdrachten: { registreerTeruggang() {} },
    save: () => { if (foutNaBoeken) { foutNaBoeken = false; throw Error('JS-commit mislukt'); } } });
  const betaal = extra => p.partnerIn({ supplierCode: 'ZAAK', codenaam: 'Koper', centen: 2500,
    soort: 'cadeaukaart', idem: 'koop-1', magNieuweDienst: () => toegestaan, ...extra });
  return { data, ledger, saldi, lijst, gelezen, betaal, beperk: () => { toegestaan = false; },
    crash: () => { foutNaBoeken = true; }, storing: () => { onbereikbaar = true; },
    get gemaakt() { return gemaakt; }, get geladen() { return geladen; } };
}

test('nieuwe weigering boekt en autolaadt niets, ook met een lege idemontvangst', async () => {
  for (const modus of ['motor', 'schaduw']) {
    const w = wereld(modus); w.beperk();
    const r = await w.betaal(); assert.equal(r.status, 402); assert.equal(r.code, 'ABONNEMENT_NIEUWE_DIENST');
    assert.equal(w.gemaakt, 0); assert.equal(w.geladen, 0); assert.equal(w.lijst.length, 0);
    assert.equal(w.data.payIdem['partnerin:Koper:koop-1'], undefined);
  }
});

test('motorbevestiging vóór mislukte JS-commit herstelt na beperking, inclusief bestaande kostenboeking', async () => {
  const w = wereld(); w.crash();
  await assert.rejects(w.betaal(), /JS-commit/);
  assert.equal(w.gemaakt, 2); assert.equal(w.data.payIdem['partnerin:Koper:koop-1'], undefined);
  const voor = { ...w.saldi }, sleutels = [...w.ledger.keys()];
  w.beperk(); const r = await w.betaal();
  assert.equal(r.ok, true); assert.equal(w.gemaakt, 2); assert.equal(w.geladen, 0);
  assert.deepEqual(w.saldi, voor); assert.deepEqual([...w.ledger.keys()], sleutels);
  assert.deepEqual(w.gelezen, [sleutels[0]], 'eerst bestaande hoofdboeking gelezen, niet opnieuw geïnd');
  assert.equal((await w.betaal()).herhaald, true);
});

test('een oude economische sleutel met andere som geeft bij beperking geen nieuwe dienst of inning', async () => {
  const w = wereld(); w.crash(); await assert.rejects(w.betaal(), /JS-commit/); w.beperk();
  const voor = { ...w.saldi };
  assert.equal((await w.betaal({ centen: 2600 })).status, 402);
  assert.deepEqual(w.saldi, voor); assert.equal(w.gemaakt, 2); assert.equal(w.geladen, 0);
});

test('onzeker motorbewijs na een crash geeft geen betaling- of uitgiftebevestiging', async () => {
  const w = wereld(); w.crash(); await assert.rejects(w.betaal(), /JS-commit/); w.beperk(); w.storing();
  await assert.rejects(w.betaal(), /motor niet bereikbaar/);
  assert.equal(w.gemaakt, 2); assert.equal(w.geladen, 0);
  assert.equal(w.data.payIdem['partnerin:Koper:koop-1'], undefined);
});
