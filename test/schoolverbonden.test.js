/* RTF School, de verbonden klas: het lerarenteam (max drie vast), de
   waarnemer die een klas van een collega overneemt, de online les voor
   thuiswerken, en huiswerk dat aan een leerdoel hangt en zichzelf afvinkt
   als het kind goed geoefend heeft.
   Draai los: node --experimental-sqlite --test test/schoolverbonden.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtf-schoolverb-'));
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

async function leraarErbij(sch, naam) {
  const p = await json(await api('/school/personeel/aanmeld', { schoolCode: sch.schoolCode, naam, rol: 'leraar' }));
  await api('/school/personeel/besluit', { schoolCode: sch.schoolCode, beheerToken: sch.beheerToken, personeelId: p.personeelId, akkoord: true });
  return p;
}
async function opzet(naam) {
  const sch = await json(await api('/school/school/maak', { naam: 'De Verbinding ' + naam, plaats: 'Utrecht' }));
  const login = await json(await office('/office/login', { code: 'RTG-OFFICE' }));
  await office('/office/school/decide', { code: sch.schoolCode, action: 'goedkeuren' }, login.token);
  const p = await leraarErbij(sch, 'Juf ' + naam);
  const kl = await json(await api('/school/leraar/klas/maak', { schoolCode: sch.schoolCode, personeelToken: p.personeelToken, naam: 'Groep 3' }));
  const klas = { code: kl.code, leraarToken: p.personeelToken };
  const g = await json(await api('/gezin/maak', { gezinsnaam: 'Fam ' + naam, naam: 'Ouder ' + naam, pin: '1234' }));
  const kind = await json(await api('/gezin/profiel/maak', { code: g.code, token: g.token, naam: 'Kind ' + naam, rol: 'kind', groep: 'kind' }));
  const kindToken = (await json(await api('/gezin/profiel/kies', { code: g.code, profielId: kind.profiel.id }))).token;
  await api('/school/koppel', { code: g.code, token: g.token, klasCode: klas.code, profielId: kind.profiel.id });
  await api('/school/uitnodiging/antwoord', { code: g.code, token: kindToken, klasCode: klas.code, akkoord: true });
  return { sch, klas, g, kindToken, sleutel: g.code + ':' + kind.profiel.id };
}
const lr = (klas, pad, body) => api(pad, Object.assign({ klasCode: klas.code, leraarToken: klas.leraarToken }, body || {}));
const som = v => { const m = v.match(/^(\d+)\s*([+-])\s*(\d+)\s*=/); return m ? String(m[2] === '+' ? +m[1] + +m[3] : +m[1] - +m[3]) : '0'; };

test('1. het team: drie leraren vast, de vierde past er niet bij, en collega twee opent de klas gewoon', async () => {
  const { sch, klas } = await opzet('Team');
  const twee = await leraarErbij(sch, 'Meester Twee');
  const drie = await leraarErbij(sch, 'Juf Drie');
  const vier = await leraarErbij(sch, 'Meester Vier');
  assert.ok((await json(await lr(klas, '/school/klas/leraar-koppel', { personeelId: twee.personeelId }))).ok);
  assert.ok((await json(await lr(klas, '/school/klas/leraar-koppel', { personeelId: drie.personeelId }))).ok);
  const vol = await lr(klas, '/school/klas/leraar-koppel', { personeelId: vier.personeelId });
  assert.equal(vol.status, 400, 'max drie leraren vast op een klas');
  assert.match((await vol.json()).error, /drie leraren/);
  // de tweede leraar is nu echt van de klas: zijn eigen token opent hem
  const alsTwee = await api('/school/klas', { klasCode: klas.code, leraarToken: twee.personeelToken });
  assert.equal(alsTwee.status, 200);
  const team = await json(await lr(klas, '/school/klas/team'));
  assert.equal(team.leraren.length, 3);
  // en eraf halen kan, maar nooit de laatste
  await lr(klas, '/school/klas/leraar-weg', { personeelId: drie.personeelId });
  await lr(klas, '/school/klas/leraar-weg', { personeelId: twee.personeelId });
  const laatste = await lr(klas, '/school/klas/leraar-weg', { personeelId: (await json(await lr(klas, '/school/klas/team'))).leraren[0].id });
  assert.equal(laatste.status, 400, 'een klas houdt altijd een vaste leraar');
});

test('2. overname: een collega neemt de klas waar en staat er daarna weer naast', async () => {
  const { sch, klas } = await opzet('Waarneem');
  const inval = await leraarErbij(sch, 'Invaller Iris');
  // voor de overname komt de invaller de klas niet in
  assert.equal((await api('/school/klas', { klasCode: klas.code, leraarToken: inval.personeelToken })).status, 403);
  const o = await json(await api('/school/klas/overname', { schoolCode: sch.schoolCode, personeelToken: inval.personeelToken, klasCode: klas.code }));
  assert.equal(o.waarnemer.naam, 'Invaller Iris');
  // nu wel: de waarnemer draait de klas, tot de overname stopt
  assert.equal((await api('/school/klas', { klasCode: klas.code, leraarToken: inval.personeelToken })).status, 200);
  await api('/school/klas/overname-stop', { klasCode: klas.code, leraarToken: inval.personeelToken });
  assert.equal((await api('/school/klas', { klasCode: klas.code, leraarToken: inval.personeelToken })).status, 403);
});

test('3. thuiswerken: online les zichtbaar bij het gezin, huiswerk uit de leerlijn vinkt zichzelf af', async () => {
  const { klas, g, kindToken, sleutel } = await opzet('Thuis');
  const kind = (pad, body) => api(pad, Object.assign({ code: g.code, token: kindToken, klasCode: klas.code }, body || {}));
  // de leraar start de online les; het gezin ziet de kamercode meteen
  const les = await json(await lr(klas, '/school/les/start'));
  assert.match(les.onlineLes.kamercode, /^LES-/);
  const mijn = await json(await api('/school/mijn', { code: g.code, token: kindToken }));
  assert.equal(mijn.school[0].onlineLes.kamercode, les.onlineLes.kamercode, 'thuiswerken is een kamercode verwijderd');
  // huiswerk dat aan een leerdoel hangt
  const hw = await json(await lr(klas, '/school/huiswerk/maak', { titel: 'Oefen optellen tot 20', vak: 'rekenen', doel: 'rekenen.g3.optellen-tot-20' }));
  assert.equal(hw.huiswerk.doel, 'rekenen.g3.optellen-tot-20');
  let r = await json(await kind('/school/huiswerk/oefen', { huiswerkId: hw.huiswerk.id }));
  assert.ok(r.les.length > 40, 'de miniles reist mee met het huiswerk');
  for (let i = 0; i < 5; i++) r = await json(await kind('/school/huiswerk/oefen-antwoord', { antwoord: som(r.vraag || '') }));
  assert.equal(r.klaar, true);
  assert.equal(r.afgevinkt, true, 'goed geoefend = huiswerk vinkt zichzelf af');
  const kd = await json(await lr(klas, '/school/klas'));
  const h = kd.huiswerk.find(x => x.id === hw.huiswerk.id);
  assert.ok(h.afDoor.includes(sleutel), 'de leraar ziet het meteen in het klasoverzicht');
  await lr(klas, '/school/les/stop');
  assert.equal((await json(await api('/school/mijn', { code: g.code, token: kindToken }))).school[0].onlineLes, null);
});
