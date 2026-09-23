/* RTG Werk OS: de UITGAVE, de tekengrens en functiescheiding (AUTHORITY.md
   fase 5, par. 5j).

   Zes beweringen, tegen een echte server:

   1. een uitgave draagt de indiener uit de SESSIE, en het beheer-token dient
      niets in;
   2. de indiener keurt zijn eigen uitgave niet goed -- ook niet namens een
      tweede recht dat hij draagt;
   3. elke uitgave eist minstens een goedkeuring namens geld.goedkeuren, ook
      zonder bedrijfsregel; een regel erbovenop telt mee;
   4. een tekengrens versmalt: erboven keurt een lid niet goed, eronder wel, en
      weghalen haalt de versmalling weg;
   5. betaald noteren kan pas na de goedkeuring, niet door de indiener, en met
      een kenmerk -- en er gaat geen geld;
   6. de stand is berekend en er is geen route die het bedrag wijzigt.

   Draai los: node --test test/bedrijfuitgave.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer, stop } = require('./helper');

let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bedrijfuitgave-'));
const api = (pad, body) => fetch(BASE + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

let W, B, FIN, DIR, CFO;
const LIDID = {};
async function lid(naam, rollen) {
  const a = (await api('/api/bedrijf/lid/aanmeld', { werkruimte: W, naam })).body;
  await api('/api/bedrijf/lid/besluit', { werkruimte: W, beheerToken: B, lidId: a.lidId, akkoord: true });
  await api('/api/bedrijf/lid/rollen', { werkruimte: W, beheerToken: B, lidId: a.lidId, rollen });
  LIDID[a.lidToken] = a.lidId;
  return { werkruimte: W, lidToken: a.lidToken };
}
const maak = (wie, bedrag, extra) => api('/api/bedrijf/uitgave/maak', Object.assign({ omschrijving: 'Laptops voor het team',
  begunstigde: 'Leverancier BV', bedrag, factuur: 'F-2026-17' }, extra || {}, wie));
const keur = (wie, id, recht) => api('/api/bedrijf/keur', Object.assign({ soort: 'uitgave', id, recht: recht || 'geld.goedkeuren' }, wie));

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const w = (await api('/api/bedrijf/werkruimte/maak', { naam: 'RTG Uitgave', land: 'NL' })).body;
  W = w.werkruimte; B = w.beheerToken;
  FIN = await lid('Fenna', ['financieel']);
  DIR = await lid('Diederik', ['directie']);
  CFO = await lid('Chris', ['directie']);
});
test.after(() => {
  stop(child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. de indiener komt uit de sessie, en het beheer-token dient niets in', async () => {
  const beheer = await maak({ werkruimte: W, beheerToken: B }, 100);
  assert.equal(beheer.status, 403, JSON.stringify(beheer.body));
  const u = await maak(FIN, 100, { door: 'Iemand Anders' });
  assert.equal(u.status, 200, JSON.stringify(u.body));
  assert.equal(u.body.uitgave.door, 'Fenna', 'de naam in het verzoek telt niet');
  assert.equal(u.body.uitgave.stand, 'wacht op goedkeuring');
  assert.deepEqual(u.body.uitgave.ontbreekt, ['geld.goedkeuren'], 'ook zonder regel een goedkeuring');
  assert.equal((await maak(FIN, 0)).status, 400, 'geen uitgave van nul');
});

test('2-3. de indiener keurt niet goed, een ander wel; een regel telt mee', async () => {
  const u = (await maak(DIR, 500)).body.uitgave;
  const zelf = await keur(DIR, u.id);
  assert.equal(zelf.status, 409, 'de directeur diende in en draagt geld.goedkeuren, maar keurt niet zelf: ' + JSON.stringify(zelf.body));
  assert.match(zelf.body.error, /Functiescheiding/);
  const ander = await keur(CFO, u.id);
  assert.equal(ander.status, 200, JSON.stringify(ander.body));
  assert.match(ander.body.let, /goedkeuringen zijn rond/, 'een goedkeuring van een ander maakt hem rond');
  const lijst = (await api('/api/bedrijf/uitgaven', FIN)).body.uitgaven;
  assert.equal(lijst.find(x => x.id === u.id).stand, 'goedgekeurd');

  // een bedrijfsregel boven 1000 euro eist daarnaast de jurist
  const regel = await api('/api/bedrijf/regel/zet', { werkruimte: W, beheerToken: B, soort: 'uitgave', boven: 1000, eist: ['recht'] });
  assert.equal(regel.status, 200, JSON.stringify(regel.body));
  const groot = (await maak(FIN, 2500)).body.uitgave;
  assert.deepEqual(groot.ontbreekt.sort(), ['geld.goedkeuren', 'recht']);
  assert.equal((await keur(DIR, groot.id)).status, 200);
  const stand = (await api('/api/bedrijf/keuring', Object.assign({ soort: 'uitgave', id: groot.id }, FIN))).body;
  assert.deepEqual(stand.ontbreekt, ['recht'], 'de regel houdt hem vast tot de jurist keurt');
});

test('4. een tekengrens versmalt, en weghalen haalt de versmalling weg', async () => {
  const u = (await maak(FIN, 800)).body.uitgave;
  const zet = await api('/api/bedrijf/lid/tekengrens', { werkruimte: W, beheerToken: B, lidId: LIDID[CFO.lidToken], bedrag: 500 });
  assert.equal(zet.status, 200, JSON.stringify(zet.body));
  const boven = await keur(CFO, u.id);
  assert.equal(boven.status, 403, JSON.stringify(boven.body));
  assert.match(boven.body.error, /tekengrens van 500\.00/);
  const klein = (await maak(FIN, 400)).body.uitgave;
  assert.equal((await keur(CFO, klein.id)).status, 200, 'onder de grens gaat het gewoon');
  await api('/api/bedrijf/lid/tekengrens', { werkruimte: W, beheerToken: B, lidId: LIDID[CFO.lidToken], bedrag: '' });
  assert.equal((await keur(CFO, u.id)).status, 200, 'zonder grens keurt hij weer binnen zijn rechten');
});

test('5-6. betaald noteren: na goedkeuring, niet door de indiener, met kenmerk', async () => {
  const u = (await maak(FIN, 120)).body.uitgave;
  const teVroeg = await api('/api/bedrijf/uitgave/betaald', Object.assign({ id: u.id, kenmerk: 'BANK-1' }, DIR));
  assert.equal(teVroeg.status, 409, 'nog niet goedgekeurd');
  assert.equal((await keur(DIR, u.id)).status, 200);
  const zelf = await api('/api/bedrijf/uitgave/betaald', Object.assign({ id: u.id, kenmerk: 'BANK-1' }, FIN));
  assert.equal(zelf.status, 409, 'de indiener vinkt zijn eigen betaling niet af');
  assert.equal((await api('/api/bedrijf/uitgave/betaald', Object.assign({ id: u.id }, CFO))).status, 400, 'zonder kenmerk');
  const ok = await api('/api/bedrijf/uitgave/betaald', Object.assign({ id: u.id, kenmerk: 'BANK-1' }, CFO));
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.uitgave.stand, 'betaald');
  assert.match(ok.body.let, /niets overgemaakt/);
  assert.equal((await api('/api/bedrijf/uitgave/betaald', Object.assign({ id: u.id, kenmerk: 'BANK-2' }, DIR))).status, 409, 'een keer');
  // er is geen route die het bedrag wijzigt
  const wijzig = await api('/api/bedrijf/uitgave/zet', Object.assign({ id: u.id, bedrag: 1 }, FIN));
  assert.equal(wijzig.status, 404);
});
