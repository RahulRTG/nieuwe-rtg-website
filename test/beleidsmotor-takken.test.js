/* ============================================================================
   DE BELEIDSMOTOR (server/kern/beleidsmotor/index.js), ZONDER SERVER.

   test/beleidsmotor.test.js meet de motor tegen een echte server. Hier de
   wikkel zelf met nepverzoeken: eens en oneens met de poort, ONBEKEND bij een
   bron die gooit, de stap-op-teller van de eigenaar, werkwoord- en
   kamertelling, exporten, een poort zonder naam, een verzoek waar de motor
   niets van kan maken, en de afgedwongen deur die NAAST de poort weigert (403)
   of bij onbekend 503 geeft. De klok is ingespoten; niets wacht op echte tijd.
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { maakBeleidsmotor, VERKLAARD_OPEN, VELDEN } = require('../server/kern/beleidsmotor');

const DAG = 86400000;

function opzet(extra) {
  let t = Date.parse('2026-10-01T09:00:00Z');
  const db = { data: {}, writable: true };
  const save = () => {};
  const bewerkCollectie = require('../server/db/collectie-bewerken')({ store: 'json', db, save });
  const sessies = {
    kantoor: { role: 'office', lidKey: 'lid-1' },
    gedeeld: { role: 'office' }
  };
  const deps = Object.assign({
    db, save, bewerkCollectie,
    sessionFor: tok => { if (tok === 'stuk') throw new Error('sessiebron weg'); return sessies[tok] || null; },
    accounts: { verifyToken: tok => (tok === 'eigenaar' ? { id: 'u-eig' } : null) },
    eigenaar: { isEigenaar: (acc, u) => u.id === 'u-eig' },
    boardroomWie: req => req.wie || null,
    magBoardroom: wie => wie === 'lid-1' || wie === 'baas',
    boardroomBaas: wie => wie === 'baas',
    balieBron: () => wie => wie === 'lid-1',
    kamersVan: key => (key === 'lid-1' ? ['sales'] : null),
    nu: () => t
  }, extra || {});
  const m = maakBeleidsmotor(deps);
  return { m, db, schuif: ms => { t += ms; } };
}

function verzoek({ token, patroon, method, body, wie }) {
  return { method, routePatroon: patroon, body, wie,
    get: k => (k === 'authorization' && token ? 'Bearer ' + token : undefined) };
}
function antwoord(status) {
  const res = new EventEmitter();
  res.statusCode = status || 200;
  res.writableFinished = true;
  res.status = c => { res.statusCode = c; return res; };
  res.json = b => { res.body = b; return res; };
  return res;
}
const laat = (req, res) => res.emit('close');
const doorlaten = function officeAuth(req, res, next) { next(); };
const tegenhouden = function officeAuth(req, res) { res.status(401).json({ error: 'nee' }); };

function loop(m, deur, poort, opt) {
  const req = verzoek(Object.assign({ method: 'POST', patroon: '/api/office/state' }, opt));
  const res = antwoord(opt && opt.status);
  let verder = 0;
  m.bewaak(deur, poort)(req, res, () => { verder++; });
  laat(req, res);
  return { req, res, verder };
}
const deurStand = (m, deur) => m.stand().deuren.find(d => d.deur === deur);

test('de stand van een verse motor is leeg en nog niet rijp', () => {
  const { m } = opzet();
  const s = m.stand();
  assert.equal(s.deuren.length, 4);
  assert.ok(s.deuren.every(d => d.eens === 0 && d.kanVerhuizen === false));
  assert.deepEqual(s.oneens, []);
  assert.equal(s.verklaardOpen, VERKLAARD_OPEN);
  assert.ok(VELDEN.includes('zonderPoort'));
});

test('een onbekende deur kan niet bewaakt worden', () => {
  const { m } = opzet();
  assert.throws(() => m.bewaak('achterdeur', doorlaten), /onbekende deur achterdeur/);
});

test('eens, oneens en onbekend worden per deur geteld, met een voorbeeld bij oneens', () => {
  const { m } = opzet();
  assert.equal(loop(m, 'kantoor', doorlaten, { token: 'kantoor' }).verder, 1);
  loop(m, 'kantoor', tegenhouden, { token: 'kantoor' });          // motor zegt ja, poort nee
  loop(m, 'kantoor', doorlaten, { token: 'onbekend-token' });      // motor zegt nee, poort ja
  loop(m, 'kantoor', doorlaten, { token: 'stuk' });                // bron gooit: onbekend
  const d = deurStand(m, 'kantoor');
  assert.equal(d.eens, 1);
  assert.equal(d.oneens, 2);
  assert.equal(d.onbekend, 1);
  assert.match(d.waarom, /2 keer oneens/);
  const vb = m.stand().oneens;
  assert.equal(vb.length, 2);
  assert.deepEqual(vb.map(v => [v.poort, v.motor]), [['TOESTAAN', 'WEIGEREN'], ['WEIGEREN', 'TOESTAAN']]);
  assert.equal(vb[0].route, 'POST /api/office/state');
});

test('de voorbeelden van oneens blijven op twintig', () => {
  const { m } = opzet();
  for (let i = 0; i < 25; i++) loop(m, 'kantoor', tegenhouden, { token: 'kantoor' });
  assert.equal(m.stand().oneens.length, 20);
  assert.equal(deurStand(m, 'kantoor').oneens, 25);
});

test('een afgebroken antwoord telt niet; zonder methode of patroon een vaste sleutel', () => {
  const { m } = opzet();
  const req = { get: () => 'Bearer kantoor' };
  const res = antwoord(); res.writableFinished = false;
  m.bewaak('kantoor', doorlaten)(req, res, () => {});
  res.emit('close');
  assert.equal(deurStand(m, 'kantoor').eens, 0);
  const req2 = { get: () => 'Bearer kantoor' };
  const res2 = antwoord();
  m.bewaak('kantoor', tegenhouden)(req2, res2, () => {});
  res2.emit('close');
  assert.equal(m.stand().oneens[0].route, 'GET (geen patroon)');
});

test('een verzoek waar de motor niets van kan maken, gaat ongemoeid naar de poort', () => {
  const { m } = opzet();
  const req = { method: 'POST', routePatroon: '/x', get: () => { throw new Error('kapotte kop'); } };
  const res = antwoord();
  let verder = 0;
  m.bewaak('kantoor', doorlaten)(req, res, () => { verder++; });
  res.emit('close');
  assert.equal(verder, 1);
  assert.deepEqual(req.beleidsPoorten, ['kantoor']);
  assert.equal(deurStand(m, 'kantoor').routes, 0, 'zonder besluit niets geteld');
});

test('een antwoord zonder once is geen meting', () => {
  const { m } = opzet();
  const req = verzoek({ token: 'kantoor', patroon: '/a', method: 'POST' });
  let verder = 0;
  m.bewaak('kantoor', doorlaten)(req, { statusCode: 200 }, () => { verder++; });
  assert.equal(verder, 1);
  assert.equal(req.beleidsWerk, undefined);
});

test('de wikkel draagt de naam van de poort, of anders die van de deur', () => {
  const { m } = opzet();
  assert.equal(m.bewaak('kantoor', doorlaten).name, 'officeAuth');
  const naamloos = [function (req, res, next) { next(); }][0];
  assert.equal(naamloos.name, '');
  assert.equal(m.bewaak('balie', naamloos).name, 'balie');
});

test('de eigenaar door een stap-op-deur wordt geteld, een medewerker niet', () => {
  const { m } = opzet();
  loop(m, 'op-naam', doorlaten, { token: 'eigenaar', patroon: '/api/office/verifications' });
  loop(m, 'op-naam', doorlaten, { token: 'kantoor', patroon: '/api/office/verifications', wie: 'lid-1' });
  loop(m, 'op-naam', doorlaten, { token: 'kantoor', patroon: '/api/office/verifications', wie: 'baas' });
  const s = m.stand().eigenaarZonderStapop;
  assert.equal(s.length, 1);
  assert.match(JSON.stringify(s[0]), /verifications/);
  assert.equal(s[0].keer, 2);
});

test('de boardroom telt werkwoorden en de zetel zijn laatste gebruik', () => {
  const { m } = opzet();
  loop(m, 'boardroom', doorlaten, { token: 'kantoor', wie: 'lid-1', patroon: '/api/office/kosten/overzicht' });
  loop(m, 'boardroom', doorlaten, { token: 'kantoor', wie: 'lid-1', patroon: '/api/office/nergens' });
  loop(m, 'boardroom', tegenhouden, { token: 'kantoor', wie: 'lid-1', patroon: '/api/office/kosten/overzicht' });
  const s = m.stand();
  assert.equal(s.werkwoorden.find(w => w.werkwoord === 'kosten').gebruik, 1, 'alleen wie er echt doorheen ging');
  assert.equal(s.zonderWerkwoord, 1);
  const l = m.laatstGebruikt('lid-1', 'boardroom');
  assert.equal(l.slapend, 'nee');
  assert.equal(m.laatstGebruikt('niemand', 'boardroom').slapend, 'onbekend');
  assert.equal(m.spoel(), true);
});

test('de kantoordeur telt een kamer naar toewijzing', () => {
  const { m } = opzet();
  loop(m, 'kantoor', doorlaten, { token: 'kantoor', wie: 'lid-1', patroon: '/api/office/kamer', body: { id: 'sales' } });
  loop(m, 'kantoor', doorlaten, { token: 'kantoor', patroon: '/api/office/kamer', body: { id: 'sales' } });
  const sales = m.stand().kamers.find(k => k.kamer === 'sales');
  assert.equal(sales.gebruik, 2);
  assert.equal(sales.naarToewijzing.eigen, 1);
  assert.equal(sales.naarToewijzing.zonderToewijzing, 1);
});

test('een meting die gooit raakt het antwoord niet', () => {
  const { m } = opzet({ boardroomWie: req => { if (req.gooi) throw new Error('weg'); return null; } });
  const req = verzoek({ token: 'kantoor', patroon: '/a', method: 'POST' });
  const res = antwoord();
  let verder = 0;
  m.bewaak('kantoor', doorlaten)(req, res, () => { verder++; });
  req.gooi = true;
  assert.doesNotThrow(() => res.emit('close'));
  assert.equal(verder, 1);
  assert.equal(deurStand(m, 'kantoor').eens, 1, 'wat voor de fout kwam, telt wel');
});

test('de meelezer telt geleverde exporten en routes zonder poort', () => {
  const { m } = opzet();
  const lees = (patroon, status, poorten) => {
    const req = { method: 'POST', routePatroon: patroon, beleidsPoorten: poorten };
    const res = antwoord(status);
    let verder = 0;
    m.meelezer(req, res, () => { verder++; });
    res.emit('close');
    return verder;
  };
  assert.equal(lees('/api/office/export.csv', 200, ['op-naam']), 1);
  lees('/api/office/export.csv', 403, ['op-naam']);
  lees('/api/office/open', 200, []);
  lees(undefined, 200);
  lees('/api/office/login', 200);
  lees('/api/office/weg', 404);
  const s = m.stand();
  assert.equal(s.exporten.find(e => e.route === 'POST /api/office/export.csv').geleverd, 1);
  assert.deepEqual(s.zonderPoort, [{ route: 'POST /api/office/open', keer: 1 }]);
});

test('waarom en kan geven per deur het besluit over de aanroeper zelf', () => {
  const { m } = opzet();
  const w = m.waarom(verzoek({ token: 'kantoor', wie: 'lid-1' }));
  assert.deepEqual(w.map(x => [x.deur, x.uitkomst]),
    [['kantoor', 'TOESTAAN'], ['op-naam', 'TOESTAAN'], ['boardroom', 'TOESTAAN'], ['balie', 'TOESTAAN']]);
  assert.ok(w[0].opbouw[0].eis.length >= 1);
  const niemand = m.waarom(verzoek({}));
  assert.ok(niemand.every(x => x.uitkomst === 'WEIGEREN'));
  assert.equal(m.kan(verzoek({ token: 'gedeeld' }), 'op-naam').uitkomst, 'WEIGEREN');
  assert.equal(m.kan(verzoek({ token: 'stuk' }), 'kantoor').uitkomst, 'ONBEKEND');
});

test('een rijpe deur kan afgedwongen worden: dan 403 bij weigeren en 503 bij onbekend', () => {
  const { m, schuif } = opzet();
  assert.equal(m.afdwingen.zet('kantoor', true, 'eig').status, 409, 'nog niet rijp');
  for (let i = 0; i < 200; i++) loop(m, 'kantoor', doorlaten, { token: 'kantoor' });
  assert.equal(m.afdwingen.zet('kantoor', true, 'eig').status, 409, 'nog geen zeven dagen');
  schuif(8 * DAG);
  assert.equal(deurStand(m, 'kantoor').kanVerhuizen, true);
  const z = m.afdwingen.zet('kantoor', true, 'eig');
  assert.equal(z.ok, true);
  assert.equal(z.stand, 'afdwingen');
  const nee = loop(m, 'kantoor', doorlaten, { token: 'vreemd' });
  assert.equal(nee.verder, 0, 'de poort wordt niet eens gevraagd');
  assert.equal(nee.res.statusCode, 403);
  assert.match(nee.res.body.error, /weigert deze deur \(kantoor\)/);
  const weet = loop(m, 'kantoor', doorlaten, { token: 'stuk' });
  assert.equal(weet.res.statusCode, 503);
  assert.equal(loop(m, 'kantoor', doorlaten, { token: 'kantoor' }).verder, 1, 'wie mag, gaat door');
  assert.equal(m.afdwingen.zet('kantoor', false, 'eig').stand, 'schaduw');
});
