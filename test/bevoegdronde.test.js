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
const reg = (idor, rol, vervallen = []) => ({ idor: new Map(Object.entries(idor)), rol: new Map(Object.entries(rol)), vervallen });
const rij = { functie: 'link:a', ingang: '/apps/a.html' };
const oordeel = (r) => R.ledenOordeel(rij, r, { schermroutes: SR, lees });

test('1. een ledenscherm is alleen BEWEZEN als elke route gemeten is', () => {
  const beide = reg({ '/api/a/lijst': [{ staat: 'gescheiden' }], '/api/a/zet': [{ staat: 'nagekeken' }] },
    { '/api/a/zet': [{ acl: 'dicht', privacy: 'schoon' }] });
  const ok = oordeel(beide);
  assert.equal(ok.status, 'BEWEZEN');
  assert.match(ok.reden, /publiek/, 'de grens hoort in elke uitslag te staan');

  const half = reg({ '/api/a/lijst': [{ staat: 'gescheiden' }], '/api/a/zet': [{ staat: 'onbereikbaar' }] }, {});
  const h = oordeel(half);
  assert.equal(h.status, 'NIET_GETEST');
  assert.match(h.reden, /\/api\/a\/zet/, 'de open route hoort bij naam genoemd te worden');

  const alleenRol = reg({ '/api/a/lijst': [{ staat: 'gescheiden' }] }, { '/api/a/zet': [{ acl: 'dicht', privacy: 'schoon' }] });
  assert.equal(oordeel(alleenRol).status, 'NIET_GETEST', 'ROLPROEF alleen zegt niets over een ANDER LID');

  const SRv = { perScherm: [{ bestand: 'public/apps/a.html', exact: [], voorvoegsels: ['/api/a/ding/'] }] };
  assert.equal(R.ledenOordeel(rij, reg({}, {}), { schermroutes: SRv, lees }).status, 'NIET_GETEST',
    'een voorvoegsel zonder bekende routes eronder is open, en niet gemeten');
  assert.equal(R.ledenOordeel(rij, reg({ '/api/a/ding/x': [{ staat: 'gescheiden' }] }, {}), { schermroutes: SRv, lees }).status, 'BEWEZEN');
  assert.equal(R.ledenOordeel({ functie: 'x', ingang: 'stand:x' }, beide, { schermroutes: SR, lees }).status, 'NIET_GETEST');
});

test('2. een breuk is een defect, en vervallen bewijs is geen bewijs', () => {
  assert.equal(oordeel(reg({ '/api/a/lijst': [{ staat: 'doorbraak' }], '/api/a/zet': [{ staat: 'gescheiden' }] }, {})).status, 'GEBLOKKEERD_DOOR_DEFECT');
  assert.equal(oordeel(reg({ '/api/a/lijst': [{ staat: 'gescheiden' }], '/api/a/zet': [{ staat: 'gescheiden' }] },
    { '/api/a/zet': [{ acl: 'open', privacy: 'schoon' }] })).status, 'GEBLOKKEERD_DOOR_DEFECT');
  const v = oordeel(reg({ '/api/a/lijst': [{ staat: 'gescheiden' }], '/api/a/zet': [{ staat: 'gescheiden' }] }, {}, ['IDOR.json: oud']));
  assert.equal(v.status, 'NIET_GETEST');
  assert.match(v.reden, /vervallen/);
});

test('3. een gezinspaar bewijst alleen iets als A binnenkwam', () => {
  assert.equal(R.paarOordeel({ a: 200, b: 403, anoniem: 401 }), 'gescheiden');
  assert.equal(R.paarOordeel({ a: 403, b: 403, anoniem: 403 }), 'eigenaarWeg');
  assert.equal(R.paarOordeel({ a: 200, b: 200, anoniem: 401 }), 'lek');
  assert.equal(R.paarOordeel({ a: 200, b: 403, anoniem: 200 }), 'openbaar');
  assert.equal(R.gezinOordeel([]).status, 'NIET_GETEST');
  assert.equal(R.gezinOordeel([{ uitslag: 'eigenaarWeg' }]).status, 'NIET_GETEST', 'zonder A binnen is er niets gekruist');
  assert.equal(R.gezinOordeel([{ uitslag: 'gescheiden' }, { uitslag: 'lek', verzoek: 'POST /api/rtf/x', b: 200 }]).status, 'GEBLOKKEERD_DOOR_DEFECT');
  assert.equal(R.gezinOordeel([{ uitslag: 'gescheiden' }, { uitslag: 'openbaar' }]).status, 'BEWEZEN');
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
      assert.ok((r.kruisparen || []).some((p) => p.uitslag === 'gescheiden'), r.functie + ': BEWEZEN zonder een gescheiden kruispaar');
    }
    if (r.status === 'BEWEZEN') assert.ok(['lid', 'gezin'].includes(r.persona), r.functie + ': BEWEZEN voor een persona zonder proef');
  }
  assert.deepEqual(reg.telling, tel, 'de telling overstemt de rijen');
});
