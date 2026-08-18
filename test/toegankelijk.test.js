/* Het toegankelijkheidsprofiel (kern/toegankelijk.js): hoe het scherm zich
   hoort te gedragen. Wat hier bewezen wordt: de stand blijft staan, een
   onbekende waarde valt terug op normaal in plaats van stil te blijven hangen,
   een veld dat je niet meestuurt blijft ongemoeid, en zonder eigen account is
   er niets in te stellen.
   Draai los: node --test test/toegankelijk.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, lid, persona;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-toeg-'));

const api = (pad, body, t) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const u = Date.now().toString().slice(-8);
  const reg = await api('auth/register', { name: 'Toeg Lid', email: 't' + u + '@x.nl', phone: '06' + u,
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' }, '');
  lid = reg.body.token;
  persona = await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tier: 'rtg' }) }).then(r => r.json()).then(d => d.token);
  assert.ok(lid && persona);
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('een vers lid staat op normaal, en /api/ik draagt de keuzelijst', async () => {
  const r = await api('ik/toegankelijk', {}, lid);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.toegankelijk, { tekst: 'normaal', contrast: 'normaal', beweging: 'normaal',
    links: 'normaal', eenDing: 'normaal', nadruk: 'normaal' });

  /* Het scherm bouwt de schakelaars uit deze lijst. Staat hij er niet, dan
     tekent ik.html niets en is de instelling onbereikbaar zonder dat er iets
     stukgaat -- precies de stille breuk waar dit huis voor bestaat. */
  const ik = await api('ik', {}, lid);
  assert.equal(ik.status, 200);
  const velden = ik.body.keuzes.toegankelijk;
  assert.deepEqual(Object.keys(velden).sort(),
    ['beweging', 'contrast', 'eenDing', 'links', 'nadruk', 'tekst']);
  assert.ok(velden.tekst.opties.some(o => o.id === 'groter'), 'de grootste tekstmaat staat in de lijst');
  assert.deepEqual(ik.body.toegankelijk, r.body.toegankelijk, 'beide wegen geven dezelfde stand');
});

test('zetten blijft staan, en raakt alleen het veld dat je meestuurt', async () => {
  const gezet = await api('ik/toegankelijk/zet', { tekst: 'groter', contrast: 'hoog' }, lid);
  assert.equal(gezet.status, 200);
  assert.equal(gezet.body.toegankelijk.tekst, 'groter');
  assert.equal(gezet.body.toegankelijk.contrast, 'hoog');
  assert.equal(gezet.body.staatAan, true);

  // een tweede zet raakt de eerste niet kwijt
  await api('ik/toegankelijk/zet', { beweging: 'stil' }, lid);
  const na = (await api('ik/toegankelijk', {}, lid)).body.toegankelijk;
  assert.equal(na.tekst, 'groter', 'de tekstmaat overleeft een zet op een ander veld');
  assert.equal(na.contrast, 'hoog');
  assert.equal(na.beweging, 'stil');
  assert.equal(na.links, 'normaal', 'wat niet gezet is blijft normaal');
});

test('een onbekende waarde valt terug op normaal en wordt niet bewaard', async () => {
  const r = await api('ik/toegankelijk/zet', { contrast: 'ultraviolet' }, lid);
  assert.equal(r.status, 200);
  assert.equal(r.body.toegankelijk.contrast, 'normaal',
    'een waarde die niet bestaat mag geen halve instelling worden');
  const na = (await api('ik/toegankelijk', {}, lid)).body.toegankelijk;
  assert.equal(na.contrast, 'normaal', 'en hij is ook echt zo bewaard');
  assert.equal(na.tekst, 'groter', 'de rest van het profiel blijft heel');
});

test('terugzetten naar normaal werkt echt (staatAan gaat weer uit)', async () => {
  await api('ik/toegankelijk/zet', { tekst: 'normaal', beweging: 'normaal' }, lid);
  const r = await api('ik/toegankelijk', {}, lid);
  assert.deepEqual(r.body.toegankelijk, { tekst: 'normaal', contrast: 'normaal', beweging: 'normaal',
    links: 'normaal', eenDing: 'normaal', nadruk: 'normaal' });
  const opnieuw = await api('ik/toegankelijk/zet', {}, lid);
  assert.equal(opnieuw.body.staatAan, false, 'niets aan is ook echt niets aan');
});

test('de twee nieuwe keuzes zijn gedrag en geen diagnose, en de laag maakt ze waar', async () => {
  /* Er staat met opzet geen "ADHD-modus" of "autismemodus" op dit scherm: zo'n
     knop zegt iets OVER de persoon en vraagt om een diagnose als toegangsbewijs
     tot instellingen die niemand hoeft te verdienen. Ze staan er als wat ze DOEN.
     Zie de kop van server/kern/toegankelijk.js. */
  const ik = await api('ik', {}, lid);
  const velden = ik.body.keuzes.toegankelijk;
  const namen = JSON.stringify(velden);
  assert.ok(!/adhd|autis|autism|dyslex|diagnose|stoornis/i.test(namen),
    'geen enkele schakelaar draagt de naam van een diagnose');
  assert.ok(!/energiemanagement/i.test(namen),
    'en geen "energiemanagement": RTG meet geen energie, en dat woord belooft een meting');

  const gezet = await api('ik/toegankelijk/zet', { eenDing: 'altijd', nadruk: 'rustig' }, lid);
  assert.equal(gezet.body.toegankelijk.eenDing, 'altijd');
  assert.equal(gezet.body.toegankelijk.nadruk, 'rustig');
  assert.equal(gezet.body.staatAan, true);
  assert.equal((await api('ik/toegankelijk/zet', { eenDing: 'ietsverzonnens' }, lid)).body.toegankelijk.eenDing,
    'normaal', 'een onbekende waarde valt terug op normaal en wordt niet stil bewaard');

  /* En de gedeelde laag maakt ze ook echt waar: de klassen staan in
     shared/toegankelijk.js en de opmaak in de kop van shared/basis.js. Een
     instelling zonder uitvoering is een belofte in tekst (LAT.md regel 6). */
  const fs = require('fs');
  const path = require('path');
  const lees = (...p) => fs.readFileSync(path.join(__dirname, '..', 'public', 'shared', ...p), 'utf8');
  const pas = lees('toegankelijk.js');
  assert.match(pas, /nadruk:\s*\{\s*rustig:\s*'rtg-rustig'/, 'rtg-rustig wordt gezet en weer weggehaald');
  assert.match(pas, /eenDing:\s*\{\s*altijd:\s*'rtg-eending'/);
  assert.match(lees('basis.js'), /html\.rtg-rustig\{/, 'en rtg-rustig heeft echte opmaak');
  assert.match(lees('deelmenu.js'), /rtg-eending/, 'en rtg-eending verlaagt de drempel van het deelmenu');

  await api('ik/toegankelijk/zet', { eenDing: 'normaal', nadruk: 'normaal' }, lid);
});

test('zonder eigen account valt er niets in te stellen', async () => {
  const lezen = await api('ik/toegankelijk', {}, persona);
  assert.equal(lezen.status, 403, 'een demo-persona heeft geen memberState om aan te hangen');
  const zetten = await api('ik/toegankelijk/zet', { tekst: 'groot' }, persona);
  assert.equal(zetten.status, 403);
  const zonder = await api('ik/toegankelijk', {}, '');
  assert.equal(zonder.status, 401, 'en zonder token kom je er sowieso niet in');
});
