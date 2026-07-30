/* RTG School golf 4: de hulplijn en de leercurve-sync -- veiligheid als een
   keten, zonder surveillance. De ene knop is van het kind; toestemming
   bepaalt wie meeleest (vertrouwelijk = alleen de mentor); en aankomende
   toetsen reizen mee naar het gezinsoverzicht.
   Draai los: node --experimental-sqlite --test test/schoolhulplijn.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtf-hulplijn-'));
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
  const sch = await json(await api('/school/school/maak', { naam: 'De Veilige Haven ' + naam, plaats: 'Gouda' }));
  const login = await json(await office('/office/login', { code: 'RTG-OFFICE' }));
  await office('/office/school/decide', { code: sch.schoolCode, action: 'goedkeuren' }, login.token);
  const p = await json(await api('/school/personeel/aanmeld', { schoolCode: sch.schoolCode, naam: 'Mentor ' + naam, rol: 'leraar' }));
  await api('/school/personeel/besluit', { schoolCode: sch.schoolCode, beheerToken: sch.beheerToken, personeelId: p.personeelId, akkoord: true });
  const kl = await json(await api('/school/leraar/klas/maak', { schoolCode: sch.schoolCode, personeelToken: p.personeelToken, naam: 'Groep 8' }));
  const klas = { code: kl.code, leraarToken: p.personeelToken };
  const g = await json(await api('/gezin/maak', { gezinsnaam: 'Fam ' + naam, naam: 'Ouder ' + naam, pin: '1234' }));
  const kind = await json(await api('/gezin/profiel/maak', { code: g.code, token: g.token, naam: 'Kind ' + naam, rol: 'kind', groep: 'kind' }));
  const kindToken = (await json(await api('/gezin/profiel/kies', { code: g.code, profielId: kind.profiel.id }))).token;
  await api('/school/koppel', { code: g.code, token: kindToken, klasCode: klas.code });
  return { sch, klas, g, kindToken };
}
const lr = (klas, pad, body) => api(pad, Object.assign({ klasCode: klas.code, leraarToken: klas.leraarToken }, body || {}));

test('1. vertrouwelijk: alleen de mentor ziet het, de ouder niet, het kind zelf wel', async () => {
  const { klas, g, kindToken } = await opzet('Stil');
  // de ouder kan de knop niet namens het kind indrukken
  const alsOuder = await api('/school/hulplijn', { code: g.code, token: g.token, klasCode: klas.code, tekst: 'namens mijn kind' });
  assert.equal(alsOuder.status, 403, 'de knop is van het kind zelf');
  const m = await json(await api('/school/hulplijn', { code: g.code, token: kindToken, klasCode: klas.code,
    tekst: 'Thuis is het niet fijn. Kan ik met je praten?', vertrouwelijk: true }));
  assert.match(m.wieZietDit, /alleen je mentor/i, 'de app zegt vooraf eerlijk wie meeleest');
  // de mentor ziet hem en pakt hem op
  const bijMentor = await json(await lr(klas, '/school/hulplijn/klas'));
  assert.equal(bijMentor.meldingen.length, 1);
  assert.equal(bijMentor.meldingen[0].vertrouwelijk, true);
  await lr(klas, '/school/hulplijn/oppakken', { id: m.melding.id, notitie: 'Morgen in de pauze even samen zitten.' });
  // de OUDER ziet de vertrouwelijke melding niet -- de vertrouwenspersoon-route
  const ouder = await json(await api('/school/hulplijn/mijn', { code: g.code, token: g.token, klasCode: klas.code }));
  assert.equal(ouder.meldingen.length, 0, 'vertrouwelijk blijft tussen kind en mentor');
  // het kind zelf ziet zijn eigen melding altijd terug, met de status
  const kind = await json(await api('/school/hulplijn/mijn', { code: g.code, token: kindToken, klasCode: klas.code }));
  assert.equal(kind.meldingen.length, 1);
  assert.equal(kind.meldingen[0].status, 'opgepakt');
});

test('2. gewoon en acuut: de ouder leest mee en acuut staat bovenaan bij de mentor', async () => {
  const { klas, g, kindToken } = await opzet('Open');
  await api('/school/hulplijn', { code: g.code, token: kindToken, klasCode: klas.code, tekst: 'Ik word geplaagd op het plein.' });
  await api('/school/hulplijn', { code: g.code, token: kindToken, klasCode: klas.code, tekst: 'Ik voel me nu niet veilig.', acuut: true });
  const ouder = await json(await api('/school/hulplijn/mijn', { code: g.code, token: g.token, klasCode: klas.code }));
  assert.equal(ouder.meldingen.length, 2, 'gewone meldingen leest de ouder gewoon mee');
  const mentor = await json(await lr(klas, '/school/hulplijn/klas'));
  assert.equal(mentor.meldingen[0].acuut, true, 'acuut staat bovenaan');
});

test('3. leercurve-sync zonder surveillance: toetsen reizen mee, locaties nooit', async () => {
  const { klas, g, kindToken } = await opzet('Sync');
  await lr(klas, '/school/toets/maak', { soort: 'so', naam: 'SO optellen', doelen: ['rekenen.g3.optellen-tot-20'] });
  const mijn = await json(await api('/school/mijn', { code: g.code, token: kindToken }));
  const entry = mijn.school[0];
  assert.equal(entry.aankomendeToetsen.length, 1, 'de aankomende toets staat in het gezinsoverzicht');
  assert.equal(entry.aankomendeToetsen[0].soort, 'so');
  assert.deepEqual(entry.aankomendeToetsen[0].doelen, ['rekenen.g3.optellen-tot-20'], 'met de leerdoelen erbij: zo weet de leerapp wat te oefenen');
  // geen surveillance: het gezinsoverzicht bevat nooit locatievelden
  assert.doesNotMatch(JSON.stringify(mijn), /"lat"|"lng"|"gps"/, 'leercurve-sync is data over leren, nooit over waar het kind is');
});
