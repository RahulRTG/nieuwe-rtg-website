/* RTG Horeca: de gastreis-toren, en de regel die hem verbouwde.

   HORECA.md grens 7: WAT NIET GEMETEN IS, WORDT NIET ALS GETAL GETOOND. Deze
   toets bestaat omdat die regel hier gebroken werd en niets het tegenhield.

   Wat er stond: elke stap droeg een vast percentage (12 / 30 / 48 / 64 / 78) dat
   uit een toestandslabel kwam. Op het scherm werd dat een ring met een
   percentage erin, en met zes tafels in beeld stond er zes keer 30%. Daarnaast
   een "course sync" van 0 tot 100, gerekend uit een spreiding in minuten via een
   verzonnen factor 8.

   Er was geen enkele toets die dat zag -- de hele journey-laag had er geen. Een
   regel in een document die nergens wordt afgedwongen, is een voornemen.

   Wat hier nu bewezen wordt:

   1. DE STAP DRAAGT GEEN PERCENTAGE. Geen enkel veld dat uit een label komt en
      als getal wordt gepresenteerd.
   2. DE BREUK IS TE TELLEN. `geserveerd` is uitgegeven-op-besteld, en die twee
      getallen kloppen met de regels op de rekening.
   3. EEN TAFEL DIE NIETS BESTELDE HEEFT GEEN NUL MAAR NIETS. 0 van 0 is geen
      voortgang, en het scherm hoort daar een streepje te tonen.
   4. DE SPREIDING STAAT IN MINUTEN, en `synchroon` volgt uit datzelfde getal en
      uit dezelfde drempel als de adviesregel ernaast.

   Draai: node --experimental-sqlite --test test/horeca-journey.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');

let BASE, child, tok;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-journey-'));
const api = (pad, body, token) => fetch(BASE + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const H = (pad, body) => api(pad, body, tok);

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const roster = (await api('/api/supplier/roster', { code: 'KIKUNOI' })).body;
  const mgr = roster.staff.find(x => x.role === 'manager') || roster.staff[0];
  tok = (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: mgr.id, pin: '1234' })).body.token;
  assert.ok(tok, 'de zaak-inlog werkt');
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

const reisVan = async (tafel) => (await H('/api/supplier/horeca/journey', {})).body.reizen.find(r => r.tafel === tafel);

test('geen enkel veld van een gastreis is een verzonnen percentage', async () => {
  const r = (await H('/api/supplier/horeca/rekening/open', { kanaal: 'tafel', tafel: 'J1', gasten: 2 })).body.rekening;
  await H('/api/supplier/horeca/rekening/regel', { rekeningId: r.id, naam: 'Oesters', prijs: 24, aantal: 1, gang: 1, station: 'koud' });
  const reis = await reisVan('J1');
  assert.ok(reis, 'de tafel staat in de toren');

  assert.equal(reis.stap.voortgang, undefined, 'de stap draagt geen percentage meer');
  for (const g of reis.gangen) assert.equal(g.syncScore, undefined, 'en een gang draagt geen sync-score');

  /* De harde vorm van dezelfde regel: geen enkel getal in een gastreis mag een
     schaal van 0 tot 100 zijn die nergens uit geteld is. Wat er wél mag staan is
     een AANTAL (regels, gasten, minuten) of een breuk met zijn noemer erbij. */
  const verdacht = [];
  (function loop(x, pad) {
    if (x && typeof x === 'object') { for (const k of Object.keys(x)) loop(x[k], pad + '.' + k); return; }
    if (typeof x === 'number' && /score|procent|percent|voortgang/i.test(pad)) verdacht.push(pad + ' = ' + x);
  })(reis, 'reis');
  assert.deepEqual(verdacht, [], 'er staat een score-achtig getal in de gastreis: ' + verdacht.join(', '));
});

test('de breuk is te tellen, en klopt met de rekening', async () => {
  const r = (await H('/api/supplier/horeca/rekening/open', { kanaal: 'tafel', tafel: 'J2', gasten: 2 })).body.rekening;
  const ids = [];
  for (const naam of ['Soep', 'Brood', 'Kaas']) {
    const g = (await H('/api/supplier/horeca/rekening/regel', { rekeningId: r.id, naam, prijs: 10, aantal: 1, gang: 1, station: 'koud' })).body.regel;
    ids.push(g.id);
  }
  await H('/api/supplier/horeca/gang/vrij', { rekeningId: r.id, gang: 1 });

  let reis = await reisVan('J2');
  assert.deepEqual(reis.geserveerd, { uitgegeven: 0, besteld: 3 });

  for (const id of ids.slice(0, 2)) {
    await H('/api/supplier/horeca/keuken/stand', { rekeningId: r.id, regelId: id, stand: 'klaar' });
    await H('/api/supplier/horeca/keuken/stand', { rekeningId: r.id, regelId: id, stand: 'uitgegeven' });
  }
  reis = await reisVan('J2');
  assert.deepEqual(reis.geserveerd, { uitgegeven: 2, besteld: 3 }, 'twee van de drie de deur uit');
  assert.equal(reis.regels, 3, 'en het aantal regels klopt met de rekening');
});

test('een tafel die niets bestelde heeft geen nul maar niets', async () => {
  await H('/api/supplier/horeca/rekening/open', { kanaal: 'tafel', tafel: 'J3', gasten: 4 });
  const reis = await reisVan('J3');
  assert.deepEqual(reis.geserveerd, { uitgegeven: 0, besteld: 0 },
    'nul van nul: het scherm hoort hier een streepje te tonen en geen 0%');
  assert.equal(reis.stap.code, 'welkom');
});

test('de spreiding staat in minuten, en synchroon volgt uit hetzelfde getal', async () => {
  const r = (await H('/api/supplier/horeca/rekening/open', { kanaal: 'tafel', tafel: 'J4', gasten: 2 })).body.rekening;
  for (const [naam, station] of [['Oesters', 'koud'], ['Ribeye', 'grill']]) {
    await H('/api/supplier/horeca/rekening/regel', { rekeningId: r.id, naam, prijs: 30, aantal: 1, gang: 1, station });
  }
  await H('/api/supplier/horeca/gang/vrij', { rekeningId: r.id, gang: 1 });
  const reis = await reisVan('J4');
  const gang = reis.gangen[0];

  assert.equal(typeof gang.spreiding, 'number', 'de spreiding is een aantal minuten');
  assert.equal(typeof gang.synchroon, 'boolean');

  /* Oesters staan op zes minuten (koud) en de ribeye op twaalf (grill), dus deze
     gang loopt vanaf de vrijgave al zes minuten uit elkaar. Dat is precies het
     getal waar een expediteur iets mee kan -- en het is na te rekenen uit de twee
     bereidingstijden, in tegenstelling tot de sync-score die hier stond. */
  assert.equal(gang.spreiding, 6, '12 min grill tegen 6 min koud is zes minuten spreiding');
  assert.equal(gang.synchroon, false, 'meer dan drie minuten uit elkaar is niet synchroon');

  /* En de drempel is er maar EEN: dezelfde die in de adviesregel staat. Het
     advies noemt datzelfde getal, zodat niemand hoeft te raden waar het vandaan
     komt. */
  assert.match(gang.advies, /6 minuten wachten/);
  assert.equal(reis.risico, 'timing', 'en de tafel staat op timing, niet op rustig');
});
