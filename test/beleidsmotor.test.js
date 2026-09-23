/* DE BELEIDSMOTOR IN DE SCHADUW (AUTHORITY.md fase 1, besluiten A1 en A3).

   Vier dingen die niet mogen sneuvelen:
   1. de regels geven per deur het besluit dat de poort vandaag neemt, met de
      opbouw erbij -- en een ontbrekend feit is ONBEKEND, nooit WEIGEREN of
      TOESTAAN; een onverklaarde deur gaat nooit open;
   2. tegen een echte server, met de gedeelde code, een kantoormens op naam en de
      eigenaar door alle vier deuren: de motor is het NUL keer oneens met de
      poorten, en hij heeft ze echt gezien (eens > 0 per deur);
   3. de motor houdt niets tegen: dezelfde antwoorden als zonder motor;
   4. de stand is een kaart van de gaten en dus niet leesbaar voor de gedeelde
      code; een kantoorroute zonder poort wordt geteld (A3), de verklaarde
      uitzonderingen niet.

   Draai los: node --test test/beleidsmotor.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const { kan, DEUREN, UITKOMST } = require('../server/kern/beleidsmotor/regels');
const { VERKLAARD_OPEN } = require('../server/kern/beleidsmotor');

const F = (o) => Object.assign({ kantoorsessie: false, eigenaar: false, mensOpSessie: false,
  boardroomZetel: false, balieZetel: false }, o);

test('1. de regels: per deur het besluit van de poort, met opbouw', () => {
  const gedeeld = F({ kantoorsessie: true });
  const opNaam = F({ kantoorsessie: true, mensOpSessie: true });
  const eig = F({ eigenaar: true, boardroomZetel: true, balieZetel: true });
  assert.equal(kan(gedeeld, 'kantoor').uitkomst, UITKOMST.TOESTAAN);
  assert.equal(kan(gedeeld, 'op-naam').uitkomst, UITKOMST.WEIGEREN, 'de gedeelde code is geen mens');
  assert.equal(kan(opNaam, 'op-naam').uitkomst, UITKOMST.TOESTAAN);
  assert.equal(kan(opNaam, 'boardroom').uitkomst, UITKOMST.WEIGEREN, 'een mens op naam is nog geen boardroom');
  assert.equal(kan(F({ kantoorsessie: true, boardroomZetel: true }), 'boardroom').uitkomst, UITKOMST.TOESTAAN);
  assert.equal(kan(F({ boardroomZetel: true }), 'boardroom').uitkomst, UITKOMST.WEIGEREN,
    'een zetel zonder kantoorsessie komt de kantoordeur niet door');
  for (const deur of Object.keys(DEUREN)) assert.equal(kan(eig, deur).uitkomst, UITKOMST.TOESTAAN, deur);
  assert.equal(kan(F({}), 'balie').uitkomst, UITKOMST.WEIGEREN);

  const w = kan(gedeeld, 'op-naam');
  assert.equal(w.opbouw.length, 2);
  assert.deepEqual(w.opbouw.map(o => o.gehaald), [true, false], 'de opbouw zegt welke eis viel');
  assert.match(w.reden, /mens/);

  assert.equal(kan(F({ kantoorsessie: undefined }), 'kantoor').uitkomst, UITKOMST.ONBEKEND,
    'een bron die niet kon antwoorden is geen weigering');
  assert.equal(kan(F({ kantoorsessie: true, boardroomZetel: undefined }), 'boardroom').uitkomst, UITKOMST.ONBEKEND);
  assert.equal(kan(F({ kantoorsessie: false, eigenaar: false, boardroomZetel: undefined }), 'boardroom').uitkomst,
    UITKOMST.WEIGEREN, 'een eis die zeker faalt weegt zwaarder dan een onbekende');
  assert.equal(kan(eig, 'verzonnen').uitkomst, UITKOMST.ONBEKEND, 'een onverklaarde deur gaat nooit open (A3)');
});

const mappen = [];
let srv, gedeeld, opNaam, eig;
function api(pad, body, token) {
  return fetch(srv.base + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

test.before(async () => {
  const m = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-beleid-')); mappen.push(m);
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: m, OFFICE_CODE: 'BELEID-KANTOOR' } });
  gedeeld = (await api('/api/office/login', { code: 'BELEID-KANTOOR' })).body.token;
  /* Een MEDEWERKER op naam, en nadrukkelijk niet de eigenaar: kantoorAlsPersoon
     in ./helper.js pakt eerst de eigenaar, en dan meet de boardroomdeur niets. */
  const reg = (await api('/api/auth/register', { name: 'Beleid Toets', email: 'beleid' + Date.now() + '@voorbeeld.test',
    password: 'geheim123', geboortedatum: '1985-05-05', pasApp: 'rtg' })).body;
  await api('/api/account/koppel', { soort: 'kantoor', code: 'BELEID-KANTOOR' }, reg.token);
  opNaam = (await api('/api/account/start', { rol: 'kantoor' }, reg.token)).body.token;
  eig = (await api('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).body.token;
  assert.ok(gedeeld && opNaam && eig, 'drie sessies nodig: gedeelde code, kantoor op naam, eigenaar');
});
test.after(() => {
  stop(srv && srv.child);
  for (const m of mappen) { try { fs.rmSync(m, { recursive: true, force: true }); } catch (e) {} }
});

test('2 en 3. door alle vier deuren: nul keer oneens, en de poort beslist nog steeds', async () => {
  /* Per sessie en per deur wat de POORT vandaag zegt; de motor mag daar niets
     aan veranderen (toets 3) en moet het er overal mee eens zijn (toets 2). */
  const proeven = [
    ['/api/office/state', { gedeeld: 200, opNaam: 200, eig: 200 }],        // kantoor
    ['/api/office/verifications', { gedeeld: 403, opNaam: 200, eig: 200 }], // op-naam
    ['/api/office/mensdeur', { gedeeld: 403, opNaam: 403, eig: 200 }],      // boardroom
    ['/api/office/balie/zetels', { gedeeld: 403, opNaam: 403, eig: 200 }]   // kantoor + boardroom (de zetellijst)
  ];
  const sessies = { gedeeld, opNaam, eig };
  for (const [pad, verwacht] of proeven) {
    for (const [wie, status] of Object.entries(verwacht)) {
      const r = await api(pad, {}, sessies[wie]);
      assert.equal(r.status, status, pad + ' als ' + wie + ': ' + JSON.stringify(r.body).slice(0, 160));
    }
  }
  // de balie zelf: alleen wie een zetel heeft (de eigenaar via de boardroom)
  assert.equal((await api('/api/office/balie/zoek', { codenaam: 'zz' }, gedeeld)).status, 403);
  assert.equal((await api('/api/office/balie/zoek', { codenaam: 'zz' }, opNaam)).status, 403);
  assert.notEqual((await api('/api/office/balie/zoek', { codenaam: 'zz' }, eig)).status, 403);

  const s = await api('/api/office/beleidsmotor', {}, eig);
  assert.equal(s.status, 200, JSON.stringify(s.body).slice(0, 200));
  for (const d of s.body.deuren) {
    assert.equal(d.oneens, 0, 'de motor was het oneens bij ' + d.deur + ': ' + JSON.stringify(s.body.oneens).slice(0, 400));
    assert.equal(d.onbekend, 0, d.deur + ': een feit kon niet worden vastgesteld');
    assert.ok(d.eens > 0, 'de deur ' + d.deur + ' is niet gemeten; dan zegt nul keer oneens niets');
    assert.equal(d.kanVerhuizen, false, 'na een paar verzoeken is niets rijp');
  }
});

test('4. de stand is niet voor de gedeelde code, en A3 telt routes zonder poort', async () => {
  assert.equal((await api('/api/office/beleidsmotor', {}, gedeeld)).status, 403,
    'de kaart van de gaten is niet leesbaar voor de sessie die het gat is');
  assert.equal((await api('/api/office/beleidsmotor', {}, null)).status, 401);
  const s = (await api('/api/office/beleidsmotor', {}, eig)).body;
  const routes = s.zonderPoort.map(z => z.route);
  for (const open of Object.keys(VERKLAARD_OPEN)) {
    assert.ok(!routes.includes(open), open + ' is verklaard open en hoort niet als gat te tellen');
  }
  assert.ok(!routes.includes('POST /api/office/state'), 'een route achter officeAuth is geen gat');
  assert.equal(typeof s.zonderPoortTotaal, 'number');
  assert.match(s.grens, /ONBEKEND is geen WEIGEREN/);
});

test('5. A3 slaat uit: een kantoorroute zonder bekende poort wordt geteld, de rest niet', () => {
  /* Zonder deze proef kan de A3-teller stil kapot zijn: tegen de echte server
     draagt elke kantoorroute vandaag een poort, dus daar blijft hij op nul. */
  const { EventEmitter } = require('events');
  const { maakBeleidsmotor } = require('../server/kern/beleidsmotor');
  const m = maakBeleidsmotor({ db: { data: {} }, save: () => {}, sessionFor: () => null, accounts: {}, eigenaar: {},
    boardroomWie: () => null, magBoardroom: () => false, balieBron: () => () => false });
  const loop = (patroon, status, poorten, method) => {
    const req = { method: method || 'POST', routePatroon: patroon, beleidsPoorten: poorten };
    const res = new EventEmitter(); res.statusCode = status;
    m.meelezer(req, res, () => {});
    res.emit('finish');
  };
  loop('/api/office/zonder-slot', 200);
  loop('/api/office/zonder-slot', 400);
  loop('/api/office/met-slot', 200, ['kantoor']);
  loop('/api/office/bestaat-niet', 404);
  loop('/api/office/login', 401);
  loop('/api/office/doc', 403, undefined, 'GET');
  const z = m.stand().zonderPoort;
  assert.deepEqual(z, [{ route: 'POST /api/office/zonder-slot', keer: 2 }],
    'alleen de route zonder poort telt; een poort, een 404 en een verklaarde uitzondering niet');
});

test('6. de paspoortscan is op naam, zoals de lijst waar de link uit komt', async () => {
  const doc = (token) => fetch(srv.base + '/api/office/doc?file=bestaat-niet.jpg&token=' + encodeURIComponent(token));
  assert.equal((await doc(gedeeld)).status, 403, 'de gedeelde code opent geen identiteitsbewijs');
  assert.equal((await doc(opNaam)).status, 404, 'een kantoormens op naam komt door de deur (en vindt dan het bestand niet)');
  assert.equal((await doc(eig)).status, 404);
  assert.equal((await doc('onzin')).status, 401);
});

test('7. besluit A2 in de schaduw: de eigenaar door een gevoelige deur wordt geteld, een medewerker niet', async () => {
  /* Toets 2 liet de eigenaar al door de kluis (verifications) en de balie (zoek)
     gaan; hier eerst een medewerker op naam door dezelfde kluisdeur, zodat een
     teller die IEDEREEN telt hier zakt. */
  const voor = (await api('/api/office/beleidsmotor', {}, eig)).body.eigenaarZonderStapop;
  const telVoor = (voor.find(x => x.route === 'POST /api/office/verifications') || { keer: 0 }).keer;
  assert.equal((await api('/api/office/verifications', {}, opNaam)).status, 200);
  const na1 = (await api('/api/office/beleidsmotor', {}, eig)).body.eigenaarZonderStapop;
  assert.equal((na1.find(x => x.route === 'POST /api/office/verifications') || { keer: 0 }).keer, telVoor,
    'een medewerker op naam is niet de eigenaar en telt hier niet');
  assert.equal((await api('/api/office/verifications', {}, eig)).status, 200, 'de eigenaar wordt NIET tegengehouden (schaduw)');
  const s = (await api('/api/office/beleidsmotor', {}, eig)).body;
  const rij = s.eigenaarZonderStapop.find(x => x.route === 'POST /api/office/verifications');
  assert.ok(rij && rij.keer === telVoor + 1 && rij.deur === 'op-naam', 'de eigenaar door de kluis telt: ' + JSON.stringify(s.eigenaarZonderStapop));
  assert.ok(s.eigenaarZonderStapop.some(x => x.deur === 'balie'), 'ook de ledenbalie (toets 2) staat erin');
  assert.ok(!s.eigenaarZonderStapop.some(x => x.route === 'POST /api/office/state'), 'de gewone kantoordeur is geen gevoelige lezing');
  assert.deepEqual(s.stapopDeuren, ['op-naam', 'balie']);
});

test('8. waarom mag ik hier (niet) in: per deur het besluit over jezelf, met de eis die viel', async () => {
  assert.equal((await api('/api/office/beleidsmotor/waarom', {}, null)).status, 401);
  const per = async (t) => Object.fromEntries((await api('/api/office/beleidsmotor/waarom', {}, t)).body.deuren.map(d => [d.deur, d]));
  const g = await per(gedeeld);
  assert.equal(g.kantoor.uitkomst, 'TOESTAAN');
  assert.equal(g['op-naam'].uitkomst, 'WEIGEREN', 'de gedeelde code is geen mens');
  assert.match(g['op-naam'].reden, /RTG-account|mens/, 'en de reden zegt welke eis viel');
  assert.equal(g['op-naam'].opbouw[1].gehaald, false);
  const m = await per(opNaam);
  assert.equal(m['op-naam'].uitkomst, 'TOESTAAN');
  assert.equal(m.boardroom.uitkomst, 'WEIGEREN');
  const e = await per(eig);
  for (const d of ['kantoor', 'op-naam', 'boardroom', 'balie']) assert.equal(e[d].uitkomst, 'TOESTAAN', d);
  /* het antwoord moet kloppen met wat de poort echt doet: dezelfde sessie, dezelfde deur */
  assert.equal((await api('/api/office/verifications', {}, gedeeld)).status, 403);
  assert.equal((await api('/api/office/mensdeur', {}, opNaam)).status, 403);
});
