/* TWEE KEER TEGELIJK BETALEN IS EEN KEER BETALEN (BEWIJSLUS.md par. 6).

   Gevonden door de zoekende tegenstander (npm run tegenvoorbeeld, zaad 1, reeks
   7) en door hem verkleind tot deze twee stappen: maak een betaalverzoek, en
   betaal het twee keer TEGELIJK met twee verschillende sleutels.
   verzoekBetaal() controleerde de stand `open` voordat het op zorgSaldo() en de
   boeking wachtte, en zette hem pas daarna op `betaald` -- dus kwamen beide
   betalingen erdoor. Een verzoek van EUR 25 kostte de betaler EUR 50. De
   sluitcontrole bleef daarbij groen, want het geld was keurig dubbel geboekt, en
   daarom zag geen enkele bestaande toets het.

   Twee VERSCHILLENDE sleutels, want met dezelfde sleutel wacht het tweede
   verzoek al op het eerste (server/lib/idem.js, `inVlucht`). Dit is de dubbele
   klik met een sleutel per klik, of twee toestellen.

   WAAROM IN-PROCESS EN NIET OVER HTTP. Over HTTP, in de toetsopstelling (SQLite,
   demo-provider), is dit niet na te spelen: het werk wacht daar nergens op echte
   I/O, dus het eerste verzoek loopt helemaal af voordat de server het tweede
   heeft gelezen. Dat is gemeten, met een toets die op de oude code groen bleef --
   en een toets die niet kan zakken is weggehaald in plaats van bewaard. Op het
   productiepad zit die I/O er wel (de Rust-motor achter boekAsync, een echte
   provider achter het automatisch bijladen), en daar opent het venster zich;
   server/lib/idem.js zegt precies dat over zijn eigen grendel. Graad: `vermoed`
   voor productie, `gemeten` in-process.

   IMMUNITEIT, klasse B: de wet bestond al ("Dit verzoek is al afgehandeld")
   maar geen proef keek naar twee betalingen in hetzelfde venster. Deze toets
   zakte op de code van voor de reparatie (gezien, 24 september 2026).

   Draai los: node --test test/verzoekbetaal-race.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

/* De opstelling van de Magnaat-geldpomp (server/kern/spellen/magnaat/rtg-keten.js):
   een verse, echte kern/pay. De betaalnaad is hier een lege stub, want er wordt
   niets via een bank opgeladen -- het saldo komt uit oplaadAfronden(), dezelfde
   boekingsregel die een bevestigde oplading gebruikt. */
const keten = require('../server/kern/spellen/magnaat/rtg-keten')({ betaal: {} });

async function opzet() {
  const { db, pay } = keten.opstelling();
  const [vrager, betaler] = keten.SPELERS;
  const op = await pay.oplaadAfronden({ codenaam: betaler, centen: 100000, ref: 'proef' });
  assert.equal(op.ok, true, 'de betaler krijgt saldo: ' + JSON.stringify(op));
  const mk = await pay.verzoekMaak({ van: vrager, aan: [betaler], totaalCenten: 2500, idem: 'v' });
  assert.equal(mk.ok, true, JSON.stringify(mk));
  return { db, pay, vrager, betaler, id: mk.verzoeken[0].id };
}

test('twee gelijktijdige betalingen van hetzelfde verzoek boeken een keer', async () => {
  const { db, pay, vrager, betaler, id } = await opzet();
  const [a, b] = await Promise.all([
    pay.verzoekBetaal({ codenaam: betaler, verzoekId: id, idem: 'klik-1' }),
    pay.verzoekBetaal({ codenaam: betaler, verzoekId: id, idem: 'klik-2' })
  ]);
  const geslaagd = [a, b].filter(r => r && r.ok);
  assert.equal(geslaagd.length, 1, 'precies een van de twee hoort door te komen: ' + JSON.stringify([a, b]));
  const ander = a && a.ok ? b : a;
  assert.equal(ander.status, 409, 'de andere wordt geweigerd, met een reden: ' + JSON.stringify(ander));
  assert.ok(ander.error, 'een weigering zegt waarom');

  assert.equal(pay.saldoVan(pay.rekLid(vrager)), 2500, 'de vrager ontvangt het bedrag een keer');
  assert.equal(pay.saldoVan(pay.rekLid(betaler)), 100000 - 2500, 'de betaler betaalt het een keer');
  assert.equal(db.data.payBoekingen.filter(r => r.soort === 'klompje' && r.ref === id).length, 1);
  assert.equal(pay.sluitcontrole().klopt, true);
});

test('een mislukte betaling laat het verzoek open voor de volgende poging', async () => {
  /* De reparatie zet een slot zolang er betaald wordt. Faalt de betaling, dan
     hoort dat slot weer los te zijn -- anders blijft het verzoek voor altijd
     "wordt al betaald", en dat is een nieuwe fout in plaats van een reparatie.
     MUTATIE: het vrijgeven van het slot (de finally in verzoekBetaal) weghalen
     -> deze toets zakt. */
  const { pay } = keten.opstelling();
  const [vrager, betaler] = keten.SPELERS;
  const mk = await pay.verzoekMaak({ van: vrager, aan: [betaler], totaalCenten: 2500, idem: 'w' });
  const id = mk.verzoeken[0].id;

  // zonder saldo en zonder betaalnaad kan zorgSaldo niet bijladen: de betaling faalt
  const eerste = await pay.verzoekBetaal({ codenaam: betaler, verzoekId: id, idem: 'k1' });
  assert.ok(!eerste.ok, 'zonder saldo lukt het niet: ' + JSON.stringify(eerste));

  await pay.oplaadAfronden({ codenaam: betaler, centen: 100000, ref: 'later' });
  const tweede = await pay.verzoekBetaal({ codenaam: betaler, verzoekId: id, idem: 'k2' });
  assert.equal(tweede.ok, true, 'na het bijladen gaat een nieuwe poging gewoon door: ' + JSON.stringify(tweede));
});
