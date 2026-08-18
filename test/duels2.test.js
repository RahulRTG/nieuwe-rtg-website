/* Integratietests voor de tweede duelronde: het Geheugenduel van De Arena
   (vijf reeksen, 4 tot en met 8 lang, foutloos natikken) en het
   Rangschikduel van De Societeit (vier dingen in de enige juiste volgorde;
   de waarheid blijft in de bank). Overal alleen codenamen.
   Draai los: node --test test/duels2.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-duels2-'));
let child;
const ECHT = 'Duelstest';

function fnd(pad, body) {
  return fetch(BASE + '/api/foundation' + pad, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
  });
}
function spel(actie, body, sess) {
  return fetch(BASE + '/api/rtf/spel/' + actie, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.assign({ code: sess.code, token: sess.token }, body || {}))
  });
}
const json = r => r.json();

let A, B, aCn, bCn;
async function jong(gezinsnaam, naam) {
  const g = await json(await fnd('/gezin/maak', { gezinsnaam, naam: 'Hoofd ' + naam, pin: '1234' }));
  const p = await json(await fnd('/gezin/profiel/maak', { code: g.code, token: g.token, naam, rol: 'gezinslid', groep: 'jong' }));
  const kies = await json(await fnd('/gezin/profiel/kies', { code: g.code, profielId: p.profiel.id }));
  return { code: g.code, token: kies.token, codenaam: kies.profiel.codenaam };
}
test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' }, wachtPad: '/api/foundation/health' }));
  A = await jong(ECHT + ' Huis A', 'Duel Aa ' + ECHT);
  B = await jong(ECHT + ' Huis B', 'Duel Bo ' + ECHT);
  aCn = A.codenaam; bCn = B.codenaam;
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('geheugenduel: reeksen groeien van 4 naar 8 en foutloos telt', async () => {
  const nieuw = await json(await spel('nieuw', { soort: 'geheugen', grootte: 2, codenamen: [bCn] }, A));
  await spel('antwoord', { id: nieuw.id, akkoord: true }, B);
  for (let i = 0; i < 5; i++) {
    const st = await json(await spel('staat', { id: nieuw.id }, A));
    const reeks = st.potje.staat.reeks;
    assert.equal(reeks.length, 4 + i, 'ronde ' + (i + 1) + ' heeft lengte ' + (4 + i));
    assert.ok(reeks.every(k => k >= 0 && k <= 3), 'vier vakken');
    const zA = await json(await spel('zet', { id: nieuw.id, zet: { actie: 'reeks', r: reeks } }, A));
    assert.equal(zA.goedWas, true, 'A tikt de reeks foutloos na');
    const zB = await json(await spel('zet', { id: nieuw.id, zet: { actie: 'reeks', r: [9] } }, B));
    assert.equal(zB.goedWas, false);
    assert.deepEqual(zB.juistR, reeks, 'de onthulling toont dezelfde reeks voor iedereen');
  }
  const klaar = await json(await spel('staat', { id: nieuw.id }, A));
  assert.equal(klaar.potje.status, 'klaar');
  assert.equal(klaar.potje.winnaar, aCn);
  assert.deepEqual(klaar.potje.staat.stand.map(s => s.punten), [5, 0]);
  assert.ok(!JSON.stringify(klaar).includes(ECHT), 'alleen codenamen in het potje');
});

test('rangschikduel: alleen de enige juiste volgorde pakt het punt', async () => {
  const nieuw = await json(await spel('nieuw', { soort: 'orde', grootte: 2, codenamen: [bCn] }, A));
  await spel('antwoord', { id: nieuw.id, akkoord: true }, B);
  for (let i = 0; i < 5; i++) {
    const stA = await json(await spel('staat', { id: nieuw.id }, A));
    assert.equal(stA.potje.staat.items.length, 4, 'vier dingen, geschud en zonder waarden');
    // A legt de getoonde volgorde vast (vrijwel zeker fout) en krijgt de
    // onthulling; B leest zijn EIGEN geschudde lijst en gebruikt de
    // onthulling -- die komt pas NADAT A al vastligt
    const zA = await json(await spel('zet', { id: nieuw.id, zet: { actie: 'orde', volgorde: [0, 1, 2, 3] } }, A));
    assert.equal(zA.juist.length, 4, 'de onthulling toont de juiste volgorde met waarden');
    const stB = await json(await spel('staat', { id: nieuw.id }, B));
    const volgorde = zA.juist.map(j => stB.potje.staat.items.indexOf(j.replace(/ \([^)]*\)$/, '')));
    const zB = await json(await spel('zet', { id: nieuw.id, zet: { actie: 'orde', volgorde } }, B));
    assert.equal(zB.goedWas, true, 'de juiste volgorde telt (ronde ' + (i + 1) + ')');
  }
  const klaar = await json(await spel('staat', { id: nieuw.id }, B));
  assert.equal(klaar.potje.status, 'klaar');
  const stand = klaar.potje.staat.stand;
  assert.equal(stand[1].punten, 5, 'B had elke ronde de enige juiste volgorde');
  if (stand[0].punten === 5) assert.ok(klaar.potje.gelijk || klaar.potje.winnaar === aCn, 'bij 5-5 valt het op wie eerst klaar was');
  else assert.equal(klaar.potje.winnaar, bCn);
  // nog een zet na het einde kan niet
  assert.equal((await spel('zet', { id: nieuw.id, zet: { actie: 'orde', volgorde: [0, 1, 2, 3] } }, A)).status, 409);
});
