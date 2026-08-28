/* ============================================================================
   DE BALIE VAN EEN ZAAK -- 7 endpoints uit de supplier-groep.

   agenda/toevoegen, agenda/wijzig, agenda/verwijder, ticket/add,
   ticket/status, lost/add en lost/done stonden als nooit aangeroepen in de
   waargenomen dekkingsmeting. Ze horen bij elkaar omdat ze het dagelijkse
   werk aan de balie zijn: een afspraak in de zaakagenda, een klus melden en
   afvinken, en een gevonden voorwerp bewaren en meegeven.

   WAT ER OP HET SPEL STAAT

   - DE ZAAKAGENDA IS VAN HET MANAGEMENT. Lezen mag het hele team -- je hoort
     te weten wat er die dag speelt -- maar erin schrijven niet. Dit is
     dezelfde soort deur als het werkbeleid, en daar ontbrak de controle
     eerder deze week; hier staat hij er wel, en nu ligt dat vast.
   - EEN ID VAN DE BUREN IS GEEN SLEUTEL. Drie van deze zeven routes doen aan
     een onbekend id gewoon niets en melden 200. Dat is op zichzelf prima --
     opruimen mag idempotent zijn -- maar dan moet vaststaan dat er bij de
     BUURZAAK ook echt niets gebeurde. Een stille 200 is precies het antwoord
     waarbij niemand meer kijkt.

   WAT HIER IS RECHTGEZET

   ticket/status nam elke onbekende status aan en maakte er stilletjes 'open'
   van. Een tikfout in de status van een AFGERONDE klus zette hem dus terug op
   de lijst, met de naam van wie hem afrondde er nog onder. Elders in dit huis
   is de afspraak anders en duidelijker -- kern/markt.js zetStatus antwoordt
   "Onbekende status." met 400 -- en die afspraak geldt nu ook hier.

   Draai los: node --test test/zaak-balie.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, baas, werker, buurbaas;
let agendaId = null, ticketId = null, lostId = null, buurTicketId = null, buurLostId = null, buurAgendaId = null;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-balie-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
async function inlog(code, rol) {
  const roster = await api('/api/supplier/roster', { code });
  const wie = roster.body.staff.find(x => x.role === rol);
  return (await api('/api/supplier/login', { code, staffId: wie.id, pin: rol === 'manager' ? '1234' : '5678' })).body.token;
}
const dag = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  baas = await inlog('KIKUNOI', 'manager');
  werker = await inlog('KIKUNOI', 'staff');
  buurbaas = await inlog('HOSHI', 'manager');
  assert.ok(baas && werker && buurbaas, 'baas, werker en buurbaas staan klaar');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. de zaakagenda: lezen doet het team, schrijven het management', async () => {
  assert.equal((await api('/api/supplier/agenda/lijst', {}, werker)).status, 200,
    'lezen mag het hele team: je hoort te weten wat er die dag speelt');
  assert.equal((await api('/api/supplier/agenda/toevoegen', { titel: 'Leverancier komt', datum: dag(4) }, werker)).status, 403,
    'maar de bediening zet niets in de agenda van de zaak');

  assert.equal((await api('/api/supplier/agenda/toevoegen', { titel: '', datum: dag(4) }, baas)).status, 400, 'zonder titel');
  assert.equal((await api('/api/supplier/agenda/toevoegen', { titel: 'Iets', datum: 'volgende week' }, baas)).status, 400, 'zonder datum');

  const mk = await api('/api/supplier/agenda/toevoegen',
    { titel: 'Bezoek van de brandweer', datum: dag(6), tijd: '10:00', notitie: 'Jaarlijkse controle.' }, baas);
  assert.equal(mk.status, 200);
  const item = mk.body.items.find(i => i.titel === 'Bezoek van de brandweer');
  assert.ok(item, 'de afspraak staat in de lijst');
  agendaId = item.id;
});

test('2. wijzigen en weghalen zijn ook van het management', async () => {
  assert.equal((await api('/api/supplier/agenda/wijzig', { id: agendaId, titel: 'Gekaapt' }, werker)).status, 403);
  assert.equal((await api('/api/supplier/agenda/verwijder', { id: agendaId }, werker)).status, 403);
  assert.equal((await api('/api/supplier/agenda/wijzig', { id: 'bestaatniet', titel: 'X' }, baas)).status, 400,
    'een afspraak die er niet is');

  const w = await api('/api/supplier/agenda/wijzig', { id: agendaId, tijd: '11:30', gedaan: true }, baas);
  assert.equal(w.status, 200);
  const na = w.body.items.find(i => i.id === agendaId);
  assert.equal(na.tijd, '11:30');
  assert.equal(na.gedaan, true);
  assert.equal(na.titel, 'Bezoek van de brandweer', 'wat je niet meestuurt blijft staan');
});

test('3. de agenda van de buren is een andere agenda', async () => {
  const buur = await api('/api/supplier/agenda/toevoegen', { titel: 'Personeelsuitje', datum: dag(9) }, buurbaas);
  buurAgendaId = buur.body.items.find(i => i.titel === 'Personeelsuitje').id;

  assert.ok(!(await api('/api/supplier/agenda/lijst', {}, baas)).body.items.some(i => i.id === buurAgendaId),
    'de eigen lijst toont de afspraak van de buren niet');
  assert.equal((await api('/api/supplier/agenda/wijzig', { id: buurAgendaId, titel: 'Gekaapt' }, baas)).status, 400,
    'en met hun id valt er niets te wijzigen');

  /* verwijder() meldt 200 voor een id dat je niet kent -- opruimen mag
     idempotent zijn. Maar dan moet vaststaan dat er bij de buren ook echt
     niets gebeurde, want een stille 200 is het antwoord waarbij niemand meer
     kijkt. */
  assert.equal((await api('/api/supplier/agenda/verwijder', { id: buurAgendaId }, baas)).status, 200);
  assert.ok((await api('/api/supplier/agenda/lijst', {}, buurbaas)).body.items.some(i => i.id === buurAgendaId),
    'de afspraak van de buren staat er gewoon nog');

  const weg = await api('/api/supplier/agenda/verwijder', { id: agendaId }, baas);
  assert.ok(!weg.body.items.some(i => i.id === agendaId), 'de eigen afspraak gaat er wel af');
});

test('4. een klus melden en afvinken', async () => {
  assert.equal((await api('/api/supplier/ticket/add', { text: '   ' }, werker)).status, 400, 'een lege klus');

  const mk = await api('/api/supplier/ticket/add', { text: 'Kraan lekt in de spoelkeuken', room: 'Keuken' }, werker);
  assert.equal(mk.status, 200, 'een klus melden mag het hele team: wie het ziet, meldt het');
  ticketId = mk.body.ticket.id;
  assert.equal(mk.body.ticket.status, 'open');

  const bezig = await api('/api/supplier/ticket/status', { id: ticketId, status: 'bezig' }, werker);
  assert.equal(bezig.body.ticket.status, 'bezig');
  assert.ok(bezig.body.ticket.by, 'er staat bij wie hem oppakte');

  const klaar = await api('/api/supplier/ticket/status', { id: ticketId, status: 'klaar' }, baas);
  assert.equal(klaar.body.ticket.status, 'klaar');
  assert.ok(klaar.body.ticket.doneBy && klaar.body.ticket.doneAt, 'en wie hem afrondde, met tijdstip');

  assert.equal((await api('/api/supplier/ticket/status', { id: 'bestaatniet', status: 'klaar' }, baas)).status, 404);
});

test('5. een tikfout in de status zet een afgeronde klus niet terug op de lijst', async () => {
  /* DE RECHTZETTING. Hiervoor werd elke onbekende status stilletjes 'open':
     een tikfout op een AFGERONDE klus zette hem terug op de lijst, met de
     naam van wie hem afrondde er nog onder. Elders in dit huis is de afspraak
     anders en duidelijker (kern/markt.js zetStatus: "Onbekende status.", 400),
     en die geldt nu ook hier. */
  const fout = await api('/api/supplier/ticket/status', { id: ticketId, status: 'klaar!' }, baas);
  assert.equal(fout.status, 400, 'een status die we niet kennen wordt geweigerd, niet vertaald');
  assert.match(fout.body.error, /status/i);

  const nog = await api('/api/supplier/state', {}, baas);
  const t = (nog.body.state.tickets || []).find(x => x.id === ticketId);
  assert.equal(t.status, 'klaar', 'de klus staat nog gewoon op klaar');

  // heropenen kan natuurlijk wel, met een status die bestaat
  assert.equal((await api('/api/supplier/ticket/status', { id: ticketId, status: 'open' }, baas)).body.ticket.status, 'open');
});

test('6. een gevonden voorwerp bewaren en meegeven, binnen de eigen zaak', async () => {
  assert.equal((await api('/api/supplier/lost/add', { item: '  ' }, werker)).status, 400, 'zonder omschrijving');

  const mk = await api('/api/supplier/lost/add',
    { item: 'Zwarte leren handschoen', room: 'Tafel 7', storage: 'La bij de garderobe' }, werker);
  assert.equal(mk.status, 200);
  lostId = mk.body.entry.id;
  assert.equal(mk.body.entry.status, 'bewaard');
  assert.ok(mk.body.entry.by, 'er staat bij wie hem vond');

  const buur = await api('/api/supplier/lost/add', { item: 'Sjaal van de buren' }, buurbaas);
  buurLostId = buur.body.entry.id;

  /* Weer een stille 200. Wat telt is dat het voorwerp van de buren daarna nog
     gewoon bewaard staat: anders geef je met een geraden id iets mee dat in
     een andere zaak ligt. */
  assert.equal((await api('/api/supplier/lost/done', { id: buurLostId }, baas)).status, 200);
  const bij = await api('/api/supplier/state', {}, buurbaas);
  const sjaal = (bij.body.state.lostfound || []).find(x => x.id === buurLostId);
  assert.equal(sjaal.status, 'bewaard', 'het voorwerp van de buren ligt er nog');

  assert.equal((await api('/api/supplier/lost/done', { id: lostId }, baas)).status, 200);
  const eigen = await api('/api/supplier/state', {}, baas);
  const hs = (eigen.body.state.lostfound || []).find(x => x.id === lostId);
  assert.equal(hs.status, 'opgehaald', 'het eigen voorwerp is meegegeven');
  assert.ok(hs.doneBy, 'met de naam van wie het meegaf');
});

test('7. een klus van de buren bestaat hier niet', async () => {
  const buur = await api('/api/supplier/ticket/add', { text: 'Deur klemt bij de buren' }, buurbaas);
  buurTicketId = buur.body.ticket.id;
  assert.equal((await api('/api/supplier/ticket/status', { id: buurTicketId, status: 'klaar' }, baas)).status, 404,
    'de klus van een andere zaak kennen we hier niet');

  const bij = await api('/api/supplier/state', {}, buurbaas);
  assert.equal((bij.body.state.tickets || []).find(x => x.id === buurTicketId).status, 'open',
    'en hij staat daar nog gewoon open');
});
