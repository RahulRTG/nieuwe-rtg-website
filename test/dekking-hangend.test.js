/* Een hangende automatische bijlading wordt bij een herhaling herkend, niet
   opnieuw gestart en niet als storing gemeld (server/kern/pay/opladen.js).

   Gemeld door FoundationOS bij link:geven en gereproduceerd in de wereld van de
   voltooiproef: een betaling met een LEGE wallet leunt op het automatisch
   bijladen (betaalMetDekking -> zorgSaldo -> laadOp met `idem:autolaad`). Blijft
   de bank hangen, dan hoort het lid "De betaling wacht op bevestiging." -- maar
   dezelfde tik nog eens, of na een crash, gaf een kale 502 "De betaling gaf geen
   uitsluitsel". De betaling was niet onbekend: ze stond al vast en wachtte op de
   klant. Alleen het navragen bij de rail lukte niet.

   Hier met de echte betaalwaarheid, de echte idem-laag en een rail die blijft
   hangen en geen stand kan teruggeven. Een "crash" is: nieuwe instanties over
   dezelfde opgeslagen gegevens, zonder wat er in het geheugen liep. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { maakOpladen } = require('../server/kern/pay/opladen');
const maakBetaalWaarheid = require('../server/kern/betaalwaarheid');
const maakIdem = require('../server/lib/idem');

function wereld(data, rail) {
  const d = () => data;
  if (!data.saldi) data.saldi = {};
  const saldoVan = (r) => data.saldi[r] || 0;
  const betaal = {
    maakBetaling: async (o) => { rail.gemaakt++; if (rail.gooi) throw new Error('rail viel weg'); return { id: 'sim_' + o.referentie, status: rail.stand, aanbieder: 'simulatie', bedrag: o.bedrag, valuta: 'eur' }; },
    haalBetaling: async () => { throw new Error('deze rail kan geen stand teruggeven'); }
  };
  const betaalWaarheid = maakBetaalWaarheid({ d, save: () => {}, crypto, betaal });
  const boekAsync = async (b) => {
    if (!String(b.van).startsWith('extern:') && saldoVan(b.van) < b.centen) return { status: 402, error: 'Onvoldoende saldo.' };
    data.saldi[b.van] = saldoVan(b.van) - b.centen;
    data.saldi[b.naar] = saldoVan(b.naar) + b.centen;
    return { ok: true, boeking: { id: 'B' + Math.random().toString(36).slice(2) } };
  };
  const metIdem = maakIdem({ d, save: () => {}, naam: 'payIdem' });
  const o = maakOpladen({ betaal, metIdem, boekAsync, rekLid: (c) => 'lid:' + c, saldoVan, nu: () => new Date().toISOString(),
    d, save: () => {}, plafondFout: () => null, betaalWaarheid, reserveerSleutel: () => null,
    OPLAAD_MIN: 100, MAX_CENTEN: 500000, AUTOLAAD_STAP: 1000 });
  return o;
}

const gift = (o) => o.betaalMetDekking({ codenaam: 'Codenaam', centen: 700, idem: 'gift-1',
  boeking: { van: 'lid:Codenaam', naar: 'extern:goed-doel', centen: 700, soort: 'gift', oms: 'Gift' } });

test('dezelfde gift na een hangende bijlading: de wachtzin, en geen tweede oplading', async () => {
  const data = {};
  const rail = { stand: 'open', gemaakt: 0 };
  const eerste = await gift(wereld(data, rail));
  assert.equal(eerste.z.status, 402);
  assert.match(eerste.z.error, /wacht op bevestiging/);
  const nogeens = await gift(wereld(data, rail));
  assert.equal(nogeens.z.status, 402, 'geen kale 502: ' + JSON.stringify(nogeens.z));
  assert.match(nogeens.z.error, /wacht op bevestiging/);
  assert.equal(rail.gemaakt, 1, 'er start nooit een tweede oplading');
});

test('dezelfde gift na een crash: de wachtzin, en geen tweede oplading', async () => {
  const data = {};
  const rail = { stand: 'open', gemaakt: 0 };
  await gift(wereld(data, rail));
  const naCrash = await gift(wereld(JSON.parse(JSON.stringify(data)), rail));
  assert.equal(naCrash.z.status, 402, JSON.stringify(naCrash.z));
  assert.match(naCrash.z.error, /wacht op bevestiging/);
  assert.equal(rail.gemaakt, 1);
});

test('een rail die bij de EERSTE poging wegvalt, geeft wel eerlijk geen uitsluitsel', async () => {
  /* Dan weten we werkelijk niet of de kaart belast is: dat blijft de 502 met
     "betaal niet opnieuw". Alleen een betaling die al aantoonbaar wacht, wacht. */
  const rail = { stand: 'open', gemaakt: 0, gooi: true };
  const r = await gift(wereld({}, rail));
  assert.equal(r.z.status, 502);
  assert.match(r.z.error, /geen uitsluitsel/);
});
