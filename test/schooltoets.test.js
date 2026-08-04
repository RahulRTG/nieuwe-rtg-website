/* RTF School x leerstof-motor: de leraar vinkt leerdoelen aan en heeft een
   SO/proefwerk/examen klaar (verse opgaven per leerling, server kijkt na,
   geen goed/fout-verklikker halverwege), een MO geeft de leraar de vragen
   met antwoorden, en het cijfervoorstel is een advies dat de leraar met een
   tik in het bestaande cijferboek zet.
   Draai los: node --experimental-sqlite --test test/schooltoets.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtf-schooltoets-'));
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

/* de keten school -> leraar -> klas -> gezin met gekoppeld kind (als in school.test.js) */
async function opzet(naam) {
  const sch = await json(await api('/school/school/maak', { naam: 'De Regenboog ' + naam, plaats: 'Utrecht' }));
  const login = await json(await office('/office/login', { code: 'RTG-OFFICE' }));
  await office('/office/school/decide', { code: sch.schoolCode, action: 'goedkeuren' }, login.token);
  const p = await json(await api('/school/personeel/aanmeld', { schoolCode: sch.schoolCode, naam: 'Juf ' + naam, rol: 'leraar' }));
  await api('/school/personeel/besluit', { schoolCode: sch.schoolCode, beheerToken: sch.beheerToken, personeelId: p.personeelId, akkoord: true });
  const kl = await json(await api('/school/leraar/klas/maak', { schoolCode: sch.schoolCode, personeelToken: p.personeelToken, naam: 'Groep 3' }));
  const klas = { code: kl.code, leraarToken: p.personeelToken };
  const g = await json(await api('/gezin/maak', { gezinsnaam: 'Fam ' + naam, naam: 'Ouder ' + naam, pin: '1234' }));
  const kind = await json(await api('/gezin/profiel/maak', { code: g.code, token: g.token, naam: 'Kind ' + naam, rol: 'kind', groep: 'kind' }));
  const kindToken = (await json(await api('/gezin/profiel/kies', { code: g.code, profielId: kind.profiel.id }))).token;
  await api('/school/koppel', { code: g.code, token: g.token, klasCode: klas.code, profielId: kind.profiel.id });
  await api('/school/uitnodiging/antwoord', { code: g.code, token: kindToken, klasCode: klas.code, akkoord: true });
  return { klas, g, kindToken, sleutel: g.code + ':' + kind.profiel.id };
}
const lr = (klas, pad, body) => api(pad, Object.assign({ klasCode: klas.code, leraarToken: klas.leraarToken }, body || {}));
const som = v => { const m = v.match(/^(\d+)\s*([+-])\s*(\d+)\s*=/); return m ? String(m[2] === '+' ? +m[1] + +m[3] : +m[1] - +m[3]) : '0'; };

test('1. SO in een tik: leerdoelen aanvinken, kind maakt met verse sommen, leraar becijfert', async () => {
  const { klas, g, kindToken, sleutel } = await opzet('Toets');
  // De bibliotheek voor het maak-scherm: basisschoolgroepen en ladder-fasen
  // ELK in hun eigen lijst. De oude vorm gooide alles op d.groep, waardoor de
  // vo/mbo/hbo/wo-doelen (zonder groep) samenvielen in een "Groep null" --
  // en dit assert (>= 8) liet die negende emmer gewoon door. Nu exact.
  const bieb = await json(await lr(klas, '/school/toets/bibliotheek'));
  assert.equal(bieb.groepen.length, 8, 'precies acht basisschoolgroepen, geen null-emmer');
  assert.ok(bieb.groepen.every(g => Number.isInteger(g.groep) && g.groep >= 1 && g.groep <= 8),
    'elke groep is een geheel getal 1 t/m 8: ' + bieb.groepen.map(g => g.groep).join(','));
  assert.ok(bieb.groepen[0].doelen.length >= 2);
  assert.ok(Array.isArray(bieb.fasen) && bieb.fasen.length >= 4, 'de vervolgdoelen staan in eigen fasen');
  assert.ok(bieb.fasen.every(f => f.fase && f.naam && f.trapNaam), 'elke fase draagt naam en schoolsoort');
  // twee vinkjes = een SO van 6 vragen
  const so = await json(await lr(klas, '/school/toets/maak', { soort: 'so', naam: 'SO Rekenen week 4',
    doelen: ['rekenen.g3.optellen-tot-20', 'rekenen.g3.aftrekken-tot-20'], perDoel: 3 }));
  assert.ok(so.ok && so.toets.vragen === 6);
  // het kind ziet de toets klaarstaan en maakt hem; halverwege GEEN goed/fout
  const kind = (pad, body) => api(pad, Object.assign({ code: g.code, token: kindToken, klasCode: klas.code }, body || {}));
  const voorMij = await json(await kind('/school/toets/voor-mij'));
  assert.equal(voorMij.toetsen[0].naam, 'SO Rekenen week 4');
  let r = await json(await kind('/school/toets/start', { toetsId: so.toets.id }));
  for (let i = 0; i < 6; i++) {
    r = await json(await kind('/school/toets/antwoord', { toetsId: so.toets.id, antwoord: som(r.vraag || '') }));
    if (!r.klaar) assert.ok(!('goed' in r), 'een toets verklikt niet halverwege wat goed was');
  }
  assert.equal(r.klaar, true);
  assert.equal(r.aantalGoed, 6, 'de testleerling rekende alles goed uit');
  assert.equal((await kind('/school/toets/start', { toetsId: so.toets.id })).status, 409, 'een toets maak je een keer');
  // de leraar ziet de uitslag per leerdoel en het voorstel; een tik = cijfer in het boek
  const lijst = await json(await lr(klas, '/school/toets/lijst'));
  const uitslag = lijst.toetsen[0].leerlingen.find(l => l.sleutel === sleutel).uitslag;
  assert.equal(uitslag.voorstel, 10);
  assert.equal(Object.values(uitslag.perDoel).reduce((a, b) => a + b, 0), 6, 'de uitslag is per leerdoel uitgesplitst');
  const cf = await json(await lr(klas, '/school/toets/cijfer', { toetsId: so.toets.id, leerling: sleutel }));
  assert.equal(cf.cijfer.cijfer, 10);
  assert.match(cf.cijfer.omschrijving, /SO Rekenen week 4/);
  // en hij staat echt in het bestaande cijferboek van de klas
  const kd = await json(await lr(klas, '/school/klas'));
  assert.ok(kd.cijfers.some(c => c.leerling === sleutel && c.cijfer === 10), 'het cijfer landt in het cijferboek');
});

test('2. MO: de leraar krijgt de vragen met antwoorden en het advies blijft een advies', async () => {
  const { klas, sleutel } = await opzet('Mo');
  const mo = await json(await lr(klas, '/school/toets/maak', { soort: 'mo', doelen: ['taal.g3.mkm-woorden'], perDoel: 4 }));
  const vragen = await json(await lr(klas, '/school/toets/mo', { toetsId: mo.toets.id, leerling: sleutel }));
  assert.equal(vragen.vragen.length, 4);
  assert.ok(vragen.vragen.every(v => v.a), 'bij een mondeling ziet de LERAAR de antwoorden');
  await lr(klas, '/school/toets/mo-invoer', { toetsId: mo.toets.id, leerling: sleutel, goed: 3 });
  // voorstel 1 + 9 x 3/4 = 7,8 -- maar de leraar beslist en geeft een 8
  const cf = await json(await lr(klas, '/school/toets/cijfer', { toetsId: mo.toets.id, leerling: sleutel, cijfer: 8 }));
  assert.equal(cf.voorstelWas, 7.8);
  assert.equal(cf.cijfer.cijfer, 8, 'het advies adviseert, de leraar beslist');
});

test('3. nette grenzen: onbekende doelen, gesloten toets, en dicht zonder token', async () => {
  const { klas, g, kindToken } = await opzet('Grens');
  assert.equal((await lr(klas, '/school/toets/maak', { soort: 'so', doelen: ['bestaat.niet'] })).status, 400);
  assert.equal((await lr(klas, '/school/toets/maak', { soort: 'tentamen', doelen: ['rekenen.g3.splitsen'] })).status, 400);
  const so = await json(await lr(klas, '/school/toets/maak', { soort: 'so', doelen: ['rekenen.g3.splitsen'] }));
  await lr(klas, '/school/toets/sluit', { toetsId: so.toets.id });
  const kind = (pad, body) => api(pad, Object.assign({ code: g.code, token: kindToken, klasCode: klas.code }, body || {}));
  assert.equal((await kind('/school/toets/start', { toetsId: so.toets.id })).status, 400, 'een gesloten toets start niet meer');
  assert.equal((await api('/school/toets/lijst', { klasCode: klas.code, leraarToken: 'fout' })).status, 403);
});
