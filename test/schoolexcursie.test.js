/* RTF School, de exclusieve laag: de vrijwillige ouderbijdrage, de excursie
   met tijdelijke GPS (toestemming vooraf, kijklog voor het gezin, wissen bij
   de stop) en de telefoonboom.
   Draai los: node --experimental-sqlite --test test/schoolexcursie.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtf-schoolexc-'));
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
  const sch = await json(await api('/school/school/maak', { naam: 'De Uitkijk ' + naam, plaats: 'Leiden' }));
  const login = await json(await office('/office/login', { code: 'RTG-OFFICE' }));
  await office('/office/school/decide', { code: sch.schoolCode, action: 'goedkeuren' }, login.token);
  const p = await json(await api('/school/personeel/aanmeld', { schoolCode: sch.schoolCode, naam: 'Juf ' + naam, rol: 'leraar' }));
  await api('/school/personeel/besluit', { schoolCode: sch.schoolCode, beheerToken: sch.beheerToken, personeelId: p.personeelId, akkoord: true });
  const kl = await json(await api('/school/leraar/klas/maak', { schoolCode: sch.schoolCode, personeelToken: p.personeelToken, naam: 'Groep 5' }));
  const klas = { code: kl.code, leraarToken: p.personeelToken };
  const gezin = await gezinErbij(klas.code, naam);
  return { sch, klas, ...gezin };
}
// een gezin met een kind dat zichzelf aansluit (eigen keuze, dus meteen actief)
async function gezinErbij(klasCode, naam) {
  const g = await json(await api('/gezin/maak', { gezinsnaam: 'Fam ' + naam, naam: 'Ouder ' + naam, pin: '1234' }));
  const kind = await json(await api('/gezin/profiel/maak', { code: g.code, token: g.token, naam: 'Kind ' + naam, rol: 'kind', groep: 'kind' }));
  const kindToken = (await json(await api('/gezin/profiel/kies', { code: g.code, profielId: kind.profiel.id }))).token;
  await api('/school/koppel', { code: g.code, token: kindToken, klasCode });
  return { g, kindToken, profielId: kind.profiel.id, sleutel: g.code + ':' + kind.profiel.id };
}
const lr = (klas, pad, body) => api(pad, Object.assign({ klasCode: klas.code, leraarToken: klas.leraarToken }, body || {}));

test('1. de ouderbijdrage: vrijwillig in elk antwoord, alleen een ouder betaalt, nooit dubbel', async () => {
  const { klas, g, kindToken, profielId } = await opzet('Bijdrage');
  const b = await json(await lr(klas, '/school/bijdrage/maak', { titel: 'Museumbezoek', bedrag: 12.5 }));
  assert.match(b.vrijwillig, /vrijwillig/);
  assert.match(b.vrijwillig, /nooit uitgesloten/);
  // het kind zelf kan niet betalen; dat is een ouderzaak
  const alsKind = await api('/school/bijdrage/betaal', { code: g.code, token: kindToken, klasCode: klas.code, bijdrageId: b.bijdrage.id, profielId });
  assert.equal(alsKind.status, 403);
  const bet = await json(await api('/school/bijdrage/betaal', { code: g.code, token: g.token, klasCode: klas.code, bijdrageId: b.bijdrage.id, profielId }));
  assert.equal(bet.betaald, true);
  const dubbel = await api('/school/bijdrage/betaal', { code: g.code, token: g.token, klasCode: klas.code, bijdrageId: b.bijdrage.id, profielId });
  assert.equal(dubbel.status, 409);
  const mijn = await json(await api('/school/bijdrage/mijn', { code: g.code, token: g.token, klasCode: klas.code }));
  assert.equal(mijn.bijdragen[0].kinderen[0].betaald, true);
  assert.match(mijn.vrijwillig, /nooit uitgesloten/);
  const ov = await json(await lr(klas, '/school/bijdrage/overzicht'));
  assert.equal(ov.bijdragen[0].betaald.length, 1);
  assert.match(ov.vrijwillig, /vrijwillig/, 'ook de leraar krijgt de regel te zien');
});

test('2. de excursie: gps alleen met toestemming en alleen tijdens het uitje; elke blik op de kaart is gelogd; stop = gewist', async () => {
  const { klas, g, kindToken, profielId } = await opzet('Uitje');
  const e = (await json(await lr(klas, '/school/excursie/maak', { titel: 'Artis', bestemming: 'Amsterdam' }))).excursie;
  const kind = (pad, body) => api(pad, Object.assign({ code: g.code, token: kindToken, klasCode: klas.code, excursieId: e.id }, body || {}));
  // voor de start bestaat er geen locatie
  assert.equal((await kind('/school/excursie/gps', { lat: 52.3, lng: 4.9 })).status, 400);
  await lr(klas, '/school/excursie/start', { excursieId: e.id });
  // zonder toestemming van de ouder: nee
  assert.equal((await kind('/school/excursie/gps', { lat: 52.3, lng: 4.9 })).status, 403);
  await api('/school/excursie/toestemming', { code: g.code, token: g.token, klasCode: klas.code, excursieId: e.id, profielId, akkoord: true });
  assert.equal((await kind('/school/excursie/gps', { lat: 52.366, lng: 4.916 })).status, 200);
  // de begeleider geeft ook de eigen plek door en kijkt op de kaart
  await lr(klas, '/school/excursie/gps', { excursieId: e.id, lat: 52.365, lng: 4.915 });
  const kaart = await json(await lr(klas, '/school/excursie/kaart', { excursieId: e.id }));
  assert.equal(kaart.plekken.length, 2, 'de app heeft alle locaties van iedereen');
  // het gezin leest de kijklog mee: wie keek, en wanneer
  const mijn = await json(await api('/school/excursie/mijn', { code: g.code, token: g.token, klasCode: klas.code }));
  const ex = mijn.excursies.find(x => x.id === e.id);
  assert.equal(ex.kijklog[0].naam, 'Juf Uitje', 'kijken wordt gelogd, op naam');
  assert.equal(ex.kinderen[0].plek.lat, 52.366);
  // stop = wissen: de kaart is dicht en de plekken bestaan niet meer
  await lr(klas, '/school/excursie/stop', { excursieId: e.id });
  assert.equal((await lr(klas, '/school/excursie/kaart', { excursieId: e.id })).status, 400);
  const na = await json(await api('/school/excursie/mijn', { code: g.code, token: g.token, klasCode: klas.code }));
  assert.equal(na.excursies.find(x => x.id === e.id).kinderen[0].plek, null);
  assert.equal((await kind('/school/excursie/gps', { lat: 52.3, lng: 4.9 })).status, 400, 'na de stop bestaat er geen gps meer');
});

test('3. de telefoonboom: ieder gezin belt de eigen takken, de leraar ziet wie al belde', async () => {
  const { klas, g } = await opzet('Boom');
  const g2 = await gezinErbij(klas.code, 'Twee');
  const g3 = await gezinErbij(klas.code, 'Drie');
  await api('/school/telefoonboom/nummer', { code: g.code, token: g.token, klasCode: klas.code, nummer: '+31 6 11111111' });
  await api('/school/telefoonboom/nummer', { code: g2.g.code, token: g2.g.token, klasCode: klas.code, nummer: '+31 6 22222222' });
  await api('/school/telefoonboom/nummer', { code: g3.g.code, token: g3.g.token, klasCode: klas.code, nummer: '+31 6 33333333' });
  const boom = await json(await lr(klas, '/school/telefoonboom/maak'));
  assert.equal(boom.aantal, 3);
  const st = await json(await lr(klas, '/school/telefoonboom/start', { bericht: 'Morgen begint school een uur later.' }));
  assert.equal(st.leraarBelt.length, 2, 'de leraar belt de eerste twee gezinnen');
  assert.ok(st.leraarBelt[0].nummer);
  // gezin 1 (plek 0) belt precies een tak: gezin 3 -- en ziet nooit de hele lijst
  const mijn = await json(await api('/school/telefoonboom/mijn', { code: g.code, token: g.token, klasCode: klas.code }));
  assert.equal(mijn.ikBel.length, 1);
  assert.equal(mijn.ikBel[0].nummer, '+31 6 33333333');
  assert.match(mijn.alarm.bericht, /een uur later/);
  await api('/school/telefoonboom/doorgegeven', { code: g.code, token: g.token, klasCode: klas.code });
  // het laatste gezin is een blad van de boom: niemand meer te bellen
  const blad = await json(await api('/school/telefoonboom/mijn', { code: g3.g.code, token: g3.g.token, klasCode: klas.code }));
  assert.equal(blad.ikBel.length, 0);
  const ov = await json(await lr(klas, '/school/telefoonboom'));
  assert.equal(ov.volgorde.filter(n => n.doorgegeven).length, 1);
  assert.equal(ov.volgorde[0].belt.length, 1, 'de leraar ziet de takken van de hele boom');
});
