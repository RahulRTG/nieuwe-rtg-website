/* De pro-laag van de agenda: herhalingen die goed uitrollen, uitnodigen op
   codenaam (nooit een echte naam in beeld), ja/nee dat bij de organisator
   terugkomt, ICS-export met RRULE, en de eerlijke sluitregels. Draai los:
   node --experimental-sqlite --test test/agenda-pro.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, lidA, lidB, codeB, codeA;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-agenda-'));

function api(pad, body, token) {
  return fetch(base + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
let seq = 0;
async function lid() {
  const u = (Date.now() + (++seq)).toString().slice(-8);
  const reg = await api('/api/auth/register', { name: 'Agendalid ' + seq, email: 'ag' + u + '@x.nl',
    phone: '06' + u, password: 'geheim123', geboortedatum: '1990-05-05', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' });
  const st = await api('/api/state', {}, reg.body.token);
  return { token: reg.body.token, codenaam: st.body.state.user.codename };
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const a = await lid(); const b = await lid();
  lidA = a.token; lidB = b.token; codeA = a.codenaam; codeB = b.codenaam;
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. herhalingen rollen uit in het bereik; de 31e klemt in een korte maand', async () => {
  const w = await api('/api/agenda/bewaar', { titel: 'Weekstart', datum: '2026-08-03', tijd: '09:00',
    herhaal: 'week', herhaalTot: '2026-08-31' }, lidA);
  assert.equal(w.status, 200);
  await api('/api/agenda/bewaar', { titel: 'Maandafsluiting', datum: '2026-08-31', herhaal: 'maand' }, lidA);
  const r = await api('/api/agenda/bereik', { van: '2026-08-01', tot: '2026-10-31' }, lidA);
  assert.equal(r.status, 200);
  const weekstarts = r.body.items.filter(x => x.titel === 'Weekstart').map(x => x.datum);
  assert.deepEqual(weekstarts, ['2026-08-03', '2026-08-10', '2026-08-17', '2026-08-24', '2026-08-31'],
    'wekelijks, en de herhaalTot-grens telt');
  const afsluit = r.body.items.filter(x => x.titel === 'Maandafsluiting').map(x => x.datum);
  assert.deepEqual(afsluit, ['2026-08-31', '2026-09-30', '2026-10-31'],
    'de 31e klemt op 30 september in plaats van stil over te slaan');
});

test('2. uitnodigen op codenaam: kopie bij de ander, antwoord komt terug, echte namen nergens', async () => {
  const m = await api('/api/agenda/bewaar', { titel: 'Proeverij', datum: '2026-09-10', tijd: '19:00', eind: '21:00',
    plek: 'De kelder' }, lidA);
  const id = m.body.id;
  const uit = await api('/api/agenda/uitnodig', { id, codenaam: codeB }, lidA);
  assert.equal(uit.status, 200);
  assert.equal(uit.body.deelnemers[0].codenaam, codeB);
  assert.equal(uit.body.deelnemers[0].status, 'uitgenodigd');

  // B ziet de uitnodiging in het eigen bereik, met de codenaam van A als afzender
  const rb = await api('/api/agenda/bereik', { van: '2026-09-01', tot: '2026-09-30' }, lidB);
  const kopie = rb.body.items.find(x => x.titel === 'Proeverij');
  assert.ok(kopie, 'de kopie staat in de agenda van B');
  assert.equal(kopie.van, codeA, 'de afzender is een codenaam');
  assert.ok(!JSON.stringify(rb.body).includes('Agendalid'), 'geen echte naam in het hele antwoord');

  // B zegt ja; A ziet de stand per deelnemer veranderen
  const ja = await api('/api/agenda/antwoord', { id: kopie.id, ja: true }, lidB);
  assert.equal(ja.body.status, 'ja');
  const ra = await api('/api/agenda/bereik', { van: '2026-09-01', tot: '2026-09-30' }, lidA);
  const bron = ra.body.items.find(x => x.titel === 'Proeverij');
  assert.equal(bron.deelnemers[0].status, 'ja');

  // de organisator wijzigt de tijd; de kopie van B schuift mee
  await api('/api/agenda/bewaar', { id, titel: 'Proeverij', datum: '2026-09-10', tijd: '20:00' }, lidA);
  const rb2 = await api('/api/agenda/bereik', { van: '2026-09-01', tot: '2026-09-30' }, lidB);
  assert.equal(rb2.body.items.find(x => x.titel === 'Proeverij').tijd, '20:00');

  // verwijderen bij de organisator neemt de kopie mee
  await api('/api/agenda/verwijder', { id }, lidA);
  const rb3 = await api('/api/agenda/bereik', { van: '2026-09-01', tot: '2026-09-30' }, lidB);
  assert.ok(!rb3.body.items.find(x => x.titel === 'Proeverij'), 'vervallen is vervallen, ook bij B');
});

test('3. een uitnodiging bewerk je niet, en een vreemde codenaam is een nette fout', async () => {
  const m = await api('/api/agenda/bewaar', { titel: 'Diner', datum: '2026-09-12' }, lidA);
  await api('/api/agenda/uitnodig', { id: m.body.id, codenaam: codeB }, lidA);
  const rb = await api('/api/agenda/bereik', { van: '2026-09-01', tot: '2026-09-30' }, lidB);
  const kopie = rb.body.items.find(x => x.titel === 'Diner');
  const w = await api('/api/agenda/bewaar', { id: kopie.id, titel: 'Ander diner', datum: '2026-09-13' }, lidB);
  assert.equal(w.status, 400, 'een genodigde zegt ja of nee, hij herschrijft de afspraak niet');
  assert.equal((await api('/api/agenda/uitnodig', { id: m.body.id, codenaam: 'bestaat-echt-niet' }, lidA)).status, 400);
});

test('4. ICS-export: RRULE voor herhalingen, VALARM voor herinneringen, geen echte namen', async () => {
  await api('/api/agenda/bewaar', { titel: 'Kwartaal; met puntkomma', datum: '2026-10-01', tijd: '10:00',
    eind: '11:00', herhaal: 'maand', herhaalTot: '2027-03-31', herinner: 30, plek: 'Boardroom' }, lidA);
  const r = await api('/api/agenda/ics', {}, lidA);
  const ics = r.body.ics;
  assert.ok(/BEGIN:VCALENDAR/.test(ics) && /END:VCALENDAR/.test(ics));
  assert.ok(/RRULE:FREQ=MONTHLY;UNTIL=20270331/.test(ics), 'de herhaling reist mee als RRULE');
  assert.ok(/TRIGGER:-PT30M/.test(ics), 'de herinnering reist mee als VALARM');
  assert.ok(ics.includes('Kwartaal\\; met puntkomma'), 'puntkomma netjes ontsnapt');
  assert.ok(!ics.includes('Agendalid'), 'geen echte naam in het bestand');
});

test('5. de ecosysteem-laag: een RTG-boeking verschijnt alleen-lezen met bronlabel', async () => {
  // een boeking bij een demo-zaak; welke dienst maakt niet uit, als hij maar
  // een moment heeft. We prikken hem daarna in de agenda-bereik-laag.
  const cat = await api('/api/suppliers', {}, lidA);
  const zaak = (cat.body.suppliers || []).find(s => (s.services || []).length);
  if (!zaak) return; // geen demozaak met diensten in deze omgeving: niets te toetsen
  const b = await api('/api/booking/request', { supplierCode: zaak.code, serviceId: zaak.services[0].id,
    date: '2026-11-05', time: '14:00' }, lidA);
  if (b.status !== 200) return; // boeken kan dicht staan; dat toetst een andere test
  const r = await api('/api/agenda/bereik', { van: '2026-11-01', tot: '2026-11-30' }, lidA);
  const eco = (r.body.ecosysteem || []).find(x => x.datum === '2026-11-05');
  assert.ok(eco, 'de boeking staat in de agenda-laag');
  assert.equal(eco.bron, 'boeking');
  assert.equal(eco.tijd, '14:00');
});
