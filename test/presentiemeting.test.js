/* De presentiebelofte: een les staat binnen dertig seconden.

   Wat hier hard wordt gemaakt:

   - het scherm is UITZONDERINGSGESTUURD: iedereen staat op aanwezig en de
     leraar wijzigt alleen wie er niet is. Zonder die keuze is dertig seconden
     onhaalbaar en is de belofte een wens;
   - het aantal handelingen klopt met dat ontwerp, en de te-laat-minuten tellen
     mee (anders meet je een makkelijkere klas dan er is);
   - de SERVER is echt gemeten: een volle klas van dertig wordt weggeschreven
     ruim binnen zijn deel van het budget;
   - en er staat bij wat NIET gemeten is: er is nooit een leraar mee geklokt.
   Draai los: node --experimental-sqlite --test test/presentiemeting.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer, stop } = require('./helper');
const { BUDGET_SECONDEN, handelingen, metMinuten, ongemeten } = require('../server/kern/presentielast');

/* De server krijgt een klein deel van de dertig seconden. Niet omdat dat mooi
   uitkomt maar omdat het de bedoeling is: de tijd hoort naar het overzien van
   de klas te gaan, niet naar wachten op een scherm. */
const SERVER_BUDGET_MS = 1500;
const KLAS = 30;

let srv, base, sch, leraar, klasCode;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-presentie-'));
const fnd = (pad, body) => fetch(base + '/api/foundation' + pad, { method: 'POST',
  headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
  .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const bh = (pad, body) => fnd(pad, Object.assign({ schoolCode: sch.schoolCode, beheerToken: sch.beheerToken }, body || {}));

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  sch = (await fnd('/school/school/maak', { naam: 'De Vonk', plaats: 'Zutphen' })).body;
  const kantoor = await fetch(base + '/api/office/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'RTG-OFFICE' }) }).then(r => r.json());
  await fetch(base + '/api/office/school/decide', { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + kantoor.token },
    body: JSON.stringify({ code: sch.schoolCode, action: 'goedkeuren' }) });
  /* Een klas wordt door een LERAAR gemaakt, niet door het beheer -- dus die
     hoort er ook bij in een meting van wat een leraar doet. */
  leraar = (await fnd('/school/personeel/aanmeld', { schoolCode: sch.schoolCode, naam: 'Juf Wilma', rol: 'leraar' })).body;
  await bh('/school/personeel/besluit', { personeelId: leraar.personeelId, akkoord: true });
  klasCode = (await fnd('/school/leraar/klas/maak', { schoolCode: sch.schoolCode,
    personeelToken: leraar.personeelToken, naam: 'Groep 8' })).body.code;
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('het scherm zet iedereen op aanwezig, zodat een leraar alleen uitzonderingen wijzigt', () => {
  const bron = fs.readFileSync(path.join(__dirname, '..', 'public', 'apps', 'schoolpartner', 'presentie.js'), 'utf8');
  const standen = bron.match(/var STANDEN = \[\[\s*'([a-z]+)'/);
  assert.ok(standen, 'de standenlijst van het presentiescherm is niet te vinden');
  /* De eerste stand is wat de browser kiest als er niets is geselecteerd. Staat
     daar iets anders dan `aanwezig`, dan begint elke les met dertig fouten. */
  assert.equal(standen[1], 'aanwezig',
    'de eerste stand is niet aanwezig; dan staat elke leerling standaard verkeerd');
  assert.doesNotMatch(bron, /<option value="[a-z]+" selected/,
    'er staat een andere stand voorgeselecteerd dan de eerste');
  /* En de weg terug: een knop die de hele klas in een keer goedzet. */
  assert.match(bron, /Iedereen aanwezig/, 'de knop om de klas in een keer goed te zetten is weg');
});

test('het aantal handelingen volgt uit die keuze, en te laat telt mee', () => {
  const gewoon = handelingen(KLAS, 2);
  assert.equal(gewoon.handelingen, 3, 'twee afwezigen plus de knop');
  assert.equal(gewoon.zonderStandaard, KLAS + 1,
    'zonder de standaardstand zou elke leerling een handeling zijn');
  assert.equal(gewoon.bespaard, 28);

  /* Wie te laat is, krijgt er minuten bij: een tweede handeling voor dat kind.
     Tel je die niet mee, dan meet je een makkelijkere klas dan er is. */
  assert.equal(metMinuten(KLAS, 2, 1).handelingen, 4);
  assert.equal(metMinuten(KLAS, 2, 2).handelingen, 5);

  /* Randen: meer uitzonderingen dan leerlingen bestaat niet, en onzin telt
     als nul in plaats van een lijst kapot te maken. */
  assert.equal(handelingen(KLAS, 99).uitzonderingen, KLAS);
  assert.equal(handelingen(0, 0).handelingen, 1);
  assert.equal(handelingen('x', null).handelingen, 1);
  assert.equal(metMinuten(KLAS, 1, 5).telaat, 1, 'meer te laat dan uitzonderingen kan niet');
});

test('de server schrijft een volle klas ruim binnen zijn deel van het budget weg', async () => {
  assert.ok(klasCode, 'de klas is niet aangemaakt');
  for (let i = 0; i < KLAS; i++) {
    const l = (await bh('/school/leerling/aanmeld', { naam: 'Kind ' + i, geboren: '2015-01-0' + (i % 9 + 1) })).body;
    await bh('/school/leerling/besluit', { leerlingId: l.leerling.id, besluit: 'plaatsen', klasCode });
  }
  const klas = (await fnd('/school/klas', { klasCode, personeelToken: leraar.personeelToken,
    schoolCode: sch.schoolCode })).body;
  const sleutels = ((klas.klas && klas.klas.leerlingen) || klas.leerlingen || []).map(x => x.sleutel);
  assert.equal(sleutels.length, KLAS, 'de klas is niet vol geworden: ' + sleutels.length);

  /* Twee afwezigen, een te laat -- een gewone maandagochtend. */
  const regels = sleutels.map((s, i) => ({ leerling: s,
    stand: i === 0 ? 'afwezig' : i === 1 ? 'ziek' : i === 2 ? 'telaat' : 'aanwezig',
    minuten: i === 2 ? 10 : 0 }));

  const start = process.hrtime.bigint();
  const r = await bh('/school/aanwezigheid/zet', { klasCode, uur: 1, vak: 'rekenen', regels });
  const ms = Number(process.hrtime.bigint() - start) / 1e6;

  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 160));
  assert.equal(r.body.telling.aanwezig, KLAS - 3);
  assert.ok(ms < SERVER_BUDGET_MS,
    'de server deed er ' + Math.round(ms) + ' ms over en het budget is ' + SERVER_BUDGET_MS + ' ms');
  /* De meting hoort zichtbaar te zijn, ook als hij ruim gehaald wordt. */
  console.log('        presentie van ' + KLAS + ' leerlingen weggeschreven in ' + Math.round(ms) + ' ms'
    + ' (budget ' + SERVER_BUDGET_MS + ' ms van de ' + BUDGET_SECONDEN + ' seconden)');
});

test('de belofte in SCHOOL.md zegt wat er gemeten is en wat niet', () => {
  const school = fs.readFileSync(path.join(__dirname, '..', 'SCHOOL.md'), 'utf8');
  const rij = school.split('\n').find(r => r.includes('Presentie van een les staat binnen'));
  assert.ok(rij, 'de presentiebelofte staat niet meer in SCHOOL.md');
  assert.ok(rij.includes(String(BUDGET_SECONDEN)), 'de rij noemt het budget niet');
  /* HET PUNT. Server en handelingen zijn gemeten; de mens niet. Een rij die
     alleen "ja" zegt, belooft iets wat niemand heeft geklokt. */
  assert.match(rij, /ongemeten|nooit een leraar|niet geklokt/i,
    'de rij doet alsof de dertig seconden zijn gehaald terwijl alleen de server en de handelingen zijn gemeten');
  assert.match(ongemeten, /geklokt/i);
});
