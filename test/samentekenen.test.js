/* RTG Werk OS: SAMEN TEKENEN (server/bedrijf/samentekenen.js).

   Besluit van de eigenaar (24 september 2026): het bedrijf kiest zelf hoe het
   bestuur uit de concerngraaf meetelt bij een uitgave -- versmallen, bestuur of
   een drempel. Tegen een echte server, met echte RTG-accounts:

   1. de tekenwijze kiest alleen de eigenaar van de gekoppelde entiteit, en
      loskoppelen ook -- anders is loskoppelen de weg om het bestuur te ontlopen;
   2. versmallen (standaard): een gezamenlijk bevoegde bestuurder keurt niet in
      zijn eentje goed, twee samen wel, en een gewoon lid gewoon;
   3. bestuur: zonder een bevoegde bestuurder is een uitgave niet rond;
   4. drempel: onder de drempel versmallen, erboven bestuur;
   5. is voor het bedrag niemand bevoegd, dan zegt de stand dat hardop.

   Draai los: node --test test/samentekenen.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer, stop } = require('./helper');

let BASE, child, W, B, E, FIN, OWN, S1, S2, A1;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-samentekenen-'));
const api = (pad, body, token) => fetch(BASE + pad, { method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

let n = 0;
async function rtgAccount(naam) {
  n += 1;
  const u = (Date.now() + n * 7919).toString().slice(-8);
  const r = (await api('/api/auth/register', { name: naam, email: 'samen' + u + '@voorbeeld.test', phone: '06' + u,
    password: 'geheim123', geboortedatum: '1985-05-05', tier: 'rtg', pasApp: 'rtg' })).body;
  const me = (await api('/api/auth/me', {}, r.token)).body;
  return { token: r.token, codenaam: me.user.codename };
}
async function lid(naam, rollen, rtg) {
  const a = (await api('/api/bedrijf/lid/aanmeld', { werkruimte: W, naam })).body;
  await api('/api/bedrijf/lid/besluit', { werkruimte: W, beheerToken: B, lidId: a.lidId, akkoord: true });
  await api('/api/bedrijf/lid/rollen', { werkruimte: W, beheerToken: B, lidId: a.lidId, rollen });
  const wie = { werkruimte: W, lidToken: a.lidToken };
  if (rtg) {
    const k = await api('/api/bedrijf/lid/koppel', wie, rtg.token);
    assert.equal(k.status, 200, 'het lid hangt aan zijn RTG-account: ' + JSON.stringify(k.body));
    wie.rtg = rtg;
  }
  return wie;
}
const bare = (wie) => ({ werkruimte: wie.werkruimte, lidToken: wie.lidToken });
const maak = async (bedrag) => (await api('/api/bedrijf/uitgave/maak', Object.assign({ omschrijving: 'Machines',
  begunstigde: 'Fabriek BV', bedrag }, bare(FIN)))).body.uitgave;
const keur = (wie, id) => api('/api/bedrijf/keur', Object.assign({ soort: 'uitgave', id, recht: 'geld.goedkeuren' }, bare(wie)));
const stand = async (id) => (await api('/api/bedrijf/uitgaven', bare(FIN))).body.uitgaven.find(x => x.id === id);
const wijze = (wie, body) => api('/api/bedrijf/werkruimte/tekenwijze', Object.assign({}, body, bare(wie)));

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const w = (await api('/api/bedrijf/werkruimte/maak', { naam: 'Samen BV', land: 'NL' })).body;
  W = w.werkruimte; B = w.beheerToken;
  FIN = await lid('Fenna', ['financieel']);
  OWN = await lid('Olga', ['directie'], await rtgAccount('Olga Samen'));
  S1 = await lid('Sam', ['directie'], await rtgAccount('Sam Samen'));
  S2 = await lid('Sara', ['directie'], await rtgAccount('Sara Samen'));
  A1 = await lid('Ada', ['directie'], await rtgAccount('Ada Samen'));
  E = (await api('/api/concern/entiteit/nieuw', { naam: 'Samen Holding BV', land: 'NL', rechtsvorm: 'bv' }, OWN.rtg.token)).body.entiteit.id;
  const feit = (wie, extra) => api('/api/concern/feit/zet', { entiteit: E, soort: 'bestuurder', waarde: 'directeur',
    sleutel: wie.rtg.codenaam, bronSoort: 'mens', extra }, OWN.rtg.token);
  assert.equal((await feit(S1, { bevoegd: 'gezamenlijk', tekenlimiet: 2000 })).status, 200);
  assert.equal((await feit(S2, { bevoegd: 'gezamenlijk', tekenlimiet: 2000 })).status, 200);
  assert.equal((await feit(A1, { bevoegd: 'alleen', tekenlimiet: 1000 })).status, 200);
});
test.after(() => {
  stop(child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. de tekenwijze en het loskoppelen zijn van de eigenaar van de entiteit', async () => {
  assert.equal((await wijze(OWN, { wijze: 'bestuur' })).status, 409, 'zonder koppeling valt er niets te kiezen');
  assert.equal((await api('/api/bedrijf/werkruimte/entiteit', Object.assign({ entiteitId: E }, bare(OWN)))).status, 200);
  const ander = await wijze(S1, { wijze: 'versmallen' });
  assert.equal(ander.status, 403, 'een bestuurder die zelf goedkeurt, zet het regime niet: ' + JSON.stringify(ander.body));
  assert.equal(ander.body.recht, 'werkruimte', 'en blijft op het scherm ingelogd');
  assert.equal((await wijze(OWN, { wijze: 'soms' })).status, 400);
  assert.equal((await wijze(OWN, { wijze: 'drempel' })).status, 400, 'een drempel zonder bedrag');
  const los = await api('/api/bedrijf/werkruimte/entiteit', Object.assign({ entiteitId: '' }, bare(S1)));
  assert.equal(los.status, 404, 'loskoppelen is niet de weg om het bestuur te ontlopen: ' + JSON.stringify(los.body));
  const lijst = (await api('/api/bedrijf/uitgaven', bare(FIN))).body;
  assert.equal(lijst.tekenwijze.wijze, 'versmallen', 'de standaard');
  assert.equal(lijst.tekenwijze.gekoppeld, true);
});

test('2. versmallen: een gezamenlijk bevoegde keurt niet alleen goed, twee samen wel, een gewoon lid gewoon', async () => {
  const u = await maak(500);
  const eerste = await keur(S1, u.id);
  assert.equal(eerste.status, 200, JSON.stringify(eerste.body));
  assert.deepEqual(eerste.body.ontbreekt, ['een tweede gezamenlijk bevoegde bestuurder']);
  assert.equal((await stand(u.id)).stand, 'wacht op goedkeuring');
  const betaal = await api('/api/bedrijf/uitgave/betaald', Object.assign({ id: u.id, kenmerk: 'B-1' }, bare(OWN)));
  assert.equal(betaal.status, 409, 'wat niet rond is, gaat niet als betaald');
  assert.deepEqual((await keur(S2, u.id)).body.ontbreekt, []);
  assert.equal((await stand(u.id)).stand, 'goedgekeurd');

  const v = await maak(500);
  assert.deepEqual((await keur(OWN, v.id)).body.ontbreekt, [], 'een lid dat geen bestuurder is, keurt zoals altijd');
  const a = await maak(500);
  assert.deepEqual((await keur(A1, a.id)).body.ontbreekt, [], 'een alleen bevoegde ook');
});

test('3-5. bestuur en drempel, en wie er voor een bedrag niet is', async () => {
  assert.equal((await wijze(OWN, { wijze: 'bestuur' })).status, 200);
  const u = await maak(500);
  const gewoon = await keur(OWN, u.id);
  assert.equal(gewoon.body.ontbreekt.length, 1, JSON.stringify(gewoon.body));
  assert.match(gewoon.body.ontbreekt[0], /het bestuur/);
  assert.deepEqual((await keur(A1, u.id)).body.ontbreekt, [], 'met een alleen bevoegde bestuurder is hij rond');
  const paar = await maak(500);
  assert.deepEqual((await keur(S1, paar.id)).body.ontbreekt, ['een tweede gezamenlijk bevoegde bestuurder'],
    'onder bestuur telt een gezamenlijk bevoegde ook niet alleen');
  assert.deepEqual((await keur(S2, paar.id)).body.ontbreekt, [], 'twee gezamenlijk bevoegden samen zijn het bestuur');

  const d = await wijze(OWN, { wijze: 'drempel', drempel: 600 });
  assert.equal(d.status, 200, JSON.stringify(d.body));
  assert.equal(d.body.drempel, '600.00');
  const onder = await maak(500);
  assert.deepEqual((await keur(OWN, onder.id)).body.ontbreekt, [], 'onder de drempel versmalt het bestuur alleen');
  const boven = await maak(700);
  assert.match((await keur(OWN, boven.id)).body.ontbreekt[0], /het bestuur/, 'erboven beslist het bestuur mee');

  await wijze(OWN, { wijze: 'bestuur' });
  const groot = await maak(5000);
  const niemand = await keur(OWN, groot.id);
  assert.match(niemand.body.ontbreekt[0], /niemand bevoegd/, 'de stand zegt waarom hij nooit rond komt: ' + JSON.stringify(niemand.body));

  assert.equal((await api('/api/bedrijf/werkruimte/entiteit', Object.assign({ entiteitId: '' }, bare(OWN)))).status, 200,
    'de eigenaar koppelt wel los');
  const los = await maak(500);
  assert.deepEqual((await keur(S1, los.id)).body.ontbreekt, [], 'zonder koppeling geldt geen bestuur');
});
