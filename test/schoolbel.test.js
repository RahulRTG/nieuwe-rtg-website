/* RTF School, bellen binnen de app: het klas-belkanaal (SSE) en de
   belsignalen. Ouders bellen de leraar of een boom-tak-gezin; kinderen
   bewust niet (geen privekanaal leraar-kind). Geen telefoonnummers nodig:
   alles blijft binnen de app.
   Draai los: node --test test/schoolbel.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtf-schoolbel-'));
let child;

function api(pad, body) {
  return fetch(BASE + '/api/foundation' + pad, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
  });
}
function office(pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return fetch(BASE + '/api' + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
}
const json = r => r.json();

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' }, wachtPad: '/api/foundation/health' }));
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

async function opzet(naam) {
  const sch = await json(await api('/school/school/maak', { naam: 'De Beltoren ' + naam, plaats: 'Breda' }));
  const login = await json(await office('/office/login', { code: 'RTG-OFFICE' }));
  await office('/office/school/decide', { code: sch.schoolCode, action: 'goedkeuren' }, login.token);
  const p = await json(await api('/school/personeel/aanmeld', { schoolCode: sch.schoolCode, naam: 'Juf ' + naam, rol: 'leraar' }));
  await api('/school/personeel/besluit', { schoolCode: sch.schoolCode, beheerToken: sch.beheerToken, personeelId: p.personeelId, akkoord: true });
  const kl = await json(await api('/school/leraar/klas/maak', { schoolCode: sch.schoolCode, personeelToken: p.personeelToken, naam: 'Groep 7' }));
  const klas = { code: kl.code, leraarToken: p.personeelToken };
  const gezin = await gezinErbij(klas.code, naam);
  return { sch, klas, ...gezin };
}
async function gezinErbij(klasCode, naam) {
  const g = await json(await api('/gezin/maak', { gezinsnaam: 'Fam ' + naam, naam: 'Ouder ' + naam, pin: '1234' }));
  const kind = await json(await api('/gezin/profiel/maak', { code: g.code, token: g.token, naam: 'Kind ' + naam, rol: 'kind', groep: 'kind' }));
  const kindToken = (await json(await api('/gezin/profiel/kies', { code: g.code, profielId: kind.profiel.id }))).token;
  await api('/school/koppel', { code: g.code, token: kindToken, klasCode });
  return { g, kindToken };
}

// lees het SSE-kanaal tot de tekst het patroon bevat (of geef op na ms)
async function leesTot(lezer, patroon, ms) {
  let tekst = '';
  const stopper = new Promise((_, weiger) => setTimeout(() => weiger(new Error('geen signaal binnen ' + ms + 'ms; gezien: ' + tekst.slice(0, 200))), ms));
  while (!patroon.test(tekst)) {
    const stuk = await Promise.race([lezer.read(), stopper]);
    if (stuk.done) break;
    tekst += Buffer.from(stuk.value).toString();
  }
  return tekst;
}

test('1. de ouder belt de leraar binnen de app: het signaal komt aan op het klas-belkanaal', async () => {
  const { klas, g } = await opzet('Bel');
  const kanaal = await fetch(BASE + '/api/foundation/school/belkanaal?klasCode=' + klas.code + '&leraarToken=' + encodeURIComponent(klas.leraarToken));
  assert.equal(kanaal.status, 200);
  const lezer = kanaal.body.getReader();
  await new Promise(r => setTimeout(r, 200));
  const r = await json(await api('/school/bel', { code: g.code, token: g.token, klasCode: klas.code, naar: 'leraar', kind: 'ring' }));
  assert.equal(r.bezorgd, 1, 'binnen de app bezorgd, geen telefoonnummer nodig');
  const tekst = await leesTot(lezer, /"kind":"ring"/, 3000);
  assert.match(tekst, /Ouder Bel/, 'de leraar ziet wie er belt');
  await lezer.cancel();
});

test('2. de grenzen: kinderen bellen hier niet, vreemden komen er niet in', async () => {
  const { klas, g, kindToken } = await opzet('Grens');
  // het kind mag niet bellen (geen privekanaal leraar-kind)
  const alsKind = await api('/school/bel', { code: g.code, token: kindToken, klasCode: klas.code, naar: 'leraar', kind: 'ring' });
  assert.equal(alsKind.status, 403);
  // het kind kan ook het kanaal niet openen
  const kindKanaal = await fetch(BASE + '/api/foundation/school/belkanaal?klasCode=' + klas.code + '&code=' + g.code + '&token=' + encodeURIComponent(kindToken));
  assert.equal(kindKanaal.status, 403);
  // een gezin dat niet in de klas zit komt er niet in
  const vreemd = await json(await api('/gezin/maak', { gezinsnaam: 'Fam Vreemd', naam: 'Ouder Vreemd', pin: '1234' }));
  const vreemdBel = await api('/school/bel', { code: vreemd.code, token: vreemd.token, klasCode: klas.code, naar: 'leraar', kind: 'ring' });
  assert.equal(vreemdBel.status, 403);
  // en een doel buiten de klas bestaat niet
  const raarDoel = await api('/school/bel', { code: g.code, token: g.token, klasCode: klas.code, naar: vreemd.code, kind: 'ring' });
  assert.equal(raarDoel.status, 404);
});

test('3. de telefoonboom belt in de app: gezin naar gezin, en de takken kennen hun gezinscode', async () => {
  const { klas, g } = await opzet('Boom');
  const g2 = await gezinErbij(klas.code, 'Twee');
  // gezin 2 (een boom-tak) heeft de app open; gezin 1 belt zonder nummer
  const kanaal = await fetch(BASE + '/api/foundation/school/belkanaal?klasCode=' + klas.code + '&code=' + g2.g.code + '&token=' + encodeURIComponent(g2.g.token));
  assert.equal(kanaal.status, 200);
  const lezer = kanaal.body.getReader();
  await new Promise(r => setTimeout(r, 200));
  const r = await json(await api('/school/bel', { code: g.code, token: g.token, klasCode: klas.code, naar: g2.g.code, kind: 'ring' }));
  assert.equal(r.bezorgd, 1);
  await leesTot(lezer, /"kind":"ring"/, 3000);
  await lezer.cancel();
  // jezelf bellen is onzin en zegt dat ook
  assert.equal((await api('/school/bel', { code: g.code, token: g.token, klasCode: klas.code, naar: g.code, kind: 'ring' })).status, 400);
  // de boom-takken dragen hun gezinscode, zodat de belknop weet wie hij belt
  const g3 = await gezinErbij(klas.code, 'Drie');
  await lr(klas, '/school/telefoonboom/maak');
  const mijn = await json(await api('/school/telefoonboom/mijn', { code: g.code, token: g.token, klasCode: klas.code }));
  assert.equal(mijn.ikBel.length, 1);
  assert.equal(mijn.ikBel[0].gezinCode, g3.g.code, 'elke tak kent zijn gezinscode voor de in-app belknop');
  const ov = await json(await lr(klas, '/school/telefoonboom'));
  assert.ok(ov.volgorde.every(n => n.gezinCode), 'ook de leraar ziet per knoop de gezinscode');
});
const lr = (klas, pad, body) => api(pad, Object.assign({ klasCode: klas.code, leraarToken: klas.leraarToken }, body || {}));
