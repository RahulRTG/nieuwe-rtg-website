/* De Berichten-app (routes/member/berichten.js): alle gesprekken van het
   platform op een plek -- Rahul, de Berichtenbox van MijnOverheid en de
   Pulse-reacties (de vrienden-DM's en werk-chats liften op dezelfde lijst mee).
   Draai los: node --experimental-sqlite --test test/berichten.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-berichten-'));
const raw = (pad, body, token) => fetch(BASE + '/api' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
});
const json = r => r.json();

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

let teller = 0;
async function lid() {
  const t = Date.now() + '' + (teller++);
  const r = await json(await raw('/auth/register', { name: 'Lid ' + t, email: 'm' + t + '@v.test', phone: '06' + String(t).slice(-8), password: 'geheim123', geboortedatum: '1990-02-02', tier: 'rtg' }));
  return r.token;
}

test('alle bronnen komen op een plek samen: Rahul, de Berichtenbox en Pulse-reacties', async () => {
  const a = await lid(), b = await lid();
  // 1. praat met Rahul in de leden-app
  await raw('/chat/send', { text: 'Hoi Rahul, wat staat er vandaag op de planning?' }, a);
  // 2. doe een aangifte -> de Belastingdienst zet een bericht in de Berichtenbox
  await raw('/overheid/aangifte', { inkomen: 40000, ingehouden: 15000 }, a);
  // 3. plaats een Pulse-bericht en laat B erop reageren
  const p = await json(await raw('/member/pulse/post', { tekst: 'Wie is er dit weekend op het eiland?' }, a));
  await raw('/member/pulse/reactie', { id: p.post.id, tekst: 'Ik ben er, tot zondag!' }, b);

  const d = await json(await raw('/member/berichten', {}, a));
  assert.ok(d.ok && Array.isArray(d.kanalen));
  const soorten = d.kanalen.map(k => k.soort);
  assert.ok(soorten.includes('rahul'), 'het Rahul-gesprek staat erin');
  assert.ok(soorten.includes('overheid'), 'de Berichtenbox van MijnOverheid staat erin');
  assert.ok(soorten.includes('pulse'), 'de Pulse-reacties staan erin');
  // de Berichtenbox telt ongelezen mee in het totaal
  assert.ok(d.ongelezen >= 1, 'ongelezen overheidsberichten tellen mee');
  // elk kanaal draagt een deep link naar de bron-app
  for (const k of d.kanalen) assert.ok(k.link && k.link.startsWith('/apps/'), 'kanaal ' + k.soort + ' linkt naar de bron-app');
  // de lijst is op tijd gesorteerd (nieuwste eerst)
  const tijden = d.kanalen.map(k => k.at || '');
  assert.deepEqual([...tijden].sort().reverse(), tijden, 'nieuwste gesprek bovenaan');
});

test('zonder inloggen geen berichten (401)', async () => {
  assert.equal((await raw('/member/berichten', {}, null)).status, 401);
});

/* ---- de app-kant: zoeken, vlaggen en de drie AI-taken ----
   Deze toetsen leggen de BELOFTES van de app vast, want dat zijn de dingen die
   stilletjes kunnen verschuiven: dat zoeken laat zien waarom iets een treffer
   is, dat archiveren niets weggooit, dat een stilgezet gesprek niet meetelt, en
   vooral: dat de AI OPSTELT en nooit VERSTUURT. */

// twee leden die elkaars vriend zijn, met een gesprek ertussen
async function tweeMetGesprek(tekst) {
  const a = await lid(), b = await lid();
  const mijA = await json(await raw('/member/connections', {}, a));
  const mijB = await json(await raw('/member/connections', {}, b));
  await raw('/member/connect', { key: mijB.me }, a);
  await raw('/member/connect/respond', { key: mijA.me, action: 'accept' }, b);
  const g = await raw('/member/dm/send', { toKey: mijB.me, text: tekst }, a);
  return { a, b, keyB: mijB.me, gelukt: g.status === 200 };
}

test('zoeken vindt een woord terug in een prive-gesprek, met kanaal en tijdstip', async () => {
  const { a, gelukt } = await tweeMetGesprek('De sleutel ligt bij de receptie');
  assert.ok(gelukt, 'de twee leden zijn verbonden en het bericht is verstuurd');
  const z = await json(await raw('/member/berichten/zoek', { vraag: 'sleutel' }, a));
  assert.ok(z.treffers.length >= 1, 'de treffer staat erin');
  const t = z.treffers[0];
  assert.equal(t.soort, 'dm');
  assert.ok(t.tekst.toLowerCase().includes('sleutel'), 'het stukje tekst laat zien WAAROM het een treffer is');
  assert.ok(t.at, 'met een tijdstip');
});

test('een te korte zoekvraag zoekt niet (geen losse letter door alles heen)', async () => {
  const a = await lid();
  const z = await json(await raw('/member/berichten/zoek', { vraag: 'a' }, a));
  assert.deepEqual(z.treffers, []);
});

test('vastzetten, stilzetten en archiveren doen precies wat ze beloven', async () => {
  const { a, keyB, gelukt } = await tweeMetGesprek('hallo daar');
  assert.ok(gelukt);
  const id = 'dm:' + keyB;

  await raw('/member/berichten/vlag', { id, vlag: 'vast', aan: true }, a);
  let l = await json(await raw('/member/berichten', {}, a));
  assert.equal(l.kanalen[0].id, id, 'een vastgezet gesprek staat bovenaan');
  assert.equal(l.kanalen[0].vast, true);

  // archiveren haalt hem uit de lijst, maar gooit NIETS weg
  await raw('/member/berichten/vlag', { id, vlag: 'weg', aan: true }, a);
  l = await json(await raw('/member/berichten', {}, a));
  assert.ok(!l.kanalen.some(k => k.id === id), 'weg uit de gewone lijst');
  assert.equal(l.inArchief, 1, 'en geteld als gearchiveerd');
  const arch = await json(await raw('/member/berichten', { archief: true }, a));
  assert.ok(arch.kanalen.some(k => k.id === id), 'het gesprek bestaat nog gewoon');

  // terug uit het archief en stilzetten: telt niet meer mee in de teller
  await raw('/member/berichten/vlag', { id, vlag: 'weg', aan: false }, a);
  await raw('/member/berichten/vlag', { id, vlag: 'stil', aan: true }, a);
  l = await json(await raw('/member/berichten', {}, a));
  assert.equal(l.kanalen.find(k => k.id === id).stil, true);
});

test('een onbekende vlag wordt geweigerd', async () => {
  const a = await lid();
  assert.equal((await raw('/member/berichten/vlag', { id: 'dm:x', vlag: 'verwijder', aan: true }, a)).status, 400);
});

test('het gesprek zegt zelf welke bel van mij is (de client kent geen sessiesleutels)', async () => {
  const { a, keyB, gelukt } = await tweeMetGesprek('dit is van mij');
  assert.ok(gelukt);
  const d = await json(await raw('/member/dm', { withKey: keyB }, a));
  const m = d.messages[d.messages.length - 1];
  assert.equal(m.mij, true, 'mijn eigen bericht staat als van mij gemarkeerd');
});

test('zonder model: lokale samenvatting en afspraken, alleen creatief schrijven blijft dicht', async () => {
  // de testserver draait zonder AI-sleutels, dus de uitwijkketen is leeg
  const { a, keyB, gelukt } = await tweeMetGesprek('zullen we morgen om drie uur?');
  assert.ok(gelukt);
  const samen = await raw('/member/berichten/samenvatting', { id: 'dm:' + keyB }, a);
  const sb = await json(samen);
  assert.equal(samen.status, 200);
  assert.equal(sb.ok, true);
  assert.equal(sb.bron, 'lokale-taal');
  assert.match(sb.samenvatting, /morgen om drie uur/i);

  const afspraken = await raw('/member/berichten/afspraken', { id: 'dm:' + keyB }, a);
  const ab = await json(afspraken);
  assert.equal(afspraken.status, 200);
  assert.equal(ab.ok, true);
  assert.equal(ab.bron, 'lokale-taal');
  assert.ok(ab.afspraken.length >= 1);
  assert.equal(ab.afspraken[0].tijd, '', '"om drie" zonder dagdeel wordt niet stil als 03:00 of 15:00 gegokt');

  const concept = await raw('/member/berichten/concept', { id: 'dm:' + keyB }, a);
  const cb = await json(concept);
  assert.equal(concept.status, 503, 'nieuwe tekst verzinnen vraagt nog wel een model');
  assert.equal(cb.ok, false);
  assert.ok(/niet bereikbaar/i.test(cb.reden));
  assert.equal(cb.concept, undefined);
});

test('de AI stelt op maar verstuurt nooit', async () => {
  const { a, keyB, gelukt } = await tweeMetGesprek('hoi');
  assert.ok(gelukt);
  const voor = await json(await raw('/member/dm', { withKey: keyB }, a));
  await raw('/member/berichten/concept', { id: 'dm:' + keyB, wens: 'zeg dat het goed komt' }, a);
  const na = await json(await raw('/member/dm', { withKey: keyB }, a));
  assert.equal(na.messages.length, voor.messages.length,
    'na een concept staat er geen enkel bericht extra in het gesprek');
});

test('een gesprek dat niet van mij is, lees ik niet', async () => {
  const a = await lid();
  const r = await raw('/member/berichten/samenvatting', { id: 'dm:iemand-anders' }, a);
  const b = await json(r);
  assert.equal(b.ok, false, 'geen draad, dus geen samenvatting');
});
