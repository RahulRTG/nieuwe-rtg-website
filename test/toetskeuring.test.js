/* De toets als meetinstrument: keuring vooraf, spiegel achteraf.

   De beloftes die hier hard worden gemaakt:

   - de keuring BOUWT NIET. Ze rekent na en verandert niets aan de toets;
   - te weinig vragen per leerdoel wordt gemeld: onder de drie is een uitslag
     toeval, en dan meet de toets dat doel niet;
   - twee leerdoelen op dezelfde vraagsoort meten hetzelfde twee keer;
   - de Fairness Engine markeert een talig zware vraag bij een ZAAKVAK en niet
     bij een taalvak, want daar is de taal het onderwerp;
   - de spiegel zegt NIETS onder de vijf gemaakte toetsen: bij zo weinig
     leerlingen is de p-waarde van de toets de uitslag van die kinderen zelf;
   - en de spiegel gaat over de toets: er komt geen leerlingsleutel of naam uit.
   Draai los: node --experimental-sqlite --test test/toetskeuring.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer, stop } = require('./helper');
const { keur, taallast, MIN_PER_DOEL } = require('../server/kern/toetsbouw');
const { spiegel, onderscheid, MINIMUM } = require('../server/kern/toetsspiegel');

let srv, base, sch, leraar, klas;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-toetskeur-'));
const fnd = (pad, body) => fetch(base + '/api/foundation' + pad, { method: 'POST',
  headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
  .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const kl = (pad, body) => fnd(pad, Object.assign({ klasCode: klas.code,
  personeelToken: leraar.personeelToken, schoolCode: sch.schoolCode }, body || {}));

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  sch = (await fnd('/school/school/maak', { naam: 'Het Kompas', plaats: 'Breda' })).body;
  const kantoor = await fetch(base + '/api/office/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'RTG-OFFICE' }) }).then(r => r.json());
  await fetch(base + '/api/office/school/decide', { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + kantoor.token },
    body: JSON.stringify({ code: sch.schoolCode, action: 'goedkeuren' }) });
  leraar = (await fnd('/school/personeel/aanmeld', { schoolCode: sch.schoolCode, naam: 'Meester Sam', rol: 'leraar' })).body;
  await fnd('/school/personeel/besluit', { schoolCode: sch.schoolCode, beheerToken: sch.beheerToken,
    personeelId: leraar.personeelId, akkoord: true });
  klas = (await fnd('/school/leraar/klas/maak', { schoolCode: sch.schoolCode, personeelToken: leraar.personeelToken,
    naam: '7A', trap: 'po', fase: 'po-g7' })).body;
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

/* ---------- de keuring, los ---------- */
test('te weinig vragen per leerdoel wordt gemeld, met wat het kost', () => {
  const doelen = [{ id: 'a', naam: 'A', vak: 'rekenen', gen: { soort: 'tafel' } }];
  const proeven = { a: [{ v: '3 x 7 =', opties: null }] };

  const krap = keur(doelen, 1, proeven, {});
  const dek = krap.opmerkingen.find(x => x.soort === 'dekking');
  assert.ok(dek, 'een toets met een vraag per doel meet dat doel niet');
  assert.match(dek.wat_nu, new RegExp('minstens ' + MIN_PER_DOEL));
  assert.equal(krap.perDoel[0].meet, 'te weinig om iets te zeggen');

  const ruim = keur(doelen, 4, proeven, {});
  assert.equal(ruim.opmerkingen.filter(x => x.soort === 'dekking').length, 0);
  assert.equal(ruim.perDoel[0].meet, 'genoeg om iets te zeggen');
  assert.match(ruim.uitleg, /keuring en geen bouwer/i, 'de keuring hoort te zeggen dat ze niets verandert');
});

test('twee leerdoelen op dezelfde vraagsoort meten hetzelfde twee keer', () => {
  const doelen = [{ id: 'a', naam: 'A', vak: 'rekenen', gen: { soort: 'tafel' } },
    { id: 'b', naam: 'B', vak: 'rekenen', gen: { soort: 'tafel' } }];
  const proeven = { a: [{ v: '3 x 7 =' }], b: [{ v: '4 x 6 =' }] };
  const r = keur(doelen, 4, proeven, {});
  const ov = r.opmerkingen.find(x => x.soort === 'overlap');
  assert.ok(ov, 'dezelfde generator twee keer hoort opgemerkt te worden');
  assert.match(ov.wat, /a, b/);

  // met verschillende generatoren niet
  const anders = keur([doelen[0], { id: 'c', naam: 'C', vak: 'rekenen', gen: { soort: 'deel' } }], 4,
    { a: [{ v: '3 x 7 =' }], c: [{ v: '42 : 7 =' }] }, {});
  assert.equal(anders.opmerkingen.filter(x => x.soort === 'overlap').length, 0);
});

test('een talig zware vraag telt bij een zaakvak en niet bij een taalvak', () => {
  const zwaar = 'In de gemeenschappelijke schoolbibliotheek staan ongeveer zeshonderd verschillende boeken. '
    + 'Daarvan wordt ongeveer een kwart uitgeleend in de wintermaanden. Hoeveel boeken zijn dat ongeveer?';
  assert.ok(taallast(zwaar, 'rekenen').some(x => x.soort === 'taalbelasting'),
    'bij rekenen meet zo n vraag vooral leesvaardigheid');
  assert.equal(taallast(zwaar, 'nederlands').filter(x => x.soort === 'taalbelasting').length, 0,
    'bij een taalvak is de taal juist het onderwerp');
  assert.equal(taallast('3 x 7 =', 'rekenen').length, 0);

  // cultuur wordt genoemd maar niet verboden, en ook bij een taalvak
  const cul = taallast('Hoeveel oliebollen blijven er over?', 'rekenen');
  assert.equal(cul.filter(x => x.soort === 'cultuur').length, 1);
  assert.match(cul.find(x => x.soort === 'cultuur').wat_nu, /precies de bedoeling/i);
  assert.equal(taallast('Schrijf een zin over carnaval.', 'nederlands').filter(x => x.soort === 'cultuur').length, 1);
});

/* ---------- de spiegel, los: hier zit de ondergrens ---------- */
test('onder de vijf gemaakte toetsen zegt de spiegel niets', () => {
  const toets = { doelen: ['a'], perDoel: 4 };
  const werk = (goed) => ({ klaar: true, goed, vragen: new Array(4), perDoel: { a: goed } });

  /* Tegen het HARDE getal vijf en niet tegen MINIMUM zelf: een toets die zijn
     eigen ondergrens importeert, zakt mee als iemand die verlaagt en kan de
     belofte dus nooit bewaken. Vijf is hier de belofte. */
  for (let n = 0; n < 5; n++) {
    const r = spiegel(toets, new Array(n).fill(0).map(() => werk(3)), {});
    assert.equal(r.genoeg, false, 'met ' + n + ' gemaakte toetsen hoort er geen oordeel te komen');
    assert.equal(r.perDoel, undefined, 'er staat toch een uitslag per doel bij');
    assert.match(r.uitleg, /uitslag van die kinderen zelf/i);
  }
  assert.equal(MINIMUM, 5, 'de ondergrens is verplaatst; is dat bewust?');
  const genoeg = spiegel(toets, new Array(5).fill(0).map(() => werk(3)), {});
  assert.equal(genoeg.genoeg, true);
  assert.equal(genoeg.perDoel.length, 1);
});

test('de spiegel gaat over de toets: geen sleutel, geen naam', () => {
  const toets = { doelen: ['a', 'b'], perDoel: 4 };
  const werken = [];
  for (let i = 0; i < 8; i++) werken.push({ klaar: true, sleutel: 'G1:p' + i, naam: 'Kind ' + i,
    goed: i, vragen: new Array(8), perDoel: { a: Math.min(4, i), b: 4 } });

  const r = spiegel(toets, werken, { a: { naam: 'Optellen', vak: 'rekenen' }, b: { naam: 'Tafels', vak: 'rekenen' } });
  assert.equal(r.genoeg, true);
  assert.doesNotMatch(JSON.stringify(r), /G1:p|Kind \d/, 'de spiegel voert terug op een leerling');
  for (const d of r.perDoel)
    assert.deepEqual(Object.keys(d).sort(), ['doel', 'goedDeel', 'let_op', 'naam', 'onderscheid', 'vak']);

  // doel b had iedereen goed: dat meet weinig, en dat staat er
  const b = r.perDoel.find(x => x.doel === 'b');
  assert.equal(b.goedDeel, 1);
  assert.ok(b.let_op.some(x => x.soort === 'te-makkelijk'));
  // en het onderscheid is nul, want iedereen scoorde er hetzelfde
  assert.equal(b.onderscheid, 0);
  // doel a loopt mee met de totaalscore: dat onderscheidt juist wel
  assert.ok(r.perDoel.find(x => x.doel === 'a').onderscheid > 0.1);
  assert.equal(onderscheid(werken.slice(0, 2), 'a', 4), null, 'onder het minimum geen getal');
});

/* ---------- en door de machine heen ---------- */
test('de keuring draait op echte opgaven uit dezelfde generator', async () => {
  const r = await kl('/school/toets/keuring', { doelen: ['rekenen.g7.procenten', 'rekenen.g7.verhoudingen'], perDoel: 2 });
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 160));
  assert.equal(r.body.aantalVragen, 4);
  assert.ok(r.body.minuten > 0, 'de verwachte tijd hoort erbij');
  assert.equal(r.body.perDoel.length, 2);
  assert.ok(r.body.opmerkingen.some(x => x.soort === 'dekking'), 'twee vragen per doel is te weinig');
  for (const p of r.body.perDoel) assert.ok(['open', 'meerkeuze', 'gemengd'].includes(p.vorm));

  // een leerdoel dat niet bestaat wordt geweigerd in plaats van overgeslagen
  assert.equal((await kl('/school/toets/keuring', { doelen: ['bestaatniet.doel'], perDoel: 3 })).status, 400);
  assert.equal((await kl('/school/toets/keuring', { doelen: [] })).status, 400);
});

test('een verse toets krijgt geen spiegel, want er is nog niets gemaakt', async () => {
  const t = (await kl('/school/toets/maak', { soort: 'so', naam: 'SO procenten',
    doelen: ['rekenen.g7.procenten'], perDoel: 3 })).body;
  const s = await kl('/school/toets/spiegel', { toetsId: t.toets.id });
  assert.equal(s.status, 200);
  assert.equal(s.body.genoeg, false);
  assert.equal(s.body.gemaakt, 0);
  assert.equal(s.body.toets.naam, 'SO procenten');
  assert.equal((await kl('/school/toets/spiegel', { toetsId: 'bestaatniet' })).status, 404);
});
