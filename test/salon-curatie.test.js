/* De Salon-curatie: het AI-oordeel over maatschappelijk belang, op een knop in
   de boardroom. Getest: de kandidaatselectie (partner- en RTG-curatie blijven
   erbuiten), de rem van maximaal BELANG_MAX posts per ronde, wat er gebeurt als
   de AI geen oordeel geeft (de heuristiek blijft gelden, er wordt niets gezet),
   dat de aanroep via de centrale AI-laag loopt (uitwijkketen, geen eigen
   modelnaam in de gate-module), en de route zelf: de boardroom-deur, de stand,
   een echte ronde tegen een nagemaakte provider en de audit-regel.
   Draai los: node --experimental-sqlite --test test/salon-curatie.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { startServer, stop } = require('./helper');

const viraal = require('../server/kern/salonviraal');
const { jaNee } = require('../server/ai-kort');

/* Een nagemaakte AI-client in de vorm die de centrale laag oplevert: alleen
   messages.create. Meer heeft salonviraal niet nodig -- dat is precies het punt. */
function nepAi(antwoord) {
  const gezien = [];
  return { gezien, messages: { async create(params) {
    gezien.push(params);
    if (antwoord === 'stuk') throw new Error('aanbieder plat');
    return { content: [{ type: 'text', text: typeof antwoord === 'function' ? antwoord(params) : antwoord }] };
  } } };
}
const post = (i, extra) => ({ id: i, author: 'A' + i, text: 'Bericht ' + i, place: 'Ibiza', ...extra });

test('1. kandidaten: partner-etalage en RTG-curatie blijven buiten het AI-oordeel', () => {
  const posts = [post(1), post(2, { partner: true }), post(3, { featured: true }), post(4, { belangrijk: false })];
  const k = viraal.belangKandidaten(posts);
  assert.deepEqual(k.map(p => p.id), [1], 'alleen de gewone post zonder oordeel is kandidaat');
});

test('2. een ronde zet p.belangrijk en telt eerlijk', async () => {
  const posts = [post(1), post(2), post(3, { partner: true })];
  const ai = nepAi(p => (/Bericht 1/.test(p.messages[0].content) ? 'ja' : 'nee'));
  const r = await viraal.beoordeelBelang(ai, posts);
  assert.deepEqual({ ...r }, { bekeken: 2, gezet: 2, belangrijk: 1, wachtend: 0 });
  assert.equal(posts[0].belangrijk, true);
  assert.equal(posts[1].belangrijk, false);
  assert.equal(posts[2].belangrijk, undefined, 'de partner-post is niet aangeraakt');
  // de aanroep gaat via de centrale laag: kort model, kort antwoord, de vraag erin
  assert.equal(ai.gezien.length, 2);
  assert.equal(ai.gezien[0].max_tokens, 8, 'een ja/nee kost geen tokens');
  assert.match(ai.gezien[0].system, /maatschappelijk belangrijk/i);
});

test('3. de rem: hoogstens BELANG_MAX posts per ronde, de rest blijft wachten', async () => {
  const posts = Array.from({ length: viraal.BELANG_MAX + 5 }, (_, i) => post(i + 1));
  const ai = nepAi('nee');
  const r = await viraal.beoordeelBelang(ai, posts);
  assert.equal(r.bekeken, viraal.BELANG_MAX, 'de ronde stopt bij de rem');
  assert.equal(r.wachtend, 5, 'de rest staat klaar voor een volgende ronde');
  assert.equal(ai.gezien.length, viraal.BELANG_MAX, 'en er gaan geen extra aanroepen uit');
});

test('4. geen AI of een stukke aanbieder: niets gezet, de heuristiek beslist', async () => {
  const zonder = [post(1)];
  assert.deepEqual({ ...(await viraal.beoordeelBelang(null, zonder)) }, { bekeken: 0, gezet: 0, belangrijk: 0, wachtend: 1 });
  assert.equal(zonder[0].belangrijk, undefined);

  const stuk = [post(1, { text: 'Inzameling voor de buurt' }), post(2, { text: 'Mooi weer vandaag' })];
  const r = await viraal.beoordeelBelang(nepAi('stuk'), stuk);
  assert.equal(r.gezet, 0, 'een storing zet geen enkel oordeel');
  assert.equal(stuk[0].belangrijk, undefined);
  // en de vaste woordencheck doet dan gewoon zijn werk
  assert.equal(viraal.isBelangrijk(stuk[0]), true, 'inzameling telt als belangrijk');
  assert.equal(viraal.isBelangrijk(stuk[1]), false);
  // een onleesbaar antwoord is ook geen oordeel
  const wazig = [post(1)];
  assert.equal((await viraal.beoordeelBelang(nepAi('misschien wel'), wazig)).gezet, 0);
  assert.equal(wazig[0].belangrijk, undefined);
});

test('5. jaNee leest ja en nee, en zwijgt bij twijfel', async () => {
  assert.equal(await jaNee(nepAi('Ja'), 's', 't'), true);
  assert.equal(await jaNee(nepAi('nee.'), 's', 't'), false);
  assert.equal(await jaNee(nepAi('yes'), 's', 't'), true);
  assert.equal(await jaNee(nepAi(''), 's', 't'), null);
  assert.equal(await jaNee(nepAi('stuk'), 's', 't'), null);
  assert.equal(await jaNee(null, 's', 't'), null, 'zonder AI geen oordeel');
});

test('6. de gate-module kiest geen aanbieder en geen model zelf', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'server', 'kern', 'salonviraal.js'), 'utf8');
  assert.ok(!/model\s*:/.test(src), 'de modelkeuze hoort in de centrale AI-laag, niet in de feed-gate');
  assert.ok(!/require\('\.\.\/(anthropic|openai|gemini)'\)/.test(src), 'geen rechtstreekse aanbieder-client');
  /* De aanroep loopt via de centrale AI-laag en niet langs een aanbieder. Sinds
     19 augustus staan daar TWEE bestanden: ../ai.js is de uitwijkketen zelf, en
     ../ai-kort.js is de gemakslaag erop (jaNee, tekst) die diezelfde keten
     gebruikt. Allebei goed; wat deze toets tegenhoudt is een module die zijn
     eigen client of eigen modelnaam pakt. */
  assert.match(src, /require\('\.\.\/ai(-kort)?'\)/,
    'de aanroep loopt via server/ai.js of server/ai-kort.js (met de uitwijkketen)');
});

/* ---------- de route: de knop in de boardroom ---------- */
let srv, base, office, nep, nepBase;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-saloncur-'));
const api = (pad, body, token) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  // een nagemaakte Claude: alles wat naar /v1/messages gaat krijgt "ja" terug
  nep = http.createServer((req, res) => {
    const brok = [];
    req.on('data', c => brok.push(c));
    req.on('end', () => {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ content: [{ type: 'text', text: 'ja' }], stop_reason: 'end_turn' }));
    });
  });
  await new Promise(r => nep.listen(0, '127.0.0.1', r));
  nepBase = 'http://127.0.0.1:' + nep.address().port;
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'KANTOOR-SALONCUR-1',
    ANTHROPIC_API_KEY: 'sk-test-nep', ANTHROPIC_BASE_URL: nepBase, AI_VOLGORDE: 'claude' } });
  base = srv.base;
  // de boardroom is de kamer van de eigenaar; zijn eigen accountlogin opent hem
  const o = await (await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' }) })).json();
  office = { token: o.token };
  assert.ok(office.token, 'de eigenaar logt in');
});
test.after(() => {
  stop(srv && srv.child);
  try { nep && nep.close(); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('7. de stand staat achter de boardroom-deur en telt op aantallen', async () => {
  const dicht = await fetch(base + '/api/office/salon/belang', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(dicht.status, 401, 'zonder inlog komt er niets langs');
  const d = await api('office/salon/belang', {}, office.token);
  assert.equal(d.status, 200);
  assert.equal(d.body.ai, true, 'de AI-sleutel is actief in deze test');
  assert.equal(d.body.max, viraal.BELANG_MAX);
  assert.ok(d.body.posts >= 1 && d.body.wachtend >= 1, 'er staan posts te wachten');
  assert.equal(d.body.ronde, Math.min(d.body.wachtend, d.body.max), 'de ronde is zo groot als de rem toestaat');
  // geen postinhoud of auteur langs deze route: alleen tellingen
  assert.deepEqual(Object.keys(d.body).filter(k => /text|author|codenaam/i.test(k)), []);
});

test('8. een ronde beoordeelt echt en het logboek onthoudt het', async () => {
  const voor = await api('office/salon/belang', {}, office.token);
  const r = await api('office/salon/belang/beoordeel', {}, office.token);
  assert.equal(r.status, 200);
  assert.ok(r.body.gezet >= 1, 'er is minstens een post beoordeeld');
  assert.equal(r.body.belangrijk, r.body.gezet, 'de nagemaakte provider zegt op alles ja');
  assert.equal(r.body.stand.beoordeeld, voor.body.beoordeeld + r.body.gezet, 'de stand loopt mee');
  assert.equal(r.body.stand.wachtend, voor.body.wachtend - r.body.gezet);
  // tweede ronde: wat al een oordeel heeft, gaat niet opnieuw langs de AI
  const twee = await api('office/salon/belang/beoordeel', {}, office.token);
  assert.equal(twee.body.gezet, r.body.stand.ronde, 'alleen de posts die nog wachtten');
  const b = await api('office/boardroom', {}, office.token);
  assert.match((b.body.audit || []).map(a => a.wat).join(' | '), /Salon-curatie/, 'de ronde staat in het logboek');
});
