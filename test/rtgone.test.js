const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, token;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-one-'));
const api = (pad, body, auth = token) => fetch(base + '/api/rtgone/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: 'Bearer ' + auth } : {}) }, body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'ONE-TEST-26' } });
  base = srv.base;
  const r = await fetch(base + '/api/office/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: 'ONE-TEST-26' }) });
  token = (await r.json()).token;
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('RTG One is dicht zonder kantooridentiteit en houdt de twee huizen gescheiden', async () => {
  assert.equal((await api('state', { huis: 'rtg' }, null)).status, 401);
  assert.equal((await api('intentie', { huis: 'rtg', titel: 'Netto reizen', waarom: 'Leden betalen transparant' })).status, 200);
  assert.equal((await api('intentie', { huis: 'rtf', titel: 'Kinderen eerst', waarom: 'Iedere keuze beschermt het kind' })).status, 200);
  const rtg = await api('state', { huis: 'rtg' }), rtf = await api('state', { huis: 'rtf' });
  assert.equal(rtg.body.intenties.length, 1); assert.equal(rtf.body.intenties.length, 1);
  assert.equal(rtg.body.intenties[0].titel, 'Netto reizen'); assert.equal(rtf.body.intenties[0].titel, 'Kinderen eerst');
  assert.equal(rtg.body.vandaag.persoonlijk, false, 'een gedeelde kantoorcode wordt eerlijk als tijdelijke toegang gemarkeerd');
});

test('Vandaag verzamelt echte open taken uit het gekozen RTF-huis', async () => {
  const m = await fetch(base + '/api/rtfkantoor/kamer/taak', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ id: 'sales', tekst: 'Controleer de nieuwe clubaanvraag' }) });
  assert.equal(m.status, 200);
  const s = await api('state', { huis: 'rtf' });
  assert.ok(s.body.vandaag.items.some(x => x.titel === 'Controleer de nieuwe clubaanvraag' && x.soort === 'rtf'));
  assert.ok(s.body.vandaag.telling.taken >= 1);
});

test('het frictiegrootboek rekent minuten en geld per jaar exact door', async () => {
  const r = await api('frictie', { huis: 'rtg', naam: 'Handmatig facturen zoeken', minuten: 12, frequentie: 5, uurloon: 45 });
  assert.equal(r.status, 200); assert.equal(r.body.frictie.jaarMinuten, 3120); assert.equal(r.body.frictie.jaarCenten, 234000);
  const s = await api('state', { huis: 'rtg' }); assert.equal(s.body.stats.frictieUren, 52); assert.equal(s.body.stats.frictieEuro, 2340);
});

test('een levende overdracht neemt open beloften van de medewerker mee', async () => {
  const b = await api('belofte', { huis: 'rtf', belofte: 'Bel de club woensdag', eigenaar: 'Noor', aan: 'FC Havenstad', deadline: '2026-08-20' });
  assert.equal(b.status, 200);
  const o = await api('overdracht', { huis: 'rtf', eigenaar: 'Noor', naar: 'Sam', geldigTot: '2026-08-30', context: 'Noor is met verlof.' });
  assert.equal(o.status, 200); assert.equal(o.body.overdracht.beloften.length, 1); assert.equal(o.body.overdracht.beloften[0].id, b.body.belofte.id);
});

test('automatisering toont de wijziging vooraf, voert uit en draait terug', async () => {
  const b = await api('belofte', { huis: 'rtg', belofte: 'Lever directierapport', eigenaar: 'Rahul' });
  const v = await api('automatisering/voorbereid', { huis: 'rtg', belofteId: b.body.belofte.id });
  assert.equal(v.status, 200); assert.deepEqual(v.body.automatisering.voor, { status: 'open' }); assert.deepEqual(v.body.automatisering.na, { status: 'afgerond' });
  const u = await api('automatisering/voer', { id: v.body.automatisering.id }); assert.equal(u.body.belofte.status, 'afgerond');
  const h = await api('automatisering/herstel', { id: v.body.automatisering.id }); assert.equal(h.body.belofte.status, 'open'); assert.equal(h.body.automatisering.status, 'teruggedraaid');
});

test('Decision Room: expertise, persoonlijke identiteit en vier ogen zijn hard afgedwongen', () => {
  const db = { data: {} }; let saves = 0;
  const crypto = require('node:crypto');
  const one = require('../server/kern/rtgone')({ db, save: () => { saves++; }, crypto }).rtgone;
  const owner = { key: 'user-1', label: 'Eigenaar', baas: true };
  const aanvrager = { key: 'user-2', label: 'Noordster', baas: false };
  const financeA = { key: 'user-3', label: 'Kasboek', baas: false };
  const financeB = { key: 'user-4', label: 'Balans', baas: false };
  assert.equal(one.rolGeef({ huis: 'rtg', key: financeA.key, naam: financeA.label, rol: 'finance' }, owner).ok, true);
  assert.equal(one.rolGeef({ huis: 'rtg', key: financeB.key, naam: financeB.label, rol: 'finance' }, owner).ok, true);
  const g = one.goedkeuringMaak({ huis: 'rtg', type: 'finance', titel: 'Nieuwe vloot', reden: 'Capaciteit veilig vergroten', bedrag: 50000, impact: 5, risico: 4, omkeerbaar: false }, aanvrager).goedkeuring;
  assert.equal(g.vereist, 2, 'hoog impactbesluit vraagt twee beoordelaars');
  assert.equal(one.goedkeuringBeslis(g.id, 'goedkeuren', aanvrager).status, 403, 'aanvrager beslist nooit eigen aanvraag');
  assert.equal(one.goedkeuringBeslis(g.id, 'goedkeuren', { key: 'user-9', label: 'Geen Finance', baas: false }).status, 403, 'verkeerde expertise blijft buiten');
  assert.equal(one.goedkeuringBeslis(g.id, 'goedkeuren', financeA).goedkeuring.status, 'wacht');
  assert.equal(one.goedkeuringBeslis(g.id, 'goedkeuren', financeB).goedkeuring.status, 'goedgekeurd');
  assert.ok(saves >= 5);
});

test('één persoonlijk RTMAIL-bericht wordt een volledige, traceerbare werkstroom', () => {
  const crypto = require('node:crypto'), db = { data: { rtmail: { berichten: [{ id: 'mail-1', naar: 'noordster@rtmail', van: 'partner@rtmail', onderwerp: 'Project Meridian', tekst: 'Graag besluit en planning voor vrijdag.', at: new Date().toISOString(), gelezen: false, gearchiveerd: false }] } } };
  const one = require('../server/kern/rtgone')({ db, save: () => {}, crypto }).rtgone;
  const context = { key: 'user-8', codename: 'Noordster', label: 'Noordster', baas: false };
  assert.equal(one.projectVanMail({ huis: 'rtg', mailId: 'mail-1', titel: 'Meridian', bedoeling: 'Vrijdag een controleerbaar besluit opleveren', deadline: '2026-08-21', goedkeuringType: 'operations', impact: 4, risico: 3, omkeerbaar: true }, {}).status, 403, 'gedeelde toegang kan persoonlijke mail niet omzetten');
  const r = one.projectVanMail({ huis: 'rtg', mailId: 'mail-1', titel: 'Meridian', bedoeling: 'Vrijdag een controleerbaar besluit opleveren', deadline: '2026-08-21', goedkeuringType: 'operations', impact: 4, risico: 3, omkeerbaar: true }, context);
  assert.equal(r.ok, true); assert.equal(r.project.bron.mailId, 'mail-1'); assert.equal(r.project.taken.length, 3); assert.ok(r.project.documenten.ruimte.includes('bedrijf=rtg')); assert.ok(r.project.goedkeuringId); assert.equal(db.data.rtmail.berichten[0].vastgezet, true);
  const first = r.project.taken[0]; const done = one.projectTaakZet(r.project.id, first.id, true, context);
  assert.equal(done.project.taken[0].af, true); assert.ok(done.project.voortgang > 12); assert.ok(done.project.tijdlijn.some(x => x.soort === 'taak'));
  assert.equal(one.projectVanMail({ huis: 'rtg', mailId: 'mail-1' }, context).status, 409, 'één bronbericht wordt nooit dubbel project');
});
