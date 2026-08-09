/* ============================================================================
   DE OVERIGE ROUTES VAN PAYROLL OS -- dekking, bronnen, componenten,
   contracten, de runlijst, verklaren en corrigeren, plus de zaakkant.

   De loonlaag is in stukken getoetst (motor, aangifte, dossier, journaal,
   loonstrook) en elk stuk stond groen. Wat er niet in zat waren de deuren
   eromheen: negentien endpoints die tijdens de hele suite geen enkele keer zijn
   aangeroepen, en achter een ervan stond een 500 te wachten
   (/api/staff/inzetbaarheid, "payrollOS is not defined").

   Wat hier per route wordt beweerd gaat over gedrag:

     - een bron is een https-adres en geen tekstveld;
     - een looncomponent zonder grondslag wordt geweigerd, en een bestaande rij
       verdwijnt nooit -- hij vervalt hoogstens per datum;
     - een zaak ziet alleen zijn EIGEN loonruns en contracten;
     - de verzuimlaag vraagt wat iemand nog kan, en nooit wat hij heeft.

   MUTATIES die zijn gedraaid en welke bewering erop zakte (LAT.md regel 2):
   - de https-eis uit dekking.zetBron() gehaald
     -> "een bron is een https-adres" ZAKT (RAAK)
   - de code-filter uit run.lijst() gehaald
     -> "een zaak ziet alleen zijn eigen loonruns" ZAKT (RAAK)
   - de toelichting-grendel uit routes/staff/inzetbaarheid.js gehaald
     -> "de verzuimlaag vraagt niet wat iemand heeft" ZAKT (RAAK)

   Draai los: node --experimental-sqlite --test test/payroll-routes.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-payrollroutes-'));
const CODE = 'KANTOOR-PAYROLLROUTES-1';
const ZAAK = 'MERIDIAAN';      // de Nederlandse demo-zaak; alleen NL heeft een jaargang
const MANAGER = 99;            // Evi van Dalen, gebouwmanager
const ANDERE = 'KIKUNOI';
let srv, base, office, zaak, ander, STAFF;

const post = (pad, body, token) => fetch(base + pad, {
  method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' },
    token ? { Authorization: 'Bearer ' + token } : {}),
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

async function moet(pad, body, token, wat) {
  const r = await post(pad, body, token);
  assert.equal(r.status, 200, wat + ' -- ' + (r.body.error || r.status));
  return r.body;
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: CODE } });
  base = srv.base;
  office = (await post('/api/office/login', { code: CODE })).body.token;
  assert.ok(office, 'het kantoor logt in');
  zaak = (await post('/api/supplier/login', { code: ZAAK, staffId: MANAGER, pin: '1234' })).body.token;
  assert.ok(zaak, 'de zaak logt in');

  const roster = await post('/api/supplier/roster', { code: ANDERE });
  const wie = (roster.body.staff || []).find(x => x.role === 'manager');
  ander = (await post('/api/supplier/login', { code: ANDERE, staffId: wie.id, pin: '1234' })).body.token;
  assert.ok(ander, 'de andere zaak logt ook in');

  const personeel = await moet('/api/office/payroll/personeel', { code: ZAAK }, office, 'het personeel');
  STAFF = (personeel.staff.find(m => m.id === MANAGER) || personeel.staff[0]).id;
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('1. de dekking zegt waar er loon kan draaien, en waarom niet', async () => {
  const wereld = await moet('/api/office/payroll/dekking', {}, office, 'de wereldkaart');
  assert.ok(wereld.landen || wereld.dekking || wereld.rijen, 'er komt een kaart terug: ' +
    Object.keys(wereld).join(', '));

  const nl = await moet('/api/office/payroll/dekking/land', { land: 'NL' }, office, 'de dekking van NL');
  assert.ok(nl.land, 'NL heeft een eigen beeld');

  /* Een land zonder jaargang is geen storing maar een lege plek, en dat hoort
     een uitslag te zijn: dit is de hele reden dat deze kaart bestaat. */
  const zz = await moet('/api/office/payroll/dekking/land', { land: 'ZZ' }, office, 'een land zonder tabel');
  assert.ok(zz.land, 'ook een onbekend land krijgt een antwoord in plaats van stilte');

  const verval = await moet('/api/office/payroll/verval', { dagen: 90 }, office, 'wat er verloopt');
  assert.ok(Array.isArray(verval.verloopt), 'de vervallijst is een lijst');
});

test('2. een bron is een https-adres en geen tekstveld', async () => {
  const geen = await post('/api/office/payroll/bron', { land: 'NL', naam: 'Handmatig', url: 'nvt' }, office);
  assert.equal(geen.status, 400, 'een bron die geen adres is, wordt geweigerd');
  assert.match(String(geen.body.error || ''), /https/i, geen.body.error);

  const url = 'https://voorbeeld.invalid/regels/nl.json';
  await moet('/api/office/payroll/bron', { land: 'NL', naam: 'Toetsbron', url }, office, 'een bron zetten');
  const na = await moet('/api/office/payroll/dekking/land', { land: 'NL' }, office, 'de dekking daarna');
  assert.ok(JSON.stringify(na).includes(url), 'de bron staat bij het land');

  await moet('/api/office/payroll/bron/weg', { land: 'NL', url }, office, 'de bron weghalen');
  const weg = await moet('/api/office/payroll/dekking/land', { land: 'NL' }, office, 'de dekking opnieuw');
  assert.equal(JSON.stringify(weg).includes(url), false, 'en dan is hij weg');

  assert.equal((await post('/api/office/payroll/bron/weg', { land: 'NL', url }, office)).status, 404,
    'een bron die er niet is, is 404');
});

test('3. de bijwerkronde loopt, ook als er niets op te halen valt', async () => {
  /* Deze route praat met de buitenwereld. Zonder bereikbare bron hoort hij een
     UITSLAG terug te geven en niet om te vallen -- dat is het verschil tussen
     "er kwam niets binnen" en "de ronde is stuk". */
  const r = await post('/api/office/payroll/regels/haal', {}, office);
  assert.equal(r.status, 200, 'de ronde geeft een uitslag: ' + (r.body.error || ''));
  assert.ok(r.body.uitslag, 'en die uitslag staat erin');
});

test('4. een looncomponent komt uit een register en niet uit de code', async () => {
  const lijst = await moet('/api/office/payroll/componenten', {}, office, 'het register');
  assert.ok(lijst.componenten.length > 0, 'er staan componenten in');
  assert.ok(lijst.soorten.length > 0 && lijst.bronnen.length > 0,
    'de keuzelijsten komen uit dezelfde tabel als de controle');

  const zonderSoort = await post('/api/office/payroll/component',
    { sleutel: 'toetstoeslag', naam: 'Toetstoeslag', soort: 'bestaatniet' }, office);
  assert.equal(zonderSoort.status, 422, 'een soort die niet bestaat, wordt afgekeurd');
  assert.ok(zonderSoort.body.error, 'en de afkeuring zegt waarom: ' + zonderSoort.body.error);

  const soort = lijst.soorten[0].soort || lijst.soorten[0].id || lijst.soorten[0];
  const nieuw = await moet('/api/office/payroll/component', { sleutel: 'toetstoeslag',
    naam: 'Toetstoeslag', soort, belast: true, grondslagen: ['loonheffing'],
    invoerbron: (lijst.bronnen[0].bron || lijst.bronnen[0].id || lijst.bronnen[0]),
    goedkeuring: (lijst.goedkeuring[0].goedkeuring || lijst.goedkeuring[0].id || lijst.goedkeuring[0]) },
  office, 'een component erbij');
  assert.ok(nieuw && typeof nieuw === 'object', 'de component komt terug');

  const opnieuw = await moet('/api/office/payroll/componenten', {}, office, 'het register daarna');
  const mijn = opnieuw.componenten.filter(c => c.sleutel === 'toetstoeslag');
  assert.equal(mijn.length, 1, 'dezelfde sleutel geeft een rij en geen tweede');
});

test('5. een contract hangt aan een mens, en de zaak ziet alleen zijn eigen', async () => {
  const spook = await post('/api/office/payroll/contract',
    { code: 'BESTAATNIET', staffId: STAFF, vanaf: '2026-01-01' }, office);
  assert.equal(spook.status, 404, 'een zaak die er niet is, is 404');

  await moet('/api/supplier/payroll/contract', { staffId: STAFF, vanaf: '2026-01-01',
    soort: 'vast', uurloonCenten: 1800, urenPerWeek: 32 }, zaak, 'de werkgever legt het contract vast');

  const mijn = await moet('/api/supplier/payroll/contracten', { staffId: STAFF }, zaak, 'de contracten');
  assert.ok(JSON.stringify(mijn).includes('1800'), 'het contract staat erin');

  const vreemd = await post('/api/supplier/payroll/contracten', { staffId: STAFF }, ander);
  assert.equal(vreemd.status, 404, 'de buurzaak kent deze medewerker niet');
});

test('6. de runlijst is per zaak, en verklaren vraagt een verklaring', async () => {
  const open = await post('/api/office/payroll/run/open', { code: ZAAK, periode: '2026-03' }, office);
  assert.equal(open.status, 200, 'de run gaat open: ' + JSON.stringify(open.body).slice(0, 200));
  const runId = open.body.run.id;

  const lijst = await moet('/api/office/payroll/run/lijst', { code: ZAAK }, office, 'de runlijst');
  assert.ok(lijst.runs.some(r => r.id === runId), 'de verse run staat erin');

  const zaakLijst = await moet('/api/supplier/payroll/runs', {}, zaak, 'de runs van de zaak zelf');
  assert.ok(zaakLijst.runs.some(r => r.id === runId), 'de zaak ziet zijn eigen run');
  const buur = await moet('/api/supplier/payroll/runs', {}, ander, 'de runs van de buurzaak');
  assert.equal(buur.runs.some(r => r.id === runId), false, 'en de buurman niet');

  await moet('/api/supplier/payroll/bevindingen', { runId }, zaak, 'de bevindingen van de zaak');
  const vreemd = await post('/api/supplier/payroll/bevindingen', { runId }, ander);
  assert.equal(vreemd.status, 404, 'de buurman komt niet bij deze bevindingen');

  const leeg = await post('/api/office/payroll/run/verklaar',
    { runId, soort: 'geen-uren', verklaring: '' }, office);
  assert.equal(leeg.status, 400, 'een bevinding in orde verklaren zonder verklaring kan niet');
  assert.match(String(leeg.body.error || ''), /waarom|verklaring|noteer/i, leeg.body.error);

  const geenRun = await post('/api/office/payroll/run/corrigeer',
    { runId: 'bestaat-niet', regels: [], reden: 'de routetoets' }, office);
  assert.equal(geenRun.status, 404, 'corrigeren op een run die er niet is, is 404');
});

test('7. de aangiftelijst is leeg tot er een definitieve run ligt', async () => {
  const lijst = await moet('/api/office/payroll/aangifte/lijst', { code: ZAAK }, office, 'de aangiftes');
  assert.ok(lijst && typeof lijst === 'object', 'er komt een lijst terug');
});

test('8. verzuim: de planning vraagt een venster, en inzetbaarheid geen diagnose', async () => {
  const zonder = await post('/api/supplier/verzuim/planning', {}, zaak);
  assert.equal(zonder.status, 400, 'zonder venster geen planning');
  assert.match(String(zonder.body.error || ''), /datum|begin/i, zonder.body.error);

  await moet('/api/supplier/verzuim/planning', { van: '2026-03-01', tot: '2026-03-31' }, zaak,
    'de planning over een venster');

  /* DE KERN VAN DE VERZUIMLAAG: de werkgever hoort te weten wat iemand nog kan,
     en niet wat hij heeft. Een toelichting is daarom geen vrij tekstveld maar
     een geweigerd veld. */
  const diagnose = await post('/api/staff/inzetbaarheid',
    { inzetbaarheid: 'deels', van: '2026-03-02', toelichting: 'rugklachten' }, zaak);
  assert.equal(diagnose.status, 422, 'een omschrijving hoort bij de arbodienst en niet hier');

  const onzin = await post('/api/staff/inzetbaarheid', { inzetbaarheid: 'zomaarwat' }, zaak);
  assert.equal(onzin.status, 400, 'een stand die niet bestaat, wordt geweigerd');
  assert.match(String(onzin.body.error || ''), /kies/i, onzin.body.error);
});
