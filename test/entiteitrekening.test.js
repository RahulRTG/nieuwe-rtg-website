/* DE RTG-REKENING OP NAAM VAN EEN ENTITEIT (kern/bank/entiteit.js), en de
   uitgave uit het Werk OS die ervan betaalt (bedrijf/entiteitbetaling.js).
   Besluit van de eigenaar, 24 september 2026. Tegen een echte server:

   1. openen vraagt een KYC-minimum (registratie + een herkende bestuurder), en
      RTG moet het product eerst openzetten -- standaard dicht;
   2. een per entiteit, alleen door de eigenaar, en niet langs de kantoorroute;
   3. geld gaat alleen af langs een uitgave die rond is, betaald door een ander
      dan de indiener, en een tweede druk betaalt niet twee keer;
   4. "betaald noteren" kan bij deze betaalwijze niet: het geld komt echt van de
      rekening, of er staat niets.

   Draai los: node --test test/entiteitrekening.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer, stop, kantoorAlsPersoon, kantoorKoppelBody } = require('./helper');

let srv, BAAS, W, B, E, OWN, FIN, ANDER;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-entiteitrekening-'));
const api = (pad, body, token) => fetch(srv.base + pad, { method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
  body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
let n = 0;
async function rtgAccount(naam) {
  n += 1;
  const u = (Date.now() + n * 7919).toString().slice(-8);
  const r = (await api('/api/auth/register', { name: naam, email: 'ent' + u + '@voorbeeld.test', phone: '06' + u,
    password: 'geheim123', geboortedatum: '1985-05-05', tier: 'rtg', pasApp: 'rtg' })).body;
  const me = (await api('/api/auth/me', {}, r.token)).body;
  return { token: r.token, codenaam: me.user.codename };
}
async function lid(naam, rollen, rtg) {
  const a = (await api('/api/bedrijf/lid/aanmeld', { werkruimte: W, naam })).body;
  await api('/api/bedrijf/lid/besluit', { werkruimte: W, beheerToken: B, lidId: a.lidId, akkoord: true });
  await api('/api/bedrijf/lid/rollen', { werkruimte: W, beheerToken: B, lidId: a.lidId, rollen });
  const wie = { werkruimte: W, lidToken: a.lidToken };
  if (rtg) { assert.equal((await api('/api/bedrijf/lid/koppel', wie, rtg.token)).status, 200); wie.rtg = rtg; }
  return wie;
}
const bare = (w) => ({ werkruimte: w.werkruimte, lidToken: w.lidToken });

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  BAAS = await kantoorAlsPersoon(srv.base, 'RTG-OFFICE');
  assert.ok(BAAS, 'de eigenaar en zijn kantoorsessie');
  const w = (await api('/api/bedrijf/werkruimte/maak', { naam: 'Entiteit BV werkruimte', land: 'NL' })).body;
  W = w.werkruimte; B = w.beheerToken;
  OWN = await lid('Olga', ['directie'], await rtgAccount('Olga Entiteit'));
  FIN = await lid('Fenna', ['financieel']);
  ANDER = await rtgAccount('Vreemde Entiteit');
  E = (await api('/api/concern/entiteit/nieuw', { naam: 'Rekening Holding BV', land: 'NL', rechtsvorm: 'bv' }, OWN.rtg.token)).body.entiteit.id;
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('1-2. KYC-minimum, RTG zet het product open, een per entiteit', async () => {
  const open = () => api('/api/concern/rekening/open', { entiteit: E }, OWN.rtg.token);
  const kaal = await open();
  assert.equal(kaal.status, 409, JSON.stringify(kaal.body));
  assert.equal(kaal.body.mist.length, 2, 'registratie en herkende bestuurder ontbreken allebei');

  await api('/api/concern/entiteit/registratie', { entiteit: E, nummer: '12345678', register: 'KvK', bronSoort: 'mens' }, OWN.rtg.token);
  assert.equal((await api('/api/concern/feit/zet', { entiteit: E, soort: 'bestuurder', waarde: 'directeur', sleutel: OWN.rtg.codenaam,
    bronSoort: 'mens', extra: { bevoegd: 'alleen' } }, OWN.rtg.token)).status, 200);
  const dicht = await open();
  assert.equal(dicht.status, 409, 'RTG heeft het product nog niet opengezet: ' + JSON.stringify(dicht.body));
  assert.match(dicht.body.error, /nog niet opengezet/);

  assert.equal((await api('/api/office/bank/entiteitrekening', {}, BAAS)).body.open, false, 'standaard dicht');
  const reg = (await api('/api/auth/register', { name: 'Medewerker Ent', email: 'mw' + Date.now() + '@voorbeeld.test',
    password: 'geheim123', geboortedatum: '1985-05-05', pasApp: 'rtg' })).body;
  assert.equal((await api('/api/account/koppel', await kantoorKoppelBody(srv.base, reg.token), reg.token)).status, 200);
  assert.equal((await api('/api/office/boardroom/toegang/geef', { codenaam: reg.state.user.codename }, BAAS)).status, 200);
  const mede = (await api('/api/account/start', { rol: 'kantoor' }, reg.token)).body.token;
  assert.equal((await api('/api/office/bank/entiteitrekening/zet', { open: true }, mede)).status, 403,
    'wie de boardroom in mag, is de eigenaar nog niet');
  assert.equal((await api('/api/office/bank/entiteitrekening/zet', { open: true }, BAAS)).status, 200);
  const ok = await open();
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.match(ok.body.rekening.iban, /^NL/);
  assert.equal((await open()).status, 409, 'een rekening per entiteit');

  assert.equal((await api('/api/concern/rekening', { entiteit: E }, ANDER.token)).status, 404, 'een ander ziet hem niet');
  const eigen = await api('/api/concern/rekening', { entiteit: E }, OWN.rtg.token);
  assert.equal(eigen.body.rekening.iban, ok.body.rekening.iban);
  const kantoor = await api('/api/office/bank/rekening/open', { codenaam: 'entiteit:' + E, soort: 'zakelijk' }, BAAS);
  assert.notEqual(kantoor.status, 200, 'de kantoorroute opent geen rekening op naam van een entiteit: ' + JSON.stringify(kantoor.body));
});

test('3-4. betalen langs een uitgave die rond is, een keer, door een ander dan de indiener', async () => {
  const rek = (await api('/api/concern/rekening', { entiteit: E }, OWN.rtg.token)).body.rekening;
  // geld op de rekening van de entiteit: vanaf de eigen rekening van de eigenaar
  assert.equal((await api('/api/office/bank/leden', { aan: true, naam: 'boardroom' }, BAAS)).body.ledenAan, true, 'de leden-bank live');
  await api('/api/bank/akkoord', {}, OWN.rtg.token);
  const po = await api('/api/bank/rekening/open', { soort: 'betaal' }, OWN.rtg.token);
  assert.equal(po.status, 200, 'een eigen rekening voor de eigenaar: ' + JSON.stringify(po.body));
  const prive = po.body.rekening;
  const stort = await api('/api/bank/storten', { iban: prive.iban, centen: 50000, idem: 'stort-1' }, OWN.rtg.token);
  assert.equal(stort.status, 200, JSON.stringify(stort.body));
  assert.equal((await api('/api/bank/overboek', { vanIban: prive.iban, naarIban: rek.iban, centen: 30000, idem: 'over-1' }, OWN.rtg.token)).status, 200);

  assert.equal((await api('/api/bedrijf/werkruimte/betaalwijze', Object.assign({ wijze: 'entiteit' }, bare(OWN)))).status, 409,
    'zonder koppeling geen betaalwijze entiteit');
  assert.equal((await api('/api/bedrijf/werkruimte/entiteit', Object.assign({ entiteitId: E }, bare(OWN)))).status, 200);
  assert.equal((await api('/api/bedrijf/werkruimte/betaalwijze', Object.assign({ wijze: 'entiteit' }, bare(OWN)))).status, 200);

  const u = (await api('/api/bedrijf/uitgave/maak', Object.assign({ omschrijving: 'Drukwerk', begunstigde: 'Drukkerij BV',
    bedrag: 120, iban: prive.iban }, bare(FIN)))).body.uitgave;
  const betaal = (wie) => api('/api/bedrijf/uitgave/betaal', Object.assign({ id: u.id }, bare(wie)));
  assert.equal((await betaal(OWN)).status, 409, 'wat niet rond is, gaat niet van de rekening');
  assert.equal((await api('/api/bedrijf/keur', Object.assign({ soort: 'uitgave', id: u.id, recht: 'geld.goedkeuren' }, bare(OWN)))).status, 200);
  const noteer = await api('/api/bedrijf/uitgave/betaald', Object.assign({ id: u.id, kenmerk: 'X' }, bare(OWN)));
  assert.equal(noteer.status, 409, 'bij deze betaalwijze wordt niets genoteerd dat niet echt gebeurde');
  const zelf = await api('/api/bedrijf/uitgave/betaal', Object.assign({ id: u.id }, bare(FIN)));
  assert.equal(zelf.status, 409, 'de indiener betaalt niet: ' + JSON.stringify(zelf.body));
  assert.match(zelf.body.error, /diende deze uitgave in/);

  const r = await betaal(OWN);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.uitgave.betaald.via, 'entiteit');
  const na = (await api('/api/concern/rekening', { entiteit: E }, OWN.rtg.token)).body.rekening;
  assert.equal(na.saldoCenten, 30000 - 12000, 'precies het bedrag van de uitgave ging eraf');
  assert.equal((await betaal(OWN)).status, 409, 'een tweede druk betaalt niet twee keer');
  const nog = (await api('/api/concern/rekening', { entiteit: E }, OWN.rtg.token)).body.rekening;
  assert.equal(nog.saldoCenten, na.saldoCenten);
  const lijst = (await api('/api/bedrijf/uitgaven', bare(OWN))).body.uitgaven.find(x => x.id === u.id);
  assert.equal(lijst.stand, 'betaald');
});
