/* De Daily Learning Guarantee: elke schooldag weet een leerling wat er te doen
   is, en die lijst is nooit leeg zolang er iets te leren valt.

   De beloftes die hier hard worden gemaakt:

   - een ingeschreven leerling met open leerdoelen krijgt ALTIJD minstens een
     stuk werk; dat is de garantie en niet een gemiddelde;
   - er staat nooit een leerdoel in waarvan de voorkennis nog open is -- dat is
     precies de opgave waar een kind op vastloopt zonder te weten waarom;
   - het plan is BEGRENSD: veertig openstaande herhalingen leveren geen lijst
     van veertig op;
   - er wordt NIETS bewaard. Geen reeks, geen "dagen achter elkaar", geen
     percentage af, geen lijst van wat niet gedaan is. Twee keer vragen levert
     hetzelfde plan en geen enkel nieuw veld in het paspoort;
   - het is een voorstel en geen opdracht, en dat staat er ook;
   - in een klas komt het huiswerk van de leraar VOORAAN.
   Draai los: node --experimental-sqlite --test test/dagplan.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer, stop } = require('./helper');
const { maakDag, kanNu } = require('../server/kern/leerstof-dag');

let srv, base, token;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-dagplan-'));
const api = (pad, body) => fetch(base + '/api' + pad, { method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const fnd = (pad, body) => fetch(base + '/api/foundation' + pad, { method: 'POST',
  headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
  .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const u = Date.now().toString().slice(-8);
  const reg = await fetch(base + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Leerling Dag', email: 'dg' + u + '@x.nl', phone: '06' + u,
      password: 'geheim123', geboortedatum: '2005-04-01', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' }) }).then(r => r.json());
  token = reg.token;
  if (!token) throw new Error('registratie mislukt: ' + JSON.stringify(reg).slice(0, 200));
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

/* ---------- de begrenzing los, met een gemaakt paspoort ---------- */
test('het plan blijft begrensd, ook met veertig openstaande herhalingen', () => {
  /* De opzet moet BEIDE bronnen vullen, anders raakt de bovengrens nooit: met
     alleen herhalingen komt het plan op drie uit en zegt de toets niets over
     het totaal. Twintig behaalde doelen (die komen terug) en twintig open
     doelen (daar ga je verder) leveren samen meer op dan er in een dag past. */
  const doelen = {}, DOELEN = {}, open = [], lijn = [];
  for (let i = 0; i < 40; i++) {
    const id = 'nep.doel-' + i;
    DOELEN[id] = { id, naam: 'Doel ' + i, vak: 'rekenen', vereist: [] };
    lijn.push(id);
    if (i < 20) { doelen[id] = { op: '2026-01-01T00:00:00.000Z' }; open.push({ doel: id }); }
  }
  const onderwijs = {
    mijn: () => ({ fase: { id: 'po-g5', naam: 'Groep 5' }, doelen }),
    herhalingen: () => ({ open, later: [] })
  };
  const { dagplan } = maakDag({ onderwijs, DOELEN, PER_GROEP: { 5: lijn }, PER_FASE: {} });
  const plan = dagplan('sleutel');
  /* Tegen het HARDE getal vijf en niet tegen MAX_STUKKEN zelf: een toets die
     zijn eigen constante importeert, groeit mee als iemand die verhoogt en kan
     dus nooit zakken. Vijf is hier de belofte, en die verhogen hoort een toets
     te laten zakken zodat iemand er nog een keer over nadenkt. */
  assert.ok(plan.stukken.length <= 5, 'een berg is geen plan: ' + plan.stukken.length);
  assert.equal(plan.stukken.length, 5, 'met werk uit twee bronnen loopt het plan tot de rand vol');
  // en beide bronnen komen erin voor: herhalen gaat voor, maar verdringt niet alles
  assert.ok(plan.stukken.some(x => x.soort === 'herhalen'));
  assert.ok(plan.stukken.some(x => x.soort === 'verder'));
});

test('een doel waarvan de voorkennis nog open staat, komt niet in het plan', () => {
  const DOELEN = {
    a: { id: 'a', naam: 'Onderste', vak: 'rekenen', vereist: [] },
    b: { id: 'b', naam: 'Bovenste', vak: 'rekenen', vereist: ['a'] }
  };
  const onderwijs = { mijn: () => ({ fase: { id: 'po-g5', naam: 'Groep 5' }, doelen: {} }),
    herhalingen: () => ({ open: [], later: [] }) };
  const { dagplan } = maakDag({ onderwijs, DOELEN, PER_GROEP: { 5: ['a', 'b'] }, PER_FASE: {} });
  const plan = dagplan('sleutel');
  assert.deepEqual(plan.stukken.map(x => x.doel), ['a'], 'alleen wat nu aan de beurt is');
  assert.equal(kanNu(DOELEN.b, {}), false);
  assert.equal(kanNu(DOELEN.b, { a: {} }), true);
});

/* ---------- en door de hele machine heen ---------- */
test('zonder fase wijst het plan naar de ladder in plaats van een lege lijst', async () => {
  const r = await api('/leerstof/dag');
  assert.equal(r.status, 200);
  assert.equal(r.body.fase, null);
  assert.match(r.body.let, /ladder/i);
  assert.match(r.body.uitleg, /voorstel/i, 'het plan zegt zelf dat het geen opdracht is');
});

test('een ingeschreven leerling krijgt altijd werk -- dat is de garantie', async () => {
  await api('/onderwijs/inschrijf', { fase: 'po-g5' });
  const r = await api('/leerstof/dag');
  assert.equal(r.status, 200);
  assert.ok(r.body.stukken.length >= 1, 'de lijst is leeg terwijl er nog van alles open staat');
  assert.equal(r.body.let, null);
  for (const s of r.body.stukken) {
    assert.ok(['herhalen', 'verder', 'huiswerk'].includes(s.soort));
    assert.ok(s.naam && s.vak && s.doel, 'elk stuk draagt zijn leerdoel');
    assert.ok(s.waarom.length > 20, 'elk stuk zegt waarom het er staat');
  }
});

test('het dagplan bewaart niets: geen reeks, geen dagen achter elkaar', async () => {
  const een = (await api('/leerstof/dag')).body;
  const twee = (await api('/leerstof/dag')).body;
  assert.deepEqual(een.stukken, twee.stukken, 'het plan wordt uitgerekend, niet bewaard');

  const pas = (await api('/onderwijs/mijn')).body;
  const alles = JSON.stringify(pas) + JSON.stringify(een);
  assert.doesNotMatch(alles, /dagplan|reeks|streak|achter elkaar|op rij|dagenAf/i,
    'er is iets dat over dagen heen telt; dat hoort hier niet te kunnen');

  /* De sterkste vorm van deze belofte staat in de module zelf: die krijgt geen
     db en geen save mee, dus er valt niets op te slaan. */
  const bron = fs.readFileSync(path.join(__dirname, '..', 'server', 'kern', 'leerstof-dag.js'), 'utf8');
  assert.doesNotMatch(bron, /\bsave\(|db\.data/, 'de dagplanner kan opeens opslaan');
});

test('in een klas komt het huiswerk van de leraar vooraan', async () => {
  const sch = (await fnd('/school/school/maak', { naam: 'De Boog', plaats: 'Assen' })).body;
  const kantoor = await fetch(base + '/api/office/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'RTG-OFFICE' }) }).then(r => r.json());
  await fetch(base + '/api/office/school/decide', { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + kantoor.token },
    body: JSON.stringify({ code: sch.schoolCode, action: 'goedkeuren' }) });
  const leraar = (await fnd('/school/personeel/aanmeld', { schoolCode: sch.schoolCode, naam: 'Meester Ties', rol: 'leraar' })).body;
  await fnd('/school/personeel/besluit', { schoolCode: sch.schoolCode, beheerToken: sch.beheerToken, personeelId: leraar.personeelId, akkoord: true });
  const klas = (await fnd('/school/leraar/klas/maak', { schoolCode: sch.schoolCode, personeelToken: leraar.personeelToken, naam: '5C', trap: 'po', fase: 'po-g5' })).body;

  const gezin = (await fnd('/gezin/maak', { gezinsnaam: 'Familie Boog', naam: 'Ouder Boog', pin: '4321' })).body;
  const kind = (await fnd('/gezin/profiel/maak', { code: gezin.code, token: gezin.token, naam: 'Loes', rol: 'kind', groep: 'kind' })).body;
  const kindToken = (await fnd('/gezin/profiel/kies', { code: gezin.code, profielId: kind.profiel.id })).body.token;
  await fnd('/school/koppel', { code: gezin.code, token: gezin.token, klasCode: klas.code, profielId: kind.profiel.id });
  await fnd('/school/uitnodiging/antwoord', { code: gezin.code, token: kindToken, klasCode: klas.code, akkoord: true });
  await fnd('/school/huiswerk/maak', { schoolCode: sch.schoolCode, personeelToken: leraar.personeelToken,
    klasCode: klas.code, titel: 'Tafels', doel: 'rekenen.g5.tafels-tot-10' });

  const plan = (await fnd('/school/dag', { code: gezin.code, token: kindToken, klasCode: klas.code })).body;
  assert.ok(plan.stukken.length >= 1);
  assert.equal(plan.stukken[0].soort, 'huiswerk', 'wat een mens vroeg gaat voor wat de motor voorstelt');
  assert.equal(plan.stukken[0].doel, 'rekenen.g5.tafels-tot-10');
  assert.match(plan.stukken[0].waarom, /Meester Ties|leraar/);
  assert.ok(plan.stukken.length <= 5);
  assert.ok(plan.stukken.some(x => x.soort === 'verder'),
    'een kind dat de school in een klas zette, ziet ook zijn leerlijn en niet alleen huiswerk');
  assert.equal(plan.fase.id, 'po-g5', 'de fase komt dan van de klas');
  // en ook hier: geen tijdsdruk die wij verzinnen
  assert.doesNotMatch(JSON.stringify(plan), /nog maar|te laat|haast|snel/i);
});
