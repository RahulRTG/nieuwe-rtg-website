/* Integratietest: Rahul als spelmaatje. In elk potje kun je Rahul erbij roepen
   voor een hint, een regel of een peptalk. Zonder AI-sleutel (zoals in de test)
   geeft hij een vaste, uitlegbare tip -- en alleen wie in het potje zit mag hem
   aanroepen. Draai los: node --experimental-sqlite --test test/spelmaatje.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-spelmaatje-'));
let child;

const fnd = (pad, body) => fetch(BASE + '/api/foundation' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
});
const rtfSpel = (actie, body, sess) => fetch(BASE + '/api/rtf/spel/' + actie, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(Object.assign({ code: sess.code, token: sess.token }, body || {}))
});
const json = r => r.json();

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

// twee volwassen gezinsprofielen die via de random wachtrij een potje dammen starten
async function potjeDammen() {
  const t = Date.now();
  const g = await json(await fnd('/gezin/maak', { gezinsnaam: 'Maatje ' + t, naam: 'Ouder ' + t, pin: '1234', groep: 'volw' }));
  const oom = await json(await fnd('/gezin/profiel/maak', { code: g.code, token: g.token, naam: 'Oom ' + t, rol: 'gezinslid', groep: 'volw' }));
  const kies = await json(await fnd('/gezin/profiel/kies', { code: g.code, profielId: oom.profiel.id }));
  const A = { code: g.code, token: g.token };
  const B = { code: g.code, token: kies.token };
  await rtfSpel('random', { soort: 'dam', grootte: 2 }, A);
  const tweede = await json(await rtfSpel('random', { soort: 'dam', grootte: 2 }, B));
  assert.ok(tweede.id, 'de tweede speler start het potje');
  return { A, B, id: tweede.id };
}

test('Rahul geeft een hint bij een leeg vraagje (demo-tip zonder sleutel)', async () => {
  const { B, id } = await potjeDammen();
  const r = await json(await rtfSpel('rahul', { id, vraag: '' }, B));
  assert.ok(r.ok && typeof r.antwoord === 'string' && r.antwoord.length > 5, 'er komt een bruikbare tip terug');
  assert.equal(r.demo, true, 'zonder sleutel is het de vaste tip');
  assert.ok(/aan zet|klaar|beginnen/i.test(r.stand || ''), 'de stand reist mee');
});

test('Rahul beantwoordt een vraag over het potje', async () => {
  const { A, id } = await potjeDammen();
  const r = await json(await rtfSpel('rahul', { id, vraag: 'Wat is een goede openingszet?' }, A));
  assert.ok(r.ok && r.antwoord && r.antwoord.length > 5);
});

test('alleen een speler uit het potje mag Rahul aanroepen', async () => {
  const { id } = await potjeDammen();
  // een vreemde in een ander gezin kent dit potje niet
  const t = Date.now() + 1;
  const g2 = await json(await fnd('/gezin/maak', { gezinsnaam: 'Vreemd ' + t, naam: 'Ander ' + t, pin: '4321', groep: 'volw' }));
  const vreemd = { code: g2.code, token: g2.token };
  assert.equal((await rtfSpel('rahul', { id, vraag: 'hoi' }, vreemd)).status, 404);
  // een onbekend potje-id kan ook niet
  assert.equal((await rtfSpel('rahul', { id: 'bestaatniet', vraag: 'hoi' }, vreemd)).status, 404);
});

test('de spelmaatje-kennis dekt elk spel dat er is', () => {
  // borging tegen drift: elke spelsoort heeft uitleg + tips voor Rahul
  const spellen = require('../server/kern/spellen')({
    db: { data: {} }, save: () => {}, crypto: require('crypto'),
    zijnVrienden: () => false, codenaamVan: h => h, sseToCustomer: () => {},
    isGeblokkeerd: () => false, socialZoek: async () => [], sociaalRate: () => true, volwassen: () => true, anthropic: null
  });
  const KENNIS = require('../server/kern/spellen/rahul')({ S: () => ({}), SOORTEN: {}, codenaamVan: h => h, anthropic: null })._KENNIS;
  for (const soort of Object.keys(spellen.SPEL_SOORTEN)) {
    assert.ok(KENNIS[soort] && KENNIS[soort].uitleg && KENNIS[soort].tips.length >= 1, 'Rahul kent ' + soort);
  }
});
