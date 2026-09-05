'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const maakToegang = require('../server/kern/vastgoed-keyless-toegang');

function antwoord() {
  const koppen = {};
  return {
    statusCode:200, body:null, koppen,
    set(naam, waarde) { koppen[String(naam).toLowerCase()] = String(waarde); return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

test('productie maakt geen fysieke deurcode en de consumer faalt gesloten', () => {
  const toegang = maakToegang({ env:{ NODE_ENV:'production' } });
  let generatorAangeroepen = false;
  assert.equal(toegang.maak('2099-01-01T12:00', () => {
    generatorAangeroepen = true;
    return 'GEHEIM';
  }), null);
  assert.equal(generatorAangeroepen, false);
  const res = antwoord();
  assert.equal(toegang.weigerAlsProductie(res), true);
  assert.equal(res.statusCode, maakToegang.STATUS);
  assert.deepEqual(res.body, maakToegang.ANTWOORD);
  assert.equal(res.koppen['cache-control'], 'no-store');
});

test('development behoudt het bestaande tijdvenster voor regressieproeven', () => {
  const toegang = maakToegang({ env:{ NODE_ENV:'development' } });
  const venster = toegang.maak('2099-01-01T12:00:00.000Z', () => 'ABC234');
  assert.deepEqual(venster, {
    code:'ABC234', van:'2099-01-01T11:30:00.000Z',
    tot:'2099-01-01T14:00:00.000Z', gebruikt:[]
  });
  const res = antwoord();
  assert.equal(toegang.weigerAlsProductie(res), false);
  assert.equal(res.statusCode, 200);
});

test('een productiebevestiging blijft werken maar slaat geen keyless geheim op', () => {
  const routes = {};
  const app = { post(pad, ...handlers) { routes[pad] = handlers.at(-1); } };
  const bezichtiging = { ref:'BEZ-1', supplierCode:'MAKELAAR', key:'lid',
    codename:'Lid', status:'aangevraagd' };
  const supplier = { code:'MAKELAAR', type:'vastgoed', name:'Makelaar',
    panden:[{ id:'P-1', titel:'Woning', keyless:true }], staff:[] };
  bezichtiging.pandId = 'P-1';
  let opgeslagen = 0;
  require('../server/routes/supplier/vastgoed/deals')({
    app, supplierAuth:(req, res, next) => next(), db:{ data:{ bezichtigingen:[bezichtiging],
      biedingen:[], vastgoedAanbod:[] } }, crypto:require('node:crypto'), express:{},
    facturatie:null, logActivity() {}, keyVanCodenaam() {}, managerOnly:() => true,
    media:{}, notify() {}, salonNaarVolgers() {}, save() { opgeslagen += 1; }, schoon:v => String(v || ''),
    sseToCustomer() {}, sseToSupplier() {}, horeca:{},
    isVastgoed:() => true, pandVan:(s, id) => s.panden.find(p => p.id === id),
    keylessCode:() => { throw new Error('generator mag niet worden aangeroepen'); },
    keylessToegang:maakToegang({ env:{ NODE_ENV:'production' } })
  });
  const res = antwoord();
  routes['/api/supplier/bezichtiging/beslis']({ supplier, actor:'manager',
    body:{ ref:'BEZ-1', actie:'bevestigen', moment:'2099-01-01T12:00' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(bezichtiging.status, 'bevestigd');
  assert.equal(bezichtiging.keyless, undefined);
  assert.equal(bezichtiging.keylessNietVrijgegeven, true);
  assert.equal(opgeslagen, 1);
});

test('de ledenroute weigert vóór lookup, mutatie en opslag', () => {
  const routes = {};
  const app = { post(pad, ...handlers) { routes[pad] = handlers.at(-1); } };
  let opslag = 0;
  require('../server/routes/member/handel/vastgoed')({ kern:{ app,
    auth:(req, res, next) => next(), crypto:require('node:crypto'),
    db:{ get data() { throw new Error('productiepoort kwam te laat'); } },
    findSupplier() {}, liveCodename() {}, notifySupplier() {},
    save() { opslag += 1; }, schoon:v => String(v || ''), sseToSupplier() {},
    salonZichtbaar:() => true,
    keylessToegang:maakToegang({ env:{ NODE_ENV:'production' } }) }, openLijn() {} });
  const res = antwoord();
  routes['/api/vastgoed/keyless']({ body:{ ref:'BEZ-1' }, session:{ key:'lid' } }, res);
  assert.equal(res.statusCode, maakToegang.STATUS);
  assert.deepEqual(res.body, maakToegang.ANTWOORD);
  assert.equal(opslag, 0);
});
