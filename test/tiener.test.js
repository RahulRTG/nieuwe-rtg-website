/* Integratietests voor de tiener-tools: de toetsplanner (leerplan gespreid
   over de dagen, stappen afvinken, opruimen), het zakgeldpotje (boeken,
   saldo-bewaking, spaardoelen met inleg en teruggave), de gast-poort en de
   tienercoach. Draai los: node --experimental-sqlite --test test/tiener.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-tiener-'));
let child;

function fnd(pad, body) {
  return fetch(BASE + '/api/foundation' + pad, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
  });
}
function tn(actie, body, sess) {
  return fetch(BASE + '/api/rtf/tiener/' + actie, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.assign({ code: sess.code, token: sess.token }, body || {}))
  });
}
const json = r => r.json();
const overDagen = n => {
  const d = new Date(Date.now() + n * 86400000);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' }, wachtPad: '/api/foundation/health' }));
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

let teller = 0;
async function tienerSessie() {
  const t = Date.now() + '' + (teller++);
  const g = await json(await fnd('/gezin/maak', { gezinsnaam: 'Tn ' + t, naam: 'Ouder ' + t, pin: '1234' }));
  const p = await json(await fnd('/gezin/profiel/maak', { code: g.code, token: g.token, naam: 'Skater ' + t, rol: 'gezinslid', groep: 'tiener' }));
  const kies = await json(await fnd('/gezin/profiel/kies', { code: g.code, profielId: p.profiel.id }));
  return { sess: { code: g.code, token: kies.token }, g };
}

test('toetsplanner: een leerplan gespreid over de dagen, afvinken en opruimen', async () => {
  const { sess } = await tienerSessie();
  // zonder vak of met een datum in het verleden gaat het niet door
  assert.equal((await tn('toets-maak', { vak: '', datum: overDagen(3) }, sess)).status, 400);
  assert.equal((await tn('toets-maak', { vak: 'Frans', datum: overDagen(-1) }, sess)).status, 400);
  // een taal-toets over 6 dagen: het plan spreidt en eindigt de dag ervoor
  const t1 = await json(await tn('toets-maak', { vak: 'Frans', wat: 'Hoofdstuk 3, woordjes', datum: overDagen(6) }, sess));
  assert.ok(t1.ok && t1.toets.plan.length >= 4, 'meerdere leerdagen');
  assert.equal(t1.toets.plan[0].dag, overDagen(0), 'vandaag begint het');
  assert.equal(t1.toets.plan[t1.toets.plan.length - 1].dag, overDagen(5), 'de laatste leerdag is de dag voor de toets');
  assert.ok(t1.toets.plan.some(p => /overhoren/i.test(p.taak)), 'de taalroute wijst naar de Overhoren-tool');
  // morgen al een toets: dan is er gewoon een plan van vandaag
  const t2 = await json(await tn('toets-maak', { vak: 'Wiskunde', datum: overDagen(1) }, sess));
  assert.equal(t2.toets.plan.length, 1);
  assert.equal(t2.toets.plan[0].dag, overDagen(0));
  // afvinken en het overzicht (gesorteerd op datum)
  await tn('toets-stap', { id: t1.id || t1.toets.id, dag: t1.toets.plan[0].dag, af: true }, sess);
  const alle = await json(await tn('toetsen', {}, sess));
  assert.equal(alle.toetsen.length, 2);
  assert.equal(alle.toetsen[0].vak, 'Wiskunde', 'de eerstvolgende toets staat bovenaan');
  const frans = alle.toetsen.find(x => x.vak === 'Frans');
  assert.equal(frans.plan[0].af, true, 'de eerste leerstap is afgevinkt');
  // opruimen
  assert.ok((await json(await tn('toets-weg', { id: frans.id }, sess))).ok);
  assert.equal((await tn('toets-weg', { id: frans.id }, sess)).status, 404);
});

test('zakgeld: boeken met saldo-bewaking, spaardoelen met inleg en teruggave', async () => {
  const { sess } = await tienerSessie();
  // erbij en eraf; verder de min in kan niet
  await tn('boek', { centen: 1500, wat: 'Zakgeld' }, sess);
  await tn('boek', { centen: -300, wat: 'Snoep' }, sess);
  assert.equal((await tn('boek', { centen: -5000, wat: 'Te veel' }, sess)).status, 400);
  let p = await json(await tn('potje', {}, sess));
  assert.equal(p.saldoCenten, 1200);
  assert.equal(p.transacties.length, 2);
  // een spaardoel: inleggen gaat uit het vrije saldo
  const d = await json(await tn('doel-maak', { naam: 'Koptelefoon', doelCenten: 2000 }, sess));
  const doel = d.doelen[0];
  assert.equal((await tn('doel-inleg', { id: doel.id, centen: 5000 }, sess)).status, 400, 'meer dan je hebt kan niet');
  p = await json(await tn('doel-inleg', { id: doel.id, centen: 1000 }, sess));
  assert.equal(p.saldoCenten, 200, 'de inleg ging uit het vrije potje');
  assert.equal(p.doelen[0].gespaard, 1000);
  assert.equal(p.doelen[0].behaald, false);
  // bijstorten tot het doel gehaald is
  await tn('boek', { centen: 1000, wat: 'Oppassen' }, sess);
  p = await json(await tn('doel-inleg', { id: doel.id, centen: 1000 }, sess));
  assert.equal(p.doelen[0].behaald, true, 'het doel is gehaald');
  // doel weghalen: het gespaarde valt terug in het potje
  p = await json(await tn('doel-weg', { id: doel.id }, sess));
  assert.equal(p.saldoCenten, 2200);
  assert.equal(p.doelen.length, 0);
});

test('gasten blijven uit de tiener-tools', async () => {
  const { g } = await tienerSessie();
  const gast = await json(await fnd('/gezin/profiel/maak', { code: g.code, token: g.token, naam: 'Oppas', rol: 'gast', groep: 'volw' }));
  const kies = await json(await fnd('/gezin/profiel/kies', { code: g.code, profielId: gast.profiel.id }));
  const r = await tn('potje', {}, { code: g.code, token: kies.token });
  assert.equal(r.status, 403);
});

test('de tienercoach praat op ooghoogte mee (demo zonder sleutel)', async () => {
  const { sess } = await tienerSessie();
  const d = await json(await fnd('/hulp/ai', { code: sess.code, token: sess.token, kind: 'tiener', messages: [{ role: 'user', content: 'Iedereen vapet in mijn klas en ik wil er niet bij horen maar ook wel.' }] }));
  assert.ok(d.text && d.text.length > 40, 'de coach geeft een echt antwoord');
  assert.match(d.text, /Kindertelefoon/i, 'en noemt de gratis hulplijn');
});
