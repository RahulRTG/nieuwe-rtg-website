/* ============================================================================
   DE WINKEL VAN DE RTFOUNDATION -- en waarom een aankoop geen gift is.

   Dit is de scherpste grens van deze laag, en hij stond al in dit huis:
   kern/rtfos/herkomst.js weigert een donatie waar iets tegenover staat, en de
   giftlaag geeft dan een factuur in plaats van een giftbewijs. In een winkel
   staat er per definitie iets tegenover -- een tas, een boek, een kaartje. Wie
   die twee door elkaar laat lopen, geeft mensen een giftbewijs voor iets dat de
   Belastingdienst geen gift noemt.

   Vier grendels, en alle vier zijn ze tegen een tijdelijk kapotgemaakte kern
   gezien zakken (LAT.md regel 2):

   1. Geen voorraad, geen verkoop.
   2. De prijs komt nooit uit de browser -- en een meegestuurd bedrag wordt
      GEMELD, niet stil genegeerd.
   3. Het geld landt in de wallet van de stichting, langs dezelfde weg als een
      gift. Er komt geen tweede betaalweg bij.
   4. Wat er met een bestelling gebeurt, zet een MENS.

   Draai los: node --test test/rtfos-winkel.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

/* De ECHTE opbouw, want de winkel leest de giftstand voor de walletcode: een
   nagemaakte ctx zou hier een pad toetsen dat in het echt niet bestaat. De
   boekingen vangen we op via de pay die we meegeven. */
function bouwMetPay() {
  const db = { data: {} };
  const save = () => {};
  const geboekt = [];
  const pay = { partnerIn: async (o) => { geboekt.push(o); return { ok: true, kosten: 35 }; } };
  const rtfos = require('../server/kern/rtfos')({ db, save, crypto: require('crypto'),
    boardroomWie: () => null, magBoardroom: () => false, pay }).rtfos;
  rtfos.gift.standZet({ ontvanger: { soort: 'wallet', code: 'RTF-WALLET' } }, 'toets');
  const a = rtfos.winkel.artikelZet({ naam: 'Katoenen tas', euro: 12.5, voorraad: 2,
    uitleg: 'Van de stichting', doel: 'Taalcafe' }, 'toets');
  return { rtfos, geboekt, artikel: a.artikel, db };
}

test('de etalage zegt zelf dat dit geen gift is', () => {
  const { rtfos } = bouwMetPay();
  const e = rtfos.winkel.etalage();
  assert.equal(e.artikelen.length, 1);
  assert.equal(e.artikelen[0].euro, 12.5);
  /* DE ZIN HOORT IN DE ETALAGE en niet in de kleine lettertjes onder de knop:
     wie hier binnenloopt denkt misschien dat hij doneert. */
  assert.match(e.uitleg, /geen collectebus/);
  assert.match(e.uitleg, /geen giftbewijs/);
});

test('kopen boekt naar de wallet van de stichting en levert geen giftbewijs op', async () => {
  const { rtfos, geboekt, artikel } = bouwMetPay();
  const r = await rtfos.winkel.koop({ codenaam: 'Poolvos 1BE9', artikelId: artikel.id, aantal: 2, idem: 'w1' });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.bestelling.euro, 25);

  /* GRENDEL 3: dezelfde weg als een gift, en dezelfde wallet. */
  assert.equal(geboekt.length, 1);
  assert.equal(geboekt[0].supplierCode, 'RTF-WALLET');
  assert.equal(geboekt[0].centen, 2500);
  assert.equal(geboekt[0].soort, 'winkel');

  /* DE GRENS. Nergens een giftbewijs, en het staat er met zoveel woorden. */
  assert.equal(JSON.stringify(r).includes('giftbewijs') &&
    r.zegt.some(z => /geen giftbewijs/.test(z)), true);
  assert.ok(r.zegt.some(z => /geen gift/.test(z)), 'de bevestiging noemt de grens niet');
  assert.equal(JSON.stringify(r).toLowerCase().includes('aftrekbaar: true'), false);

  /* EN DE VOORRAAD LOOPT MEE. */
  assert.equal(rtfos.winkel.etalage().artikelen[0].voorraad, 0);
});

test('geen voorraad, geen verkoop -- en de prijs komt niet uit de browser', async () => {
  const { rtfos, geboekt, artikel } = bouwMetPay();
  /* GRENDEL 2: een meegestuurd bedrag wordt gemeld, niet stil genegeerd. Stille
     negatie leert een integrator nooit dat hij iets doet wat niet werkt. */
  const r = await rtfos.winkel.koop({ codenaam: 'Poolvos 1BE9', artikelId: artikel.id, aantal: 1, euro: 1, idem: 'w2' });
  assert.equal(r.ok, true);
  assert.equal(geboekt[0].centen, 1250, 'het bedrag uit de browser is gebruikt');
  assert.match(r.meegestuurd, /genegeerd/);

  /* GRENDEL 1 */
  const teveel = await rtfos.winkel.koop({ codenaam: 'Poolvos 1BE9', artikelId: artikel.id, aantal: 5, idem: 'w3' });
  assert.equal(teveel.status, 409);
  assert.match(teveel.error, /nog 1/);
  await rtfos.winkel.koop({ codenaam: 'Poolvos 1BE9', artikelId: artikel.id, aantal: 1, idem: 'w4' });
  const op = await rtfos.winkel.koop({ codenaam: 'Poolvos 1BE9', artikelId: artikel.id, aantal: 1, idem: 'w5' });
  assert.equal(op.status, 409);
  assert.match(op.error, /uitverkocht/);
});

test('zonder positie in RTG Pay wordt er niets verkocht', async () => {
  const db = { data: {} };
  const geboekt = [];
  const rtfos = require('../server/kern/rtfos')({ db, save: () => {}, crypto: require('crypto'),
    boardroomWie: () => null, magBoardroom: () => false,
    pay: { partnerIn: async (o) => { geboekt.push(o); return { ok: true }; } } }).rtfos;
  const a = rtfos.winkel.artikelZet({ naam: 'Boek', euro: 10, voorraad: 5 }, 'toets').artikel;
  const r = await rtfos.winkel.koop({ codenaam: 'Poolvos 1BE9', artikelId: a.id });
  assert.equal(r.status, 409);
  assert.match(r.error, /geen positie in RTG Pay/);
  assert.equal(geboekt.length, 0, 'er is geboekt terwijl er geen ontvanger was');
});

test('wat er met een bestelling gebeurt, zet een mens', async () => {
  const { rtfos, artikel } = bouwMetPay();
  const r = await rtfos.winkel.koop({ codenaam: 'Poolvos 1BE9', artikelId: artikel.id, idem: 'w6' });
  assert.equal(r.bestelling.stand, 'klaar',
    'een verse bestelling stond al op verstuurd -- dat is de enige stap die telt');
  assert.equal(rtfos.winkel.standZet({ id: r.bestelling.id, stand: 'bezorgd' }, 'kantoor').status, 400,
    'een verzonnen stand werd aangenomen');
  const z = rtfos.winkel.standZet({ id: r.bestelling.id, stand: 'verstuurd' }, 'Nadia');
  assert.equal(z.ok, true);
  assert.equal(rtfos.winkel.mijn('Poolvos 1BE9').bestellingen[0].stand, 'verstuurd');
  /* Van een ander zie je niets. */
  assert.equal(rtfos.winkel.mijn('IemandAnders 9ZZ9').bestellingen.length, 0);
});
