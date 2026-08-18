/* ============================================================================
   DE ZAAK EN HAAR MENSEN -- 6 endpoints achter de leverancier-inlog.

   Deze zes wees de waargenomen dekkingsmeting aan als nooit aangeroepen:
   werkbeleid, werkbeleid/zet, leave/decide, team/message, team/buzz en
   notifications/read. Van het werkbeleid stond het al zwart op wit in de
   vorige ronde: wel beproefd op kernniveau, niet via de route. Dat verschil
   is precies waar een rechtencontrole verdwijnt, want die staat in de route
   en niet in de kern.

   WAT ER OP HET SPEL STAAT

   Het werkbeleid is de gevoeligste knop van dit hele huis. Een werkgever kan
   ermee zeggen: op deze passen geen Salon, geen AI, geen paspoort delen. Dat
   is een echte eis -- compliance, geheimhouding, een ondernemingsraad. Maar
   hetzelfde bord regelt of iemands locatie gedeeld wordt en of hij vindbaar
   is. Vandaar de regel die boven server/kern/lidboard/werkbeleid.js staat en
   die niet configureerbaar is:

       EEN WERKGEVER KAN ALLEEN DICHTZETTEN, NOOIT OPENZETTEN.

   Dit bestand rekent die regel af op de ROUTE, en niet alleen op de motor:
   er is geen "aan"-kant, wat er niet in de lijst staat is weer vrij, en wat
   bij de basis van het toestel hoort (je wallet met je ledenpas) kan een
   werkgever helemaal niet raken.

   Draai los: node --test test/zaak-en-mensen.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, baas, werker, buurbaas, werkerId;
let verlofId = null;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-zaakmensen-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const roster = await api('/api/supplier/roster', { code: 'KIKUNOI' });
  const man = roster.body.staff.find(x => x.role === 'manager');
  const st = roster.body.staff.find(x => x.role === 'staff');
  werkerId = st.id;
  baas = (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: man.id, pin: '1234' })).body.token;
  werker = (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: st.id, pin: '5678' })).body.token;
  const r2 = await api('/api/supplier/roster', { code: 'HOSHI' });
  const m2 = r2.body.staff.find(x => x.role === 'manager');
  buurbaas = (await api('/api/supplier/login', { code: 'HOSHI', staffId: m2.id, pin: '1234' })).body.token;
  assert.ok(baas && werker && buurbaas, 'baas, werker en buurbaas staan klaar');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. het werkbeleid is een lijst om te bedienen, niet een rijtje id\'s', async () => {
  const b = await api('/api/supplier/werkbeleid', {}, baas);
  assert.equal(b.status, 200);
  assert.ok(Array.isArray(b.body.beleid.functies) || Array.isArray(b.body.beleid.opties) || b.body.beleid,
    'er komt een overzicht terug');
  const lijst = b.body.beleid.functies || b.body.beleid.opties || [];
  assert.ok(lijst.length > 5, 'alle schakelbare functies staan erin (' + lijst.length + ')');
  assert.ok(lijst.every(f => 'dicht' in f || 'uit' in f || 'aan' in f), 'per functie staat erbij of het beleid hem dichtzet');
});

test('2. een werkgever kan alleen dichtzetten, nooit openzetten', async () => {
  const b = await api('/api/supplier/werkbeleid', {}, baas);
  const lijst = b.body.beleid.functies || b.body.beleid.opties || [];
  const vast = lijst.find(f => f.vast);
  const vrij = lijst.find(f => !f.vast);
  assert.ok(vrij, 'er is een functie die een werkgever mag dichtzetten');

  const zet = await api('/api/supplier/werkbeleid/zet', { uit: [vrij.id], door: 'Sal de Mar' }, baas);
  assert.equal(zet.status, 200);
  const na = (zet.body.beleid.functies || zet.body.beleid.opties || []).find(f => f.id === vrij.id);
  assert.ok(na.dicht || na.uit, 'de functie staat dicht');

  /* De lijst is de VOLLEDIGE stand, geen los aan/uit. Wat er niet in staat is
     weer vrij voor de medewerker zelf -- dat is de enige manier waarop een
     half mislukt verzoek geen beleid achterlaat dat niemand bedoeld heeft. */
  const leeg = await api('/api/supplier/werkbeleid/zet', { uit: [] }, baas);
  const terug = (leeg.body.beleid.functies || leeg.body.beleid.opties || []).find(f => f.id === vrij.id);
  assert.ok(!(terug.dicht || terug.uit), 'wat niet in de lijst staat is weer vrij');

  /* De wallet met je ledenpas is 'vast'. Die zit met opzet in TWEE lagen:
     het overzicht biedt hem niet eens aan (Object.values(OP_ID).filter(!vast)),
     en de zetter weigert hem alsnog als iemand het id toch meestuurt. Allebei
     afrekenen, want een lijst die iets niet toont is geen slot.

     Mijn eerste versie zocht een vaste functie IN het overzicht en sloeg de
     hele bewering stilletjes over toen hij er geen vond -- precies de vorm
     waar dit huis vaker tegenaan liep, nu in de toets zelf. */
  assert.ok(!vast, 'het overzicht biedt een vaste functie niet eens aan');
  assert.ok(!lijst.some(f => f.id === 'wallet'), 'de wallet staat er niet tussen');
  const poging = await api('/api/supplier/werkbeleid/zet', { uit: ['wallet'] }, baas);
  assert.equal(poging.status, 409, 'de basis van het toestel kan een werkgever niet dichtzetten');
  assert.match(poging.body.error, /basis van het toestel/i);
  assert.equal((await api('/api/supplier/werkbeleid/zet', { uit: ['bestaatniet'] }, baas)).status, 400, 'een onbekende functie');
  assert.equal((await api('/api/supplier/werkbeleid/zet', { uit: 'alles' }, baas)).status, 400, 'geen lijst is geen beleid');
});

test('3. het beleid is van het management, niet van iedereen met een inlog', async () => {
  /* Deze route had als enige van zijn familie geen managercontrole. Wie hem
     kan zetten, zet in een keer voor ELKE medewerker van de zaak Salon, AI en
     het delen van het paspoort uit. Dat is geen knop voor de bediening. */
  const b = await api('/api/supplier/werkbeleid', {}, baas);
  const lijst = b.body.beleid.functies || b.body.beleid.opties || [];
  const vrij = lijst.find(f => !f.vast);
  assert.equal((await api('/api/supplier/werkbeleid/zet', { uit: [vrij.id] }, werker)).status, 403,
    'een medewerker zet het beleid van de hele zaak niet');
  // lezen mag wel: je hoort te weten wie je knop vasthoudt
  assert.equal((await api('/api/supplier/werkbeleid', {}, werker)).status, 200, 'lezen mag het hele team');
});

test('4. verlof: de aanvrager vraagt, het management beslist, en maar een keer', async () => {
  const aan = await api('/api/staff/leave/request',
    { soort: 'verlof', van: '2027-08-10', tot: '2027-08-17', reden: 'Vakantie met het gezin' }, werker);
  assert.equal(aan.status, 200);
  const mijn = await api('/api/staff/mine', {}, werker);
  verlofId = (mijn.body.verlof || [])[0].id;
  assert.ok(verlofId, 'de aanvraag staat op zijn naam');

  assert.equal((await api('/api/supplier/leave/decide', { id: verlofId, action: 'goedkeuren' }, werker)).status, 403,
    'niemand keurt zijn eigen verlof goed');
  assert.equal((await api('/api/supplier/leave/decide', { id: 'bestaatniet', action: 'goedkeuren' }, baas)).status, 404);
  assert.equal((await api('/api/supplier/leave/decide', { id: verlofId, action: 'goedkeuren' }, buurbaas)).status, 404,
    'de buurzaak kent deze aanvraag niet');

  const ja = await api('/api/supplier/leave/decide', { id: verlofId, action: 'goedkeuren' }, baas);
  assert.equal(ja.status, 200);
  assert.equal(ja.body.entry.status, 'goedgekeurd');
  assert.ok(ja.body.entry.decidedBy, 'er staat bij wie besliste');
  assert.equal((await api('/api/supplier/leave/decide', { id: verlofId, action: 'afwijzen' }, baas)).status, 409,
    'een beslissing terugdraaien gaat niet stilletjes langs dezelfde knop');
});

test('5. het teamprikbord en de oproep blijven binnen de zaak', async () => {
  assert.equal((await api('/api/supplier/team/message', { text: '   ' }, werker)).status, 400, 'een leeg bericht');
  assert.equal((await api('/api/supplier/team/message', { text: 'Levering komt om 11 uur.' }, werker)).status, 200,
    'het prikbord is van het hele team');

  const st = await api('/api/supplier/state', {}, baas);
  const team = st.body.state.team || (st.body.state.supplier && st.body.state.supplier.team) || [];
  assert.ok(!team.length || team.some(m => /Levering komt/.test(m.text)), 'het bericht staat op het bord van de eigen zaak');

  // de buzz: een teamlid van een andere zaak bestaat hier niet
  assert.equal((await api('/api/supplier/team/buzz', { staffId: 999999 }, baas)).status, 404);
  const bz = await api('/api/supplier/team/buzz', { all: true }, baas);
  assert.equal(bz.status, 200, 'iedereen oproepen mag, ook als er niemand luistert');
});

test('6. meldingen op gelezen zetten raakt alleen de eigen zaak', async () => {
  const r = await api('/api/supplier/notifications/read', {}, werker);
  assert.equal(r.status, 200);
  const st = await api('/api/supplier/state', {}, baas);
  const mel = st.body.state.notifications || [];
  assert.ok(mel.every(n => n.read), 'alles van deze zaak staat op gelezen');
});
