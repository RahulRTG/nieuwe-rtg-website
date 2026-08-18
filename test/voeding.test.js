/* De voedingslaag (kern/voeding.js). Wat hier wordt vastgezet is vooral wat er
   NIET gebeurt, want dat is de hele keuze:

   1. ER WORDT NIETS GETELD. Geen calorieen, geen macro's, geen voedingswaarde --
      een lid kan zijn voeding niet in een eerlijk getal zetten, en wie het toch
      vraagt krijgt een verzonnen cijfer dat daarna als feit door het systeem reist.
   2. ER KOMT GEEN OORDEEL. Niet over een maaltijd, en niet over of uw plan uw
      eigen allergenen bevat -- dat zou een controle beweren die er niet is.
   3. HET IS EEN PLAN EN GEEN DAGBOEK. Wat voorbij is, wordt opgeruimd; anders
      wordt het stilletjes toch een registratie van wat u at.
   Draai los: node --test test/voeding.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, lid, sup;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-voeding-'));
const dagVan = d => new Date(d).toISOString().slice(0, 10);
const overDagen = n => dagVan(new Date(Date.now() + n * 86400000));

const api = (pad, body, t) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, DEMO_SUPPLIER: 'KIKUNOI' } });
  base = srv.base;
  lid = await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tier: 'rtg' }) }).then(r => r.json()).then(d => d.token);
  sup = (await api('supplier/login', { username: 'rahul', password: 'Imran' }, '')).body.token;
  assert.ok(lid && sup);
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('een leeg plan is een week vooruit en zegt zelf dat er niets geteld wordt', async () => {
  const r = await api('voeding', {}, lid);
  assert.equal(r.status, 200);
  assert.equal(r.body.week.length, 7, 'vandaag en de zes dagen erna');
  assert.equal(r.body.week[0].op, dagVan(new Date()));
  assert.ok(r.body.week[0].vandaag);
  assert.ok(r.body.week.every(d => d.maaltijden.length === 0));
  assert.match(r.body.grens.kop, /telt uw eten niet/i);
  assert.ok(r.body.grens.wegen.some(w => /dietist/i.test(w.naam)));
  assert.match(r.body.uitleg, /plan en geen meting/i);
});

test('een maaltijd erbij: uw eigen woorden, en verder niets', async () => {
  const r = await api('voeding/zet', { wanneer: 'diner', wat: 'Pasta met spinazie',
    notitie: 'restje meenemen' }, lid);
  const m = r.body.week[0].maaltijden[0];
  assert.equal(m.wat, 'Pasta met spinazie');
  assert.equal(m.label, 'Diner', 'het moment krijgt zijn nette naam mee');
  /* Geen enkel veld dat RTG zelf heeft bedacht: geen calorieen, geen
     voedingswaarde, geen categorie, geen oordeel. */
  assert.deepEqual(Object.keys(m).sort(), ['id', 'label', 'notitie', 'op', 'wanneer', 'wat']);
  /* Scan de GEGEVENS, niet de vaste uitleg. Die zegt met opzet "een maaltijd is
     niet gezond of ongezond", en een scan over het hele antwoord slaat dan aan
     op precies de zin die de belofte doet. Datzelfde onderscheid staat in
     test/trainingsschema.test.js, en om dezelfde reden. */
  const data = JSON.stringify({ week: r.body.week, momenten: r.body.momenten });
  assert.ok(!/calorie|kcal|kilojoule|macro|eiwit|koolhydra|vetten|voedingswaarde/i.test(data),
    'nergens een voedingsgetal');
  assert.ok(!/gezond|ongezond|te veel|te weinig|score/i.test(data),
    'en nergens een oordeel over wat er staat');
  assert.match(r.body.grens.tekst, /niet gezond of ongezond/i,
    'terwijl de uitleg dat juist wel hardop zegt');
});

test('de momenten van de dag komen van de server, en op volgorde', async () => {
  await api('voeding/zet', { wanneer: 'ontbijt', wat: 'Havermout' }, lid);
  const d = (await api('voeding', {}, lid)).body;
  assert.deepEqual(d.week[0].maaltijden.map(m => m.wanneer), ['ontbijt', 'diner'],
    'ontbijt voor diner, ongeacht de volgorde van invoeren');
  assert.deepEqual(d.momenten.map(m => m.id), ['ontbijt', 'lunch', 'diner', 'tussendoor'],
    'het scherm krijgt de lijst en verzint hem niet zelf');
  assert.equal((await api('voeding/zet', { wanneer: 'middernachtsnack', wat: 'X' }, lid)).status, 400,
    'een verzonnen moment wordt geweigerd in plaats van als vrije tekst bewaard');
});

test('plannen kan voor deze week, en niet daarbuiten', async () => {
  assert.equal((await api('voeding/zet', { wanneer: 'lunch', wat: 'Soep', op: overDagen(6) }, lid)).status, 200);
  assert.equal((await api('voeding/zet', { wanneer: 'lunch', wat: 'Soep', op: overDagen(7) }, lid)).status, 400,
    'buiten het venster: een regel die het lid nooit meer terugvindt hoort er niet te komen');
  assert.equal((await api('voeding/zet', { wanneer: 'lunch', wat: 'Soep', op: overDagen(-1) }, lid)).status, 400);
  assert.equal((await api('voeding/zet', { wanneer: 'lunch', wat: '  ' }, lid)).status, 400);
});

test('uw allergenen staan erbij als geheugensteun, gelezen en niet gekopieerd', async () => {
  await api('zorgprofiel/zet', { allergenen: ['noten'], dieet: 'vegetarisch', medisch: '', delen: false }, lid);
  let d = (await api('voeding', {}, lid)).body;
  assert.deepEqual(d.allergenen, ['noten']);
  assert.equal(d.dieet, 'vegetarisch');
  assert.match(d.allergenenUitleg, /kijkt niet na/i,
    'met erbij dat RTG NIET controleert of het plan ze bevat');

  /* En het is echt gelezen: haal het uit het profiel en het staat hier ook niet
     meer. Een kopie zou een allergie tonen die het lid heeft geschrapt. */
  await api('zorgprofiel/zet', { allergenen: [], dieet: '', medisch: '', delen: false }, lid);
  d = (await api('voeding', {}, lid)).body;
  assert.deepEqual(d.allergenen, []);
});

test('RTG beoordeelt niet of uw plan uw eigen allergenen bevat', async () => {
  /* Dit is de gevaarlijkste versie van behulpzaam zijn. Een waarschuwing die
     soms komt, leest als een controle die altijd draait -- en dan vertrouwt
     iemand op een filter dat niet weet wat er in de pan ging. */
  await api('zorgprofiel/zet', { allergenen: ['noten'], dieet: '', medisch: '', delen: false }, lid);
  const r = await api('voeding/zet', { wanneer: 'tussendoor', wat: 'Handje noten' }, lid);
  assert.equal(r.status, 200, 'het wordt gewoon bewaard');
  const alles = JSON.stringify(r.body);
  assert.ok(!/let op|waarschuw|pas op|bevat noten|allergisch/i.test(alles),
    'en er komt geen waarschuwing, want die zou een controle beweren die er niet is');
});

test('wat voorbij is, verdwijnt: dit is een plan en geen eetdagboek', async () => {
  /* Via de API kan er niet in het verleden geschreven worden, dus dit gaat op de
     laag zelf met zijn eigen klok. */
  const maak = require('../server/kern/voeding');
  const db = { data: {} };
  const laag = maak({ db, save: () => {}, schoon: (s, n) => String(s || '').trim().slice(0, n),
    crypto: require('crypto') });
  const maandag = new Date('2026-05-04T09:00:00Z');
  laag.voedingZet('k', { wanneer: 'diner', wat: 'Vroeger' }, maandag);
  assert.equal(db.data.voeding.k.length, 1);

  // een week later een nieuwe regel: de oude is dan opgeruimd
  const later = new Date('2026-05-11T09:00:00Z');
  laag.voedingZet('k', { wanneer: 'diner', wat: 'Nu', op: '2026-05-11' }, later);
  assert.deepEqual(db.data.voeding.k.map(m => m.wat), ['Nu'],
    'wat voorbij is blijft niet staan; anders wordt het stilletjes een registratie');
});

test('weghalen kan, en niemand anders komt bij uw plan', async () => {
  const id = (await api('voeding', {}, lid)).body.week[0].maaltijden[0].id;
  assert.equal((await api('voeding/weg', { id }, lid)).status, 200);
  assert.equal((await api('voeding/weg', { id }, lid)).status, 404, 'en wat weg is, is weg');

  assert.equal((await api('voeding', {}, sup)).status, 401);
  assert.equal((await api('voeding/zet', { wanneer: 'lunch', wat: 'X' }, '')).status, 401);
});
