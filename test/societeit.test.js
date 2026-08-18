/* Integratietests voor De Societeit (18-21): het Quizduel (tien dezelfde
   vragen, oplossing blijft op de server tot er geantwoord is) en het
   Schatduel (vijf ronden, het dichtstbij pakt het punt). Jong-profielen
   zijn niet beschermd en dus gewoon vindbaar op codenaam -- dat pad wordt
   hier ook bewezen. Overal alleen codenamen.
   Draai los: node --test test/societeit.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-societeit-'));
let child;
const ECHT = 'Societeitstest';

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
  A = await jong(ECHT + ' Huis A', 'Jong Aa ' + ECHT);
  B = await jong(ECHT + ' Huis B', 'Jong Bo ' + ECHT);
  aCn = A.codenaam; bCn = B.codenaam;
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('quizduel: uitnodigen op codenaam, opties zonder oplossing, eerlijke uitslag', async () => {
  // jong (18-21) is niet beschermd: uitnodigen op codenaam werkt gewoon
  const nieuw = await json(await spel('nieuw', { soort: 'quiz', grootte: 2, codenamen: [bCn] }, A));
  assert.ok(nieuw.id, 'A vindt B op codenaam en daagt uit');
  await spel('antwoord', { id: nieuw.id, akkoord: true }, B);
  let goedA = 0, goedB = 0;
  for (let i = 0; i < 10; i++) {
    const st = await json(await spel('staat', { id: nieuw.id }, A));
    assert.ok(st.potje.staat.opties.length === 3, 'drie opties reizen mee');
    assert.equal(st.potje.staat.juist, undefined, 'de oplossing blijft op de server');
    const zA = await json(await spel('zet', { id: nieuw.id, zet: { actie: 'antwoord', keuze: 0 } }, A));
    if (zA.goedWas) goedA++;
    const zB = await json(await spel('zet', { id: nieuw.id, zet: { actie: 'antwoord', keuze: 1 } }, B));
    if (zB.goedWas) goedB++;
    assert.ok(typeof zA.juistTekst === 'string', 'na het antwoord komt de onthulling');
  }
  const klaar = await json(await spel('staat', { id: nieuw.id }, A));
  assert.equal(klaar.potje.status, 'klaar');
  assert.deepEqual(klaar.potje.staat.stand.map(s => s.goed), [goedA, goedB], 'de stand telt precies de goede antwoorden');
  if (goedA === goedB) assert.ok(klaar.potje.gelijk || klaar.potje.winnaar === aCn, 'gelijk spel valt op wie eerst klaar was');
  else assert.equal(klaar.potje.winnaar, goedA > goedB ? aCn : bCn);
  assert.ok(!JSON.stringify(klaar).includes(ECHT), 'alleen codenamen in het potje');
});

test('schatduel: het dichtstbij pakt elk punt', async () => {
  const nieuw = await json(await spel('nieuw', { soort: 'schat', grootte: 2, codenamen: [bCn] }, A));
  await spel('antwoord', { id: nieuw.id, akkoord: true }, B);
  for (let i = 0; i < 5; i++) {
    // A gokt wild; de onthulling in het antwoord vertelt B het echte getal,
    // maar pas NADAT A al vastligt -- B zit er dus altijd het dichtstbij
    const zA = await json(await spel('zet', { id: nieuw.id, zet: { actie: 'schat', w: 1 } }, A));
    assert.ok(typeof zA.juist === 'number' && zA.juist > 1, 'de onthulling reist mee');
    const zB = await json(await spel('zet', { id: nieuw.id, zet: { actie: 'schat', w: zA.juist } }, B));
    assert.equal(zB.juist, zA.juist, 'iedereen kreeg dezelfde vraag');
  }
  const klaar = await json(await spel('staat', { id: nieuw.id }, B));
  assert.equal(klaar.potje.status, 'klaar');
  assert.equal(klaar.potje.winnaar, bCn, 'vijf ronden dichtstbij is vijf punten');
  assert.deepEqual(klaar.potje.staat.stand.map(s => s.punten).sort((x, y) => y - x), [5, 0]);
  // nog een schatting na het einde kan niet
  assert.equal((await spel('zet', { id: nieuw.id, zet: { actie: 'schat', w: 5 } }, A)).status, 409);
});
