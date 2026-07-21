/* RTG Verzorging: de beauty-salon en barbier (Velvet & Blade), petcare
   (Amics) en de kinderopvang met nanny-service (Nido). Bewaakt de agenda
   zonder dubbele stoelen, de stoel-soortregel, de walk-in rij, het pension
   met vol-is-vol, de uitlaatronde-limiet, de trimtafel, de ophaalregel
   (alleen de aangemelde ouder), de nanny-keten waarin een mens bevestigt,
   en de cap-poorten.
   Draai los: node --experimental-sqlite --test test/verzorging.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, salon, pet, opv, resto;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vz-'));
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
  salon = await supLogin('VELVET');
  pet = await supLogin('AMICS');
  opv = await supLogin('NIDO');
  resto = await supLogin('KIKUNOI');
  assert.ok(salon && pet && opv && resto, 'alle vier de zaken zijn binnen');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. de salon: de juiste stoel bij de behandeling, geen dubbele bezetting', async () => {
  const o = await api('supplier/beauty', {}, salon);
  assert.equal(o.body.naam, 'Velvet & Blade');
  assert.ok(o.body.stoelen.length >= 4 && o.body.behandelingen.length >= 5);
  const boek = await api('supplier/beauty/boek', { behandelingId: 'b1', stoelId: 's1', naam: 'Daan Kuipers', datum: morgen, tijd: '10:00' }, salon);
  assert.equal(boek.status, 200);
  assert.equal(boek.body.afspraak.tot, '10:30', 'de duur van de fade bepaalt het einde');
  assert.equal((await api('supplier/beauty/boek', { behandelingId: 'b2', stoelId: 's1', naam: 'Ander', datum: morgen, tijd: '10:15' }, salon)).status, 409, 'de stoel is dan bezet');
  assert.equal((await api('supplier/beauty/boek', { behandelingId: 'b5', stoelId: 's1', naam: 'X', datum: morgen, tijd: '12:00' }, salon)).status, 400, 'een manicure hoort niet op de barbierstoel');
  const klaar = await api('supplier/beauty/status', { id: boek.body.afspraak.id, status: 'klaar' }, salon);
  assert.equal(klaar.body.afspraak.status, 'klaar');
});

test('2. de walk-in rij: volgnummer, in de stoel, klaar en weg uit de rij', async () => {
  const w = await api('supplier/beauty/walkin', { naam: 'Julia Berg', behandelingId: 'b2' }, salon);
  assert.equal(w.status, 200);
  assert.ok(w.body.wachtend.nr >= 1);
  const pak = await api('supplier/beauty/walkin/status', { id: w.body.wachtend.id, status: 'in de stoel' }, salon);
  assert.equal(pak.body.wachtend.status, 'in de stoel');
  await api('supplier/beauty/walkin/status', { id: w.body.wachtend.id, status: 'klaar' }, salon);
  const o = await api('supplier/beauty', {}, salon);
  assert.ok(!o.body.wachtrij.find(x => x.id === w.body.wachtend.id), 'klaar betekent weg uit de rij');
});

test('3. het pension: check-in in een vrij hok, vol is vol, dieet en notities', async () => {
  const o = await api('supplier/petcare', {}, pet);
  assert.equal(o.body.naam, 'Amics Petcare');
  assert.match(o.body.verwijzing, /dierenarts/, 'medisch verwijzen we door');
  const vrij = o.body.kpi.hokkenVrij;
  const inch = await api('supplier/petcare/checkin', { dier: 'hond', naam: 'Rex', baasje: 'Fam. Kuipers', dieet: 'Alleen vis.' }, pet);
  assert.equal(inch.status, 200);
  assert.ok(inch.body.gast.hok >= 3, 'het eerste vrije hok na de demo-gasten');
  for (let i = 0; i < vrij - 1; i++) await api('supplier/petcare/checkin', { dier: 'kat', naam: 'Gast' + i, baasje: 'B' + i }, pet);
  assert.equal((await api('supplier/petcare/checkin', { dier: 'hond', naam: 'Te veel', baasje: 'X' }, pet)).status, 409, 'het pension zit vol');
  const not = await api('supplier/petcare/notitie', { id: inch.body.gast.id, tekst: 'Heeft heerlijk gespeeld.' }, pet);
  assert.equal(not.body.gast.notities[0].tekst, 'Heeft heerlijk gespeeld.');
  assert.equal((await api('supplier/petcare/checkuit', { id: inch.body.gast.id }, pet)).status, 200);
});

test('4. de uitlaatronde: maximaal zes honden en niet dubbel mee', async () => {
  const r = await api('supplier/petcare/ronde', { tijd: '15:00' }, pet);
  assert.equal(r.status, 200);
  for (let i = 0; i < 6; i++) {
    assert.equal((await api('supplier/petcare/ronde/hond', { id: r.body.ronde.id, naam: 'Hond ' + i }, pet)).status, 200);
  }
  assert.equal((await api('supplier/petcare/ronde/hond', { id: r.body.ronde.id, naam: 'Zevende' }, pet)).status, 409, 'zes is de grens');
  const klaar = await api('supplier/petcare/ronde/klaar', { id: r.body.ronde.id }, pet);
  assert.equal(klaar.body.ronde.status, 'gelopen');
  assert.equal((await api('supplier/petcare/ronde/hond', { id: r.body.ronde.id, naam: 'Laat' }, pet)).status, 409, 'een gelopen ronde is dicht');
});

test('5. de trimtafel: een tijdslot maar een keer', async () => {
  const t = await api('supplier/petcare/trim', { naam: 'Bruno', baasje: 'Fam. Vermeer', datum: morgen, tijd: '11:00' }, pet);
  assert.equal(t.status, 200);
  assert.equal((await api('supplier/petcare/trim', { naam: 'Mimi', baasje: 'Amira Sol', datum: morgen, tijd: '11:00' }, pet)).status, 409);
  assert.equal((await api('supplier/petcare/trim/klaar', { id: t.body.afspraak.id }, pet)).body.afspraak.status, 'klaar');
});

test('6. de opvang: aanmelden met capaciteit, ophalen alleen door de aangemelde ouder', async () => {
  const o = await api('supplier/opvang', {}, opv);
  assert.equal(o.body.naam, 'Nido Kinderopvang & Nanny');
  const meld = await api('supplier/opvang/kind', { groepId: 'g1', voornaam: 'Noor', ouder: 'Lotte Vermeer' }, opv);
  assert.equal(meld.status, 200);
  assert.equal((await api('supplier/opvang/kind', { groepId: 'g1', voornaam: 'noor', ouder: 'X' }, opv)).status, 409, 'niet twee keer aangemeld');
  const kindId = meld.body.kind.id;
  const fout = await api('supplier/opvang/kind/ophaal', { groepId: 'g1', kindId, ouder: 'Onbekende Oom' }, opv);
  assert.equal(fout.status, 403, 'een ander dan de aangemelde ouder haalt niet op');
  const goed = await api('supplier/opvang/kind/ophaal', { groepId: 'g1', kindId, ouder: 'lotte vermeer' }, opv);
  assert.equal(goed.status, 200);
  assert.equal(goed.body.opgehaald, 'Noor');
});

test('7. de nanny-service: een mens bevestigt, en een nanny staat niet op twee adressen', async () => {
  const a1 = await api('supplier/opvang/nanny', { gezin: 'Fam. Vermeer', datum: morgen, van: '19:00', tot: '23:00', wens: 'Twee kinderen, voorlezen.' }, opv);
  assert.equal(a1.status, 200);
  assert.equal(a1.body.aanvraag.status, 'aangevraagd', 'een aanvraag is nooit vanzelf bevestigd');
  const bev = await api('supplier/opvang/nanny/zet', { id: a1.body.aanvraag.id, status: 'bevestigd', nannyId: 'n1' }, opv);
  assert.equal(bev.body.aanvraag.nanny, 'Sofia');
  const a2 = await api('supplier/opvang/nanny', { gezin: 'Fam. Kuipers', datum: morgen, van: '20:00', tot: '22:00' }, opv);
  assert.equal((await api('supplier/opvang/nanny/zet', { id: a2.body.aanvraag.id, status: 'bevestigd', nannyId: 'n1' }, opv)).status, 409, 'Sofia is dan al geboekt');
  assert.equal((await api('supplier/opvang/nanny/zet', { id: a2.body.aanvraag.id, status: 'bevestigd', nannyId: 'n2' }, opv)).status, 200, 'Mees kan wel');
  const verslag = await api('supplier/opvang/verslag', { voornaam: 'Noor', tekst: 'Vandaag voor het eerst zelf gedronken.' }, opv);
  assert.equal(verslag.status, 200);
});

test('8. de poorten: zonder de juiste cap 403, zonder inlog 401', async () => {
  assert.equal((await api('supplier/beauty', {}, resto)).status, 403);
  assert.equal((await api('supplier/petcare', {}, salon)).status, 403, 'de salon is geen pension');
  assert.equal((await api('supplier/opvang', {}, pet)).status, 403);
  assert.equal((await api('supplier/beauty')).status, 401);
  assert.equal((await api('supplier/opvang')).status, 401);
});
