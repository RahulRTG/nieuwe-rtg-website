/* DE UITVOERTELLERS VAN DE BELEIDSMOTOR, NAAST DE DEURTELLERS (11 oktober 2026).

   Een tegenlezing vond drie dingen in kern/beleidsmotor/:
     1. de uitvoertellers (~790 sleutels) deelden MAX_SLEUTELS met de
        deurtellers, en wat over het plafond liep viel stil in `overig` -- dan
        kan de rijpheid van een deur dalen door iets wat niets met die deur te
        maken heeft (MIDDEL-3);
     2. telUitvoer stond in dezelfde try als kan(): gooide de teller, dan
        vervielen vergelijk en afdwingen voor die deur -- fail-open (LAAG-1);
     3. de dedupe (req.beleidsUitvoer) was niet getoetst: een route achter
        twee deuren hoort precies EEN keer te tellen (LAAG-2, M5).

   Draai los: node --test test/beleidsmotor-uitvoerbak.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('events');
const { maakSpoeler } = require('../server/kern/kantoor/mensdeur-spoel');
const { maakBeleidsmotor, MAX_SLEUTELS, MAX_UITVOER } = require('../server/kern/beleidsmotor');
const uitvoeren = require('../server/kern/beleidsmotor/uitvoeren');

test('1. een eigen plafond per voorvoegsel, en wat overloopt wordt geteld', () => {
  const kaart = {};
  const sp = maakSpoeler({ bak: () => kaart, save() {}, collectie: 'x', maxPaden: 3, velden: ['eens', 'passkey'],
    plafonden: [{ voorvoegsel: 'uitvoer ', max: 2 }] });
  for (let i = 0; i < 5; i++) sp.tikVeld('uitvoer k POST /r' + i, 'passkey');
  sp.spoel();
  for (let i = 0; i < 3; i++) sp.tikVeld('kantoor POST /d' + i, 'eens');
  sp.spoel();
  assert.ok(kaart['kantoor POST /d2'], 'een deurrij kreeg geen plek door uitvoersleutels');
  assert.equal(kaart.overig, undefined, 'er liep geen deurrij over');
  assert.equal(Object.keys(kaart).filter(k => k.startsWith('uitvoer ') && k !== 'uitvoer overig').length, 2);
  assert.equal(kaart['uitvoer overig'].overgelopen, 3, 'wat over het plafond liep is geteld');
  assert.equal(kaart['uitvoer overig'].passkey, 3, 'en de tikken zelf gaan niet verloren');
  sp.tikVeld('kantoor POST /d9', 'eens'); sp.spoel();
  assert.equal(kaart.overig.overgelopen, 1, 'ook de deurbak telt wat overloopt');
});

test('2. de beleidsmotor geeft de uitvoertellers een eigen plafond', () => {
  assert.ok(MAX_UITVOER > 0 && MAX_SLEUTELS > 0);
  const kaart = {};
  for (let i = 0; i < MAX_SLEUTELS; i++) kaart['uitvoer k POST /r' + i] = { pad: 'uitvoer k POST /r' + i };
  const m = motor({ db: { data: { beleidsmotor: kaart } } });
  m.doorDeur('kantoor', 'POST', '/api/office/proef-deur');
  m.spoel();
  const st = m.stand();
  const d = st.deuren.find(x => x.deur === 'kantoor');
  assert.equal(d.eens + d.oneens + d.onbekend, 1, 'de deurrij telde, ondanks een vol uitvoerplafond');
  assert.ok(st.overgelopen && typeof st.overgelopen.deuren === 'number', 'de stand meldt wat overliep');
});

function motor(extra) {
  const sess = { role: 'office' };
  const m = maakBeleidsmotor(Object.assign({ db: { data: {} }, save: () => {}, sessionFor: () => sess,
    accounts: { verifyToken: () => null }, eigenaar: { isEigenaar: () => false },
    boardroomWie: () => null, magBoardroom: () => false, balieBron: () => () => false }, extra || {}));
  m.doorDeur = (deur, method, patroon, req0, poorten) => {
    const req = req0 || { method, routePatroon: patroon };
    req.get = (k) => (String(k).toLowerCase() === 'authorization' ? 'Bearer t' : '');
    const res = new EventEmitter(); res.statusCode = 200; res.writableFinished = true;
    const deuren = poorten || [deur];
    let i = 0;
    const volgende = () => {
      if (i >= deuren.length) return;
      const w = m.bewaak(deuren[i++], (q, r, next) => next());
      w(req, res, volgende);
    };
    volgende();
    res.emit('close');
    return req;
  };
  return m;
}

test('3. een route achter twee deuren telt precies een keer (dedupe)', () => {
  const m = motor();
  m.doorDeur(null, 'POST', '/api/office/twee-deuren', null, ['kantoor', 'op-naam']);
  m.spoel();
  const u = m.stand().uitvoeren;
  assert.equal(u.waarnemingen, 1, 'twee deuren, een handeling: ' + JSON.stringify(u.werklijst));
  assert.equal(u.werklijst[0].gedeeld, 1);
});

test('4. gooit de uitvoerteller, dan vergelijkt de deur toch (geen fail-open)', () => {
  const m = motor();
  const req = { method: 'POST', routePatroon: '/api/office/gooit' };
  Object.defineProperty(req, 'beleidsUitvoer', { get() { throw new Error('kapotte teller'); }, set() {} });
  m.doorDeur('kantoor', 'POST', '/api/office/gooit', req);
  m.spoel();
  const d = m.stand().deuren.find(x => x.deur === 'kantoor');
  assert.equal(d.eens + d.oneens, 1, 'de vergelijking verviel omdat de uitvoerteller gooide');
});

test('5. de werklijst houdt kleine aantallen binnen, behalve voor wie exact moet zien', () => {
  const stand = require('../server/kern/beleidsmotor/stand');
  const u = stand.kleineAantallen({ werklijst: [{ route: 'POST /x', klasse: 'k', passkey: 0, opNaam: 1, eigenaarToken: 0, gedeeld: 7, zouZakken: 8 }] });
  const r = u.werklijst[0];
  assert.equal(r.opNaam, null, 'een 1 per route kan een mens zijn');
  assert.equal(r.klein, 'TE_KLEINE_GROEP');
  assert.equal(r.gedeeld, 7);
  assert.equal(r.passkey, 0, 'een nul is geen klein aantal');
  assert.equal(u.kleineAantallen.grens, stand.KLEIN);
  assert.ok(uitvoeren.SOORTEN.length);
});
