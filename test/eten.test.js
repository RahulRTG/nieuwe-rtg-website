'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const product = require('../server/kern/eten/product');
const ontdek = require('../server/kern/eten/ontdekken');
const beeld = require('../server/kern/eten/orderbeeld');
const capaciteit = require('../server/kern/eten/capaciteit');

const item = { id:'burger', naam:'Burger', centen:1200, opties:[
  { id:'cuisson', naam:'Cuisson', verplicht:true, min:1, max:1, keuzes:[
    { id:'medium', naam:'Medium', prijsCenten:0 }, { id:'well', naam:'Doorbakken', prijsCenten:100 }] },
  { id:'extra', naam:'Extra', min:0, max:2, keuzes:[
    { id:'kaas', naam:'Kaas', prijsCenten:150, allergenen:['melk'] },
    { id:'saus', naam:'Saus', prijsCenten:50 }] }
] };

test('productopties zijn verplicht, begrensd en alleen servergeprijsd', () => {
  assert.equal(product.configuratie(item, []).code, 'optie-verplicht');
  assert.equal(product.configuratie(item, ['medium','well']).code, 'optie-te-veel');
  const goed = product.configuratie(item, ['medium','kaas','nep-met-999-euro']);
  assert.equal(goed.meerprijsCenten, 150);
  assert.deepEqual(goed.allergenen, ['melk']);
  assert.deepEqual(goed.keuzes.map(k => k.id), ['medium','kaas']);
});

test('Concierge maakt zichtbare filters en houdt de keuze bij de gast', () => {
  const f = ontdek.conciergeFilters('Italiaans voor 4, een vegan, maximaal €80, rond 19:00 en zonder noten', ['Italiaans']);
  assert.equal(f.keuken, 'Italiaans');
  assert.equal(f.personen, 4);
  assert.equal(f.budgetCenten, 8000);
  assert.equal(f.tijd, '19:00');
  assert.deepEqual(f.dieet, ['vegan']);
  assert.deepEqual(f.zonderAllergenen, ['noten']);
  assert.equal(f.menselijkeControle, true);
});

test('automatische capaciteit wordt dezelfde actuele belofte voor gast en partner', () => {
  const h = { instel:{ kokken:1 }, etenCapaciteit:{ auto:true, open:true, limietMinuten:35, extraMinuten:0 },
    rekeningen:{ r:{ status:'open', regels:[1,2,3,4].map(i => ({ id:'r'+i, naam:'Warm '+i,
      station:'warm', aantal:1, stand:'besteld' })) } } };
  const c = capaciteit.bereken(h);
  assert.equal(c.stand, 'vol');
  assert.equal(c.extraMinuten, 45);
  assert.equal(c.ingesteldeExtraMinuten, 0);
  assert.equal(c.afhalenPromoten, true);
});

function rekening() {
  return { id:'rek-1', kanaal:'bezorging', geopendAt:'2026-08-22T17:00:00.000Z',
    deelnemers:[{ handle:'gast-maan' }], bezorg:{ adres:'Dam 1', postcode:'1012AA', zone:{ minuten:12 } },
    betalingen:[{ centen:1600 }], kortingen:[{ centen:100 }], fooiCenten:100,
    regels:[{ id:'r1', itemId:'burger', naam:'Burger', aantal:1, centen:1500, stand:'besteld',
      opties:[{ id:'kaas', naam:'Kaas', prijsCenten:150 }], allergenen:['melk'], prepMin:15 }] };
}

test('klant en partner lezen alle fasen uit dezelfde rekening', () => {
  const r = rekening(), zaak = { name:'De Testkeuken', menu:[item] }, h = { instel:{ kokken:1 }, etenCapaciteit:{ extraMinuten:5 } };
  let o = beeld.projecteerRekening({ zaakcode:'test', zaak, rekening:r, horecaDoos:h, nuMs:0 });
  assert.equal(o.fase, 'ontvangen');
  assert.equal(o.prijs.totaal, 1500);
  assert.equal(o.eta.minuten, 32);
  assert.equal(o.producten[0].opties[0].naam, 'Kaas');
  r.geaccepteerdAt = '2026-08-22T17:01:00.000Z';
  assert.equal(beeld.projecteerRekening({ zaakcode:'test', zaak, rekening:r, horecaDoos:h }).fase, 'bevestigd');
  r.regels[0].stand = 'gestart'; r.regels[0].startAt = '2026-08-22T17:02:00.000Z';
  assert.equal(beeld.projecteerRekening({ zaakcode:'test', zaak, rekening:r, horecaDoos:h }).fase, 'keuken');
  r.regels[0].stand = 'klaar'; r.regels[0].klaarAt = '2026-08-22T17:12:00.000Z';
  assert.equal(beeld.projecteerRekening({ zaakcode:'test', zaak, rekening:r, horecaDoos:h }).fase, 'klaar');
  r.fulfillment = { status:'onderweg', onderwegAt:'2026-08-22T17:15:00.000Z', etaMinuten:8 };
  o = beeld.projecteerRekening({ zaakcode:'test', zaak, rekening:r, horecaDoos:h });
  assert.equal(o.fase, 'onderweg'); assert.equal(o.eta.minuten, 8);
  r.fulfillment.status = 'geleverd'; r.fulfillment.geleverdAt = '2026-08-22T17:23:00.000Z';
  o = beeld.projecteerRekening({ zaakcode:'test', zaak, rekening:r, horecaDoos:h });
  assert.equal(o.fase, 'geleverd');
  assert.equal(o.acties.beoordelen, true);
  assert.equal(o.tijdlijn.length, 7);
});
