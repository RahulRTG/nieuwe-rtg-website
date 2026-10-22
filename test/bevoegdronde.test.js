/* DE BEVOEGDRONDE -- bewijs 6 (bevoegd) per onderdeel uit MAPPEN.

   scripts/bevoegdronde.js stelt de ledenrijen samen uit IDOR.json en
   ROLPROEF.json, en loopt een kruisproef over de gezinsschermen (waarom die
   splitsing: BETROUWBAARHEID.md par. 4f). scripts/lib/bewijsbron.js neemt de
   uitslag per rij over. Dit bestand bewaakt het oordeel en het register,
   zonder browser.

     1. Een ledenscherm is alleen BEWEZEN als ELKE route gemeten is; een route
        die in IDOR.json niet gemeten is, houdt de rij op NIET_GETEST, met naam.
     2. Een doorbraak in IDOR.json of een open deur in ROLPROEF.json is een
        defect; een vervallen register maakt alles NIET_GETEST.
     3. Een gezinspaar bewijst alleen iets als A binnenkwam; B met A's code die
        binnenkomt is een lek.
     4. De ronde levert bevoegd en niets anders.
     5. Het echte register spreekt zichzelf niet tegen. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const R = require('../scripts/bevoegdronde');
const B = require('../scripts/lib/bewijsbron');
const { BRONSOORTEN, ALGEMEEN } = require('../scripts/lib/appcontract');

const SR = { perScherm: [{ bestand: 'public/apps/a.html', exact: ['/api/a/lijst', '/api/a/zet'], voorvoegsels: [] }] };
const lees = (f) => (f === 'public/apps/a.html' ? '<html></html>' : null);
const reg = (idor, rol, vervallen = []) => ({ idor: new Map(Object.entries(idor)), rol: new Map(Object.entries(rol)), vervallen,
  rolMeting: { zijeffecten: 0, blindeRondes: 0 } });
const rij = { functie: 'link:a', ingang: '/apps/a.html' };
const oordeel = (r) => R.ledenOordeel(rij, r, { schermroutes: SR, lees });
const rolbewijs = (methode = 'POST', pad = '/api/a/zet') => ({
  bewijsVersie: 2, methode, pad, rol: 'member', verwacht: ['supplier', 'office'],
  geprobeerd: ['supplier', 'office'], acl: 'dicht', privacy: 'schoon',
  antwoorden: ['supplier', 'office'].map(rol => ({ rol, methode, status: 403,
    eigenVoor: 200, eigenNa: 200, lek: null }))
});
const idormeting = (methode = 'GET', staat = 'afgebakend') => ({
  methode, staat, status: 200, statusA: 200, gang: 'afbakening', merken: 1,
  voorbeeld: ['een-blijvend-merkteken-van-A'], velden: []
});

test('idorbewijs: een groene samenvatting zonder eigen controles is geen scheiding', () => {
  const check = raw => R.padOordeel('/api/idor', reg({ '/api/idor': [raw] }, {}));
  for (const raw of [
    { methode: 'GET', staat: 'gescheiden', status: 403 },
    { methode: 'GET', staat: 'gescheiden', status: 403, statusA: 200 },
    { methode: 'GET', staat: 'nagekeken', status: 200, reden: 'met de hand nagekeken en GEEN lek' },
    { methode: 'GET', staat: 'publiek', status: 200, reden: 'ook met een VERZONNEN id een 200' },
    { methode: 'GET', staat: 'afgebakend' }
  ]) assert.equal(check(raw).stand, 'open', raw.staat);
  assert.equal(check(idormeting()).stand, 'gemeten', 'bestaand smal antwoordbewijs blijft herkenbaar');
  for (const status of [undefined, 0, '200', 302, 400, 401, 403, 404, 500, 503]) {
    assert.equal(check({ ...idormeting(), status }).stand, 'open', 'B: ' + status);
    assert.equal(check({ ...idormeting(), statusA: status }).stand, 'open', 'A: ' + status);
  }
  for (const wijzig of [{ merken: 0 }, { voorbeeld: [] }, { gang: undefined }, { methode: undefined }])
    assert.equal(check({ ...idormeting(), ...wijzig }).stand, 'open');
});

test('idorbewijs: registerlezer bewaart lekken, ruwe methode en overlappende gangen', () => {
  const raw = { ...idormeting('GET'), lek: true };
  const laad = (eerste, tweede = {}) => R.laadRegisters({
    lees: f => JSON.stringify(f === 'IDOR.json'
      ? { stempel: {}, zaakPerRoute: eerste, perRoute: tweede }
      : { stempel: {}, gemeten: { zijeffecten: 0, blindeRondes: 0 }, perRoute: [] }),
    vers: () => ({ vers: true })
  });
  for (const staat of ['gescheiden', 'afgebakend', 'nagekeken', 'publiek']) {
    const r = laad({ 'GET /api/idor': { ...raw, staat } });
    assert.equal(R.padOordeel('/api/idor', r).stand, 'gebroken', staat + ' wist lek:true niet uit');
    assert.equal(r.idor.get('/api/idor')[0].lek, true);
  }
  assert.equal(R.padOordeel('/api/idor', laad({ 'GET /api/idor': raw }, { 'GET /api/idor': idormeting() })).stand, 'gebroken');
  assert.equal(R.padOordeel('/api/idor', laad({ 'GET /api/idor': idormeting('POST') })).stand, 'open', 'de sleutel mag een verkeerde werkelijk gebruikte methode niet overschrijven');
  const zonderMethode = laad({ 'GET /api/idor': { ...idormeting(), methode: undefined } });
  assert.equal(zonderMethode.idor.get('/api/idor')[0].methode, 'GET',
    'de routesleutel vult een ontbrekende historische methode aan');
  assert.equal(R.padOordeel('/api/idor', zonderMethode).stand, 'gemeten',
    'een ontbrekend dubbel opgeslagen methodeveld maakt geldig routesleutelbewijs niet open');
});

test('rolbewijs: ruwe tegenproeven beslissen, niet een groene samenvatting', () => {
  const check = row => oordeel(reg({
    '/api/a/lijst': [idormeting('GET')],
    '/api/a/zet': [idormeting('POST')]
  }, { '/api/a/zet': [row] }));
  assert.equal(check(rolbewijs()).status, 'BEWEZEN');
  for (const status of [0, 302, 400, 404, 429, 500, 503]) {
    const r = rolbewijs(); r.antwoorden[1].status = status;
    assert.equal(check(r).status, 'NIET_GETEST', 'status ' + status);
  }
  for (const verander of [
    r => { r.antwoorden.pop(); },
    r => { r.antwoorden[0].eigenNa = 401; },
    r => { delete r.bewijsVersie; }
  ]) {
    const r = rolbewijs(); verander(r);
    assert.equal(check(r).status, 'NIET_GETEST');
  }
  const open = rolbewijs(); open.antwoorden[0].status = 200;
  assert.equal(check(open).status, 'GEBLOKKEERD_DOOR_DEFECT');
});

test('rolbewijs: registerlezer bewaart de ruwe invoer en weigert een mislukte hele meting', () => {
  const laad = (gemeten = { zijeffecten: 0, blindeRondes: 0 }) => R.laadRegisters({
    lees: f => JSON.stringify(f === 'IDOR.json'
      ? { stempel: {}, perRoute: { 'POST /api/a/zet': idormeting('POST') } }
      : { stempel: {}, gemeten, perRoute: [rolbewijs()] }),
    vers: () => ({ vers: true })
  });
  assert.deepEqual(laad().rol.get('/api/a/zet')[0].antwoorden, rolbewijs().antwoorden);
  assert.equal(R.padOordeel('/api/a/zet', laad()).stand, 'gemeten');
  assert.equal(R.padOordeel('/api/a/zet', laad({ zijeffecten: 1, blindeRondes: 0 })).stand, 'gebroken');
  for (const gemeten of [{ zijeffecten: 0, blindeRondes: 1 }, {}, { zijeffecten: -1, blindeRondes: 0 }])
    assert.equal(R.padOordeel('/api/a/zet', laad(gemeten)).stand, 'open');
});

test('rolbewijs: een onbesliste bron blijft via BEVOEGD onbeslist in APPWERKT', () => {
  const raw = rolbewijs(); raw.antwoorden[0].status = 500;
  const uit = oordeel(reg({
    '/api/a/lijst': [idormeting('GET')],
    '/api/a/zet': [idormeting('POST')]
  }, { '/api/a/zet': [raw] }));
  const app = { ...rij, bewijzen: {} };
  B.stelSamen(app, { contract: {}, algemeen: { bevoegd: ALGEMEEN.bevoegd },
    lees: () => JSON.stringify({ stempel: {}, regels: [{ functie: rij.functie, ...uit }] }),
    versheid: () => ({ vers: true }) });
  assert.equal(app.bewijzen.bevoegd.status, 'NIET_GETEST');
});

test('1. een ledenscherm is alleen BEWEZEN als elke route gemeten is', () => {
  const beide = reg({ '/api/a/lijst': [idormeting('GET')], '/api/a/zet': [idormeting('POST')] },
    { '/api/a/zet': [rolbewijs()] });
  const ok = oordeel(beide);
  assert.equal(ok.status, 'BEWEZEN');
  assert.match(ok.reden, /publiek/, 'de grens hoort in elke uitslag te staan');

  const half = reg({ '/api/a/lijst': [idormeting('GET')], '/api/a/zet': [{ methode: 'POST', staat: 'onbereikbaar' }] }, {});
  const h = oordeel(half);
  assert.equal(h.status, 'NIET_GETEST');
  assert.match(h.reden, /\/api\/a\/zet/, 'de open route hoort bij naam genoemd te worden');

  const alleenRol = reg({ '/api/a/lijst': [idormeting('GET')] }, { '/api/a/zet': [rolbewijs()] });
  assert.equal(oordeel(alleenRol).status, 'NIET_GETEST', 'ROLPROEF alleen zegt niets over een ANDER LID');

  const SRv = { perScherm: [{ bestand: 'public/apps/a.html', exact: [], voorvoegsels: ['/api/a/ding/'] }] };
  assert.equal(R.ledenOordeel(rij, reg({}, {}), { schermroutes: SRv, lees }).status, 'NIET_GETEST',
    'een voorvoegsel zonder bekende routes eronder is open, en niet gemeten');
  assert.equal(R.ledenOordeel(rij, reg({ '/api/a/ding/x': [idormeting('GET')] }, {}), { schermroutes: SRv, lees }).status, 'BEWEZEN');
  assert.equal(R.ledenOordeel({ functie: 'x', ingang: 'stand:x' }, beide, { schermroutes: SR, lees }).status, 'NIET_GETEST');

  /* De afbakening (gang 4 van de IDOR-proef) telt als gemeten; haar
     onbereikbaar (A zag niets van zichzelf) blijft open. */
  assert.equal(oordeel(reg({ '/api/a/lijst': [idormeting('GET')], '/api/a/zet': [idormeting('POST')] }, { '/api/a/zet': [rolbewijs()] })).status, 'BEWEZEN');
  assert.equal(oordeel(reg({ '/api/a/lijst': [idormeting('GET')], '/api/a/zet': [{ methode: 'POST', staat: 'onbereikbaar' }] }, {})).status, 'NIET_GETEST');
});

test('1a. een interne tab gebruikt alleen de bronbestanden uit zijn bestaande appcontract', () => {
  const schermroutes = { perScherm: [
    { bestand: 'public/apps/app-main/tab-a.js', exact: ['/api/a/lijst'], voorvoegsels: [] },
    { bestand: 'public/apps/app-main/tab-b.js', exact: ['/api/b/geheim'], voorvoegsels: [] }
  ] };
  const tab = { functie: 'tab:a', ingang: '(tab in de app, geen eigen adres)' };
  const contract = { 'tab:a': {
    ingang: '/apps/app.html', via: '#tab=a', bestanden: ['public/apps/app-main/tab-a.js']
  } };
  const uit = R.ledenOordeel(tab, reg({ '/api/a/lijst': [idormeting('GET')] }, {}),
    { schermroutes, lees: () => null, contract });
  assert.equal(uit.status, 'BEWEZEN');
  assert.equal(uit.routes, 1, 'een buurstand uit dezelfde schil telt niet mee');

  const zonderContract = R.ledenOordeel(tab, reg({ '/api/a/lijst': [idormeting('GET')] }, {}),
    { schermroutes, lees: () => null, contract: {} });
  assert.equal(zonderContract.status, 'NIET_GETEST', 'geen verzonnen ingang zonder expliciet contract');
});

test('1b. de zaak-gang van IDOR.json telt mee, en een doorbraak daar is een defect', () => {
  const lees = (perRoute, zaakPerRoute) => (f) => (f === 'IDOR.json' ? JSON.stringify({ stempel: {}, perRoute, zaakPerRoute })
    : f === 'ROLPROEF.json' ? JSON.stringify({ stempel: {}, perRoute: [] }) : null);
  const vers = () => ({ vers: true });
  const r1 = R.laadRegisters({ lees: lees({}, { 'POST /api/supplier/x': idormeting('POST') }), vers });
  assert.deepEqual(r1.idor.get('/api/supplier/x'), [{ ...idormeting('POST'), routeMethode: 'POST', routePad: '/api/supplier/x' }]);
  const r2 = R.laadRegisters({ lees: lees({}, { 'POST /api/supplier/x': { staat: 'doorbraak' } }), vers });
  assert.equal(R.padOordeel('/api/supplier/x', r2).stand, 'gebroken');
});

test('2. een breuk is een defect, en vervallen bewijs is geen bewijs', () => {
  assert.equal(oordeel(reg({ '/api/a/lijst': [{ methode: 'GET', staat: 'doorbraak' }], '/api/a/zet': [idormeting('POST')] }, {})).status, 'GEBLOKKEERD_DOOR_DEFECT');
  assert.equal(oordeel(reg({ '/api/a/lijst': [idormeting('GET')], '/api/a/zet': [idormeting('POST')] },
    { '/api/a/zet': [{ methode: 'POST', acl: 'OPEN', privacy: 'schoon' }] })).status, 'GEBLOKKEERD_DOOR_DEFECT');
  const v = oordeel(reg({ '/api/a/lijst': [idormeting('GET')], '/api/a/zet': [idormeting('POST')] }, {}, ['IDOR.json: oud']));
  assert.equal(v.status, 'NIET_GETEST');
  assert.match(v.reden, /vervallen/);
});

test('3. een gezinspaar bewijst alleen iets als beide eigenaren binnenkwamen', () => {
  assert.equal(R.paarOordeel({ a: 200, bEigen: 200, b: 403, anoniem: 401 }), 'gescheiden');
  assert.equal(R.paarOordeel({ a: 403, b: 403, anoniem: 403 }), 'eigenaarWeg');
  assert.equal(R.paarOordeel({ a: 200, b: 200, anoniem: 401 }), 'lek');
  assert.equal(R.paarOordeel({ a: 200, b: 403, anoniem: 200 }), 'openbaar');
  assert.equal(R.gezinOordeel([]).status, 'NIET_GETEST');
  assert.equal(R.gezinOordeel([{ uitslag: 'eigenaarWeg' }]).status, 'NIET_GETEST', 'zonder A binnen is er niets gekruist');
  assert.equal(R.gezinOordeel([{ uitslag: 'gescheiden' }, { uitslag: 'lek', verzoek: 'POST /api/rtf/x', b: 200 }]).status, 'GEBLOKKEERD_DOOR_DEFECT');
  assert.equal(R.gezinOordeel([{ uitslag: 'gescheiden' }, { uitslag: 'openbaar', verzoek: 'GET /api/rtf/x', anoniem: 200 }]).status, 'GEBLOKKEERD_DOOR_DEFECT');
});

test('3a. uitval en onbesliste antwoorden bewijzen geen gezinsautorisatie', () => {
  for (const status of [0, undefined, 302, 400, 404, 409, 429, 500, 503]) {
    assert.equal(R.paarOordeel({ a: 200, bEigen: 200, b: status, anoniem: 401 }), 'onbeslist', 'B: ' + status);
    assert.equal(R.paarOordeel({ a: 200, bEigen: 200, b: 403, anoniem: status }), 'onbeslist', 'anoniem: ' + status);
  }
  for (const b of [401, 403]) for (const anoniem of [401, 403]) {
    assert.equal(R.paarOordeel({ a: 200, bEigen: 200, b, anoniem }), 'gescheiden');
  }
  for (const uitslag of ['onbeslist', 'eigenaarWeg', undefined, 'onbekend']) {
    assert.equal(R.gezinOordeel([{ uitslag: 'gescheiden' }, { uitslag }]).status, 'NIET_GETEST');
  }
  assert.equal(R.gezinOordeel([{ uitslag: 'gescheiden' }, { uitslag: 'gescheiden' }]).status, 'BEWEZEN');
  assert.equal(R.gezinOordeel([{ uitslag: 'onbeslist' }, { uitslag: 'lek', b: 200 }]).status, 'GEBLOKKEERD_DOOR_DEFECT');
});

test('3b. een ongeldige tweede sessie kan geen isolatie bewijzen', () => {
  for (const bEigen of [undefined, 0, 302, 400, 401, 403, 404, 500, 503]) {
    assert.equal(R.paarOordeel({ a: 200, bEigen, b: 403, anoniem: 401 }), 'onbeslist');
  }
  assert.equal(R.paarOordeel({ a: 200, bEigen: 204, b: 403, anoniem: 401 }), 'gescheiden');
  assert.equal(R.paarOordeel({ a: 200, bEigen: 403, b: 200, anoniem: 401 }), 'lek',
    'een open vreemde deur blijft een bevinding, ook als de eigen controle faalt');
});

test('4. de bevoegdronde levert bevoegd en niets anders', () => {
  assert.deepEqual(BRONSOORTEN.bevoegdronde, ['bevoegd']);
  assert.equal(ALGEMEEN.bevoegd.soort, 'bevoegdronde');
  assert.equal(ALGEMEEN.bevoegd.register, 'BEVOEGD.json');
  assert.throws(() => B.bewijsVoor('link:a', 'herstelbaar', '/apps/a.html',
    { contract: {}, algemeen: { herstelbaar: { soort: 'bevoegdronde', register: 'BEVOEGD.json', instrument: 'x' } }, versheid: () => ({ vers: true }) }),
  /mag geen herstelbaar/);
});

test('5. het echte register spreekt zichzelf niet tegen', () => {
  const reg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'BEVOEGD.json'), 'utf8'));
  assert.ok(reg.stempel && reg.stempel.commit, 'BEVOEGD.json draagt geen stempel met commit');
  assert.ok(reg.regels.length >= 100, 'BEVOEGD.json draagt te weinig rijen om over MAPPEN te gaan');
  const tel = {};
  for (const r of reg.regels) {
    tel[r.status] = (tel[r.status] || 0) + 1;
    if (r.status === 'BEWEZEN' && r.persona === 'lid') assert.ok(r.routes > 0, r.functie + ': BEWEZEN zonder een route');
    if (r.status === 'BEWEZEN' && r.persona === 'gezin') {
      assert.ok(r.kruisparen?.length > 0, r.functie + ': BEWEZEN zonder kruisparen');
      for (const p of r.kruisparen) {
        assert.equal(R.paarOordeel(p), 'gescheiden', r.functie + ': ruwe antwoorden bewijzen geen scheiding bij ' + p.verzoek);
        assert.equal(p.uitslag, 'gescheiden', r.functie + ': onbeslist paar mag niet groen meeliften');
      }
    }
    if (r.status === 'BEWEZEN') assert.ok(['lid', 'gezin'].includes(r.persona), r.functie + ': BEWEZEN voor een persona zonder proef');
  }
  assert.deepEqual(reg.telling, tel, 'de telling overstemt de rijen');
});

// Onafhankelijk bewijs per methode: de adresstring alleen is onvoldoende.
test('6. schrijfbewijs zonder overeenkomende rolproef blijft open', () => {
  const id = (methode, staat = 'afgebakend') => idormeting(methode, staat);
  const rol = methode => rolbewijs(methode, '/api/voorbeeld');
  const check = (ids, rollen = []) => R.padOordeel('/api/voorbeeld', reg({ '/api/voorbeeld': ids }, { '/api/voorbeeld': rollen }));
  assert.equal(check([id('POST')]).stand, 'open', 'POST mist een rolproef');
  assert.equal(check([id('POST')], [rol('PUT')]).stand, 'open', 'PUT bewijst POST niet');
  assert.equal(check([id('GET'), id('POST')]).stand, 'open', 'GET maskeert geen onbeproefde POST');
  assert.equal(check([id('GET')], [rol('POST')]).stand, 'open', 'ROLPROEF POST mist eigen IDOR');
  assert.equal(check([id('GET'), id('POST')], [rol('POST')]).stand, 'gemeten');
  assert.equal(check([id('POST'), id('PATCH')], [rol('POST')]).stand, 'open', 'alle methodes tellen');
  assert.equal(check([id('POST'), id('PATCH')], [rol('POST'), rol('PATCH')]).stand, 'gemeten');
  assert.equal(check([id('GET'), id('GET', 'onbereikbaar')]).stand, 'open', 'een gemeten rij maskeert geen ongemeten rij');
  for (const methode of [undefined, '', 'BOGUS', 'post']) {
    assert.equal(check([id(methode)], [rol('POST')]).stand, 'open', 'onbekende methode blijft open');
    assert.equal(check([id('GET')], [rol(methode)]).stand, 'open', 'onbekende rolmethode blijft open');
  }
  assert.equal(check([id('GET')]).stand, 'gemeten', 'GET vereist geen schrijfrolproef');
});
