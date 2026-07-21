/* RTG Planners & Advies: weddings en prive-events (Aurelia), de
   professionele praktijk (LexNova) en verzekeringsadvies (Segur).
   Bewaakt de locatie-botsing per dag, de regel dat een dag pas gedraaid
   is als alle taken klaar zijn, de agenda per adviseur zonder dubbele
   afspraken, de dossierketen, en de harde verzekeringsregel: er wordt
   hier nooit een polis afgesloten, en advies komt altijd van een mens.
   Draai los: node --experimental-sqlite --test test/planners.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, wed, lex, seg, resto;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-pln-'));
const morgen = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

const api = (pad, body, t) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, t ? { Authorization: 'Bearer ' + t } : {}),
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

async function supLogin(code) {
  const roster = await api('supplier/roster', { code });
  const manager = (roster.body.staff || []).find(x => x.role === 'manager');
  return (await api('supplier/login', { code, staffId: manager.id, pin: '1234' })).body.token;
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  wed = await supLogin('AURELIA');
  lex = await supLogin('LEXNOVA');
  seg = await supLogin('SEGUR');
  resto = await supLogin('KIKUNOI');
  assert.ok(wed && lex && seg && resto, 'alle vier de zaken zijn binnen');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. weddings: een dag aannemen, en een locatie is een dag maar een keer bezet', async () => {
  const o = await api('supplier/weddings', {}, wed);
  assert.equal(o.body.naam, 'Aurelia Weddings & Events');
  assert.ok(o.body.locaties.length >= 3 && o.body.keten.length >= 5);
  const e = await api('supplier/weddings/event', { klant: 'Familie Duarte', soort: 'prive-event', datum: morgen, locatie: 'Cala Blanca (strand)', gasten: 40, budget: 12000 }, wed);
  assert.equal(e.status, 200);
  assert.equal((await api('supplier/weddings/event', { klant: 'Ander stel', soort: 'bruiloft', datum: morgen, locatie: 'Cala Blanca (strand)', gasten: 60 }, wed)).status, 409, 'het strand is die dag al vergeven');
  assert.equal((await api('supplier/weddings/event', { klant: 'X', soort: 'bruiloft', datum: morgen, locatie: 'Onbekende plek', gasten: 10 }, wed)).status, 400);
});

test('2. het draaiboek: taken over de keten, en pas gedraaid als alles klaar is', async () => {
  const o = await api('supplier/weddings', {}, wed);
  const e = o.body.events.find(x => x.klant === 'Sophie & Milan');
  assert.ok(e && e.taken.length >= 2, 'het demo-draaiboek heeft ketentaken');
  await api('supplier/weddings/event/status', { id: e.id, status: 'gepland' }, wed);
  const teVroeg = await api('supplier/weddings/event/status', { id: e.id, status: 'gedraaid' }, wed);
  assert.equal(teVroeg.status, 409, 'met open taken is de dag niet gedraaid');
  for (const t of e.taken) await api('supplier/weddings/taak/klaar', { eventId: e.id, taakId: t.id }, wed);
  const extra = await api('supplier/weddings/taak', { eventId: e.id, tekst: 'Bloemen op alle tafels.', partner: 'Galeria Lienzo (locatiekunst)' }, wed);
  assert.equal(extra.status, 200);
  await api('supplier/weddings/taak/klaar', { eventId: e.id, taakId: extra.body.taak.id }, wed);
  const klaar = await api('supplier/weddings/event/status', { id: e.id, status: 'gedraaid' }, wed);
  assert.equal(klaar.body.event.status, 'gedraaid');
});

test('3. de praktijk: een dossier openen en de status volgen', async () => {
  const o = await api('supplier/advies', {}, lex);
  assert.equal(o.body.naam, 'LexNova Advocaten & Notarissen');
  assert.equal(o.body.adviseurs.length, 3);
  assert.match(o.body.regel, /adviseur/, 'de AI plant alleen');
  const d = await api('supplier/advies/dossier', { klant: 'Vektor Capital', vak: 'fiscalist', omschrijving: 'Herstructurering deelnemingen.' }, lex);
  assert.equal(d.status, 200);
  assert.match(d.body.dossier.id, /^D-[0-9A-F]{4}$/);
  assert.equal(d.body.dossier.status, 'intake');
  assert.equal((await api('supplier/advies/dossier', { klant: 'X', vak: 'rechter', omschrijving: 'y' }, lex)).status, 400, 'alleen onze drie vakken');
});

test('4. de agenda: een adviseur zit niet met twee clienten tegelijk', async () => {
  const o = await api('supplier/advies', {}, lex);
  const dossier = o.body.dossiers[0];
  const f = await api('supplier/advies/afspraak', { adviseurId: 'a1', dossierId: dossier.id, datum: morgen, tijd: '10:00' }, lex);
  assert.equal(f.status, 200);
  assert.equal(f.body.afspraak.uurtarief, 285);
  assert.equal((await api('supplier/advies/afspraak', { adviseurId: 'a1', dossierId: dossier.id, datum: morgen, tijd: '10:00' }, lex)).status, 409);
  assert.equal((await api('supplier/advies/afspraak', { adviseurId: 'a2', dossierId: dossier.id, datum: morgen, tijd: '10:00' }, lex)).status, 200, 'de notaris kan wel');
  const na = await api('supplier/advies', {}, lex);
  assert.equal(na.body.dossiers.find(x => x.id === dossier.id).status, 'lopend', 'een afspraak zet het dossier op lopend');
});

test('5. verzekeringen: advies van een mens, en hier wordt nooit iets afgesloten', async () => {
  const o = await api('supplier/polis', {}, seg);
  assert.equal(o.body.naam, 'Segur Advies');
  assert.match(o.body.regel, /nooit iets automatisch afgesloten/);
  const v = await api('supplier/polis/vraag', { klant: 'Julia Berg', productId: 'p3', situatie: 'Drie weken Ibiza met de eigen boot.' }, seg);
  assert.equal(v.status, 200);
  assert.equal(v.body.aanvraag.status, 'aangevraagd');
  const id = v.body.aanvraag.id;
  assert.equal((await api('supplier/polis/zet', { id, status: 'afgesloten' }, seg)).status, 400, 'afsluiten bestaat hier niet');
  assert.equal((await api('supplier/polis/zet', { id, status: 'doorverwezen' }, seg)).status, 409, 'eerst het advies, dan de doorverwijzing');
  assert.equal((await api('supplier/polis/zet', { id, status: 'advies-klaar', advies: '' }, seg)).status, 400, 'zonder geschreven advies geen advies-klaar');
  const adv = await api('supplier/polis/zet', { id, status: 'advies-klaar', advies: 'Pleziervaartdekking met wintersluiting past hier; vraag de verzekeraar naar de vaargebied-clausule.' }, seg);
  assert.equal(adv.body.aanvraag.status, 'advies-klaar');
  assert.equal((await api('supplier/polis/zet', { id, status: 'doorverwezen' }, seg)).body.aanvraag.status, 'doorverwezen');
});

test('6. de poorten: zonder de juiste cap 403, zonder inlog 401', async () => {
  assert.equal((await api('supplier/weddings', {}, resto)).status, 403);
  assert.equal((await api('supplier/advies', {}, wed)).status, 403, 'de weddingplanner is geen advocaat');
  assert.equal((await api('supplier/polis', {}, lex)).status, 403, 'de advocaat is geen verzekeringsadviseur');
  assert.equal((await api('supplier/weddings')).status, 401);
  assert.equal((await api('supplier/polis')).status, 401);
});
