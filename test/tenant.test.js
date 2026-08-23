/* DE TENANT CONTROL PLANE OVER DE LIJN -- de routes, het merk en de bootstrap.

   De regels van de spine en de brug staan in test/tenantspine.test.js; hier gaat
   het om wat er door de deur komt. Drie dingen die deze toets vastlegt en die
   niet uit een leesbeurt blijken:

   1. Het beheer van een tenant zit achter de EIGENAAR. Wie zijn werkruimte zelf
      aan een tenant kan hangen, kan hem aan andermans tenant hangen.
   2. Het merk komt als ONDERTEKEND manifest naar buiten, en het is gebonden aan
      de modus van de tenant. Verandert die, dan is het oude manifest niet meer
      geldig en komt de standaardstijl eruit -- met de reden erbij.
   3. De bootstrap noemt wat er NIET is. Een antwoord met een lege `quotas` erin
      leest als "geen verbruik"; een antwoord met `quotas` in `nietGebouwd` leest
      als een besluit.

   Draai los: node --experimental-sqlite --test test/tenant.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-tenant-'));
let srv, base, tech, ORG;
let ruimte, beheer, tweede, tweedeBeheer, lidToken;

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
function haal(pad, token) {
  return fetch(base + pad, { headers: token ? { Authorization: 'Bearer ' + token } : {} })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
async function maakRuimte(naam) {
  const r = await api('/api/bedrijf/werkruimte/maak', { naam });
  assert.equal(r.status, 200, 'werkruimte ' + naam + ' gemaakt');
  return { code: r.body.werkruimte, beheerToken: r.body.beheerToken };
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  tech = (await api('/api/techniek/inloggen', { login: 'roellie.i@gmail.com', wachtwoord: 'Imran' })).body.token;
  assert.ok(tech, 'de eigenaar komt op de technische pagina');
  const a = await maakRuimte('Imran Group Haarlem'); ruimte = a.code; beheer = a.beheerToken;
  const b = await maakRuimte('Van een andere klant'); tweede = b.code; tweedeBeheer = b.beheerToken;
  ORG = 'O-TEST';
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. het beheer van een tenant zit achter de eigenaar', async () => {
  const zonder = await api('/api/techniek/tenant', { org: ORG, naam: 'Imran Group' });
  assert.equal(zonder.status, 401, 'zonder inlog komt er niets doorheen');

  const uit = await api('/api/techniek/tenant', { org: ORG, naam: 'Imran Group' }, tech);
  assert.equal(uit.status, 200);
  assert.equal(uit.body.tenant.org, ORG);
  assert.equal(uit.body.tenant.modus, 'powered', 'de standaardmodus toont RTG nog');

  const bind = await api('/api/techniek/tenant/bind', { org: ORG, soort: 'werkruimte', code: ruimte }, tech);
  assert.equal(bind.status, 200);
  assert.deepEqual(bind.body.tenant.werkruimtes, [ruimte]);
});

test('2. "sovereign" is te koop noch te kiezen, en zegt waarom niet', async () => {
  const uit = await api('/api/techniek/tenant', { org: 'O-SOEV', naam: 'Soeverein', modus: 'sovereign' }, tech);
  assert.equal(uit.status, 400);
  assert.match(uit.body.error, /geen externe hosting/);

  const lijst = await haal('/api/techniek/tenant', tech);
  assert.deepEqual(lijst.body.modi, ['powered', 'private'], 'de lijst biedt hem ook niet aan');
  assert.match(lijst.body.sovereign, /TAKEN 4\.21/, 'maar hij staat er wel met de reden');
});

test('3. het merk komt ondertekend terug en draagt zijn eigen grens', async () => {
  const uit = await api('/api/techniek/tenant/merk',
    { org: ORG, merk: { naam: 'Imran Group One', payoff: 'Werk zoals het hoort', accent: '#1B7F5A', thema: 'licht' } }, tech);
  assert.equal(uit.status, 200);
  const m = uit.body.merk;
  assert.equal(m.merk.naam, 'Imran Group One');
  assert.equal(m.merk.accent, '#1B7F5A');
  assert.match(m.handtekening, /^[0-9a-f]{64}$/, 'ondertekend');
  assert.match(m.grens, /eigen domein bestaat hier niet/, 'en hij zegt zelf waar hij ophoudt');
  assert.match(m.herkomst, /Rahul Travel Group/, 'de herkomstregel staat er, ook in powered');

  const fout = await api('/api/techniek/tenant/merk', { org: ORG, merk: { accent: 'groen' } }, tech);
  assert.equal(fout.status, 400, 'een kleur die geen hexcode is, komt er niet in');
});

test('4. het merk is gebonden aan de modus; verandert die, dan geldt het niet meer', async () => {
  const voor = await api('/api/tenant/groepen', { werkruimte: ruimte, beheerToken: beheer });
  assert.equal(voor.body.merk.merk.naam, 'Imran Group One');
  assert.equal(voor.body.merk.let, undefined, 'zolang alles klopt is er niets te melden');

  await api('/api/techniek/tenant', { org: ORG, modus: 'private' }, tech);
  const na = await api('/api/tenant/groepen', { werkruimte: ruimte, beheerToken: beheer });
  assert.equal(na.body.merk.merk.naam, 'Imran Group', 'de standaard valt terug op de tenantnaam');
  assert.match(na.body.merk.let, /klopte niet met zijn eigen handtekening of met de modus/);
  assert.match(na.body.merk.herkomst, /Rahul Travel Group/,
    'ook in private blijft de herkomstregel staan -- die is niet uit te zetten');

  // opnieuw zetten onder de nieuwe modus, en hij geldt weer
  await api('/api/techniek/tenant/merk', { org: ORG, merk: { naam: 'Imran Group One' } }, tech);
  const weer = await api('/api/tenant/groepen', { werkruimte: ruimte, beheerToken: beheer });
  assert.equal(weer.body.merk.merk.naam, 'Imran Group One');
  assert.equal(weer.body.merk.modus, 'private');
});

test('5. de groepsafbeelding is van de beheerder van ZIJN werkruimte', async () => {
  const vreemd = await api('/api/tenant/groep',
    { werkruimte: ruimte, beheerToken: tweedeBeheer, groep: 'Haarlem-Managers', rol: 'directie' });
  assert.equal(vreemd.status, 403, 'het beheer-token van een andere werkruimte opent niets');

  const zonderTenant = await api('/api/tenant/groep',
    { werkruimte: tweede, beheerToken: tweedeBeheer, groep: 'G', rol: 'directie' });
  assert.equal(zonderTenant.status, 409, 'zonder tenant is er geen provider om uit te lezen');

  const rol = await api('/api/tenant/groep',
    { werkruimte: ruimte, beheerToken: beheer, groep: 'Haarlem-Managers', rol: 'bestaat-niet' });
  assert.equal(rol.status, 400, 'en de rol moet bestaan');

  const goed = await api('/api/tenant/groep',
    { werkruimte: ruimte, beheerToken: beheer, groep: 'Haarlem-Managers', rol: 'directie' });
  assert.equal(goed.status, 200);
  assert.equal(goed.body.groepen.length, 1);
  assert.match(goed.body.let, /Valt de groep weg, dan valt de rol weg/);

  const weer = await api('/api/tenant/groep',
    { werkruimte: ruimte, beheerToken: beheer, groep: 'Haarlem-Managers', rol: 'directie' });
  assert.equal(weer.status, 409, 'dezelfde afbeelding twee keer is geen tweede afbeelding');
});

test('6. de bootstrap noemt wat er niet is, en verzint geen quotum', async () => {
  const aanmeld = await api('/api/bedrijf/lid/aanmeld', { werkruimte: ruimte, naam: 'Imran' });
  lidToken = aanmeld.body.lidToken;
  const lidId = aanmeld.body.lidId;

  const wacht = await api('/api/tenant/bootstrap', { werkruimte: ruimte, lidToken });
  assert.equal(wacht.status, 403, 'aanmelden is niet binnen zijn -- ook niet voor de bootstrap');

  await api('/api/bedrijf/lid/besluit', { werkruimte: ruimte, beheerToken: beheer, lidId, akkoord: true });
  await api('/api/bedrijf/lid/rollen', { werkruimte: ruimte, beheerToken: beheer, lidId, rollen: ['hr'] });

  const b = (await api('/api/tenant/bootstrap', { werkruimte: ruimte, lidToken })).body.bootstrap;
  assert.equal(b.tenant.org, ORG);
  assert.equal(b.tenant.modus, 'private');
  assert.equal(b.werkruimte.code, ruimte);
  assert.equal(b.merk.merk.naam, 'Imran Group One', 'het merk zit in hetzelfde antwoord');
  assert.deepEqual(b.rollen, ['hr']);
  assert.ok(b.rechten.includes('mens.gevoelig'), 'de rechten volgen uit de rol');
  assert.equal(b.identiteit.via, 'lid-token');
  assert.equal(b.identiteit.beheerdDoorProvider, false, 'deze is met de hand toegelaten');

  const velden = b.nietGebouwd.map(x => x.veld);
  for (const v of ['entitlements', 'quotas', 'policies', 'trust', 'lifecycle'])
    assert.ok(velden.includes(v), v + ' staat als niet-gebouwd in het antwoord');
  assert.equal(b.quotas, undefined, 'en niet als lege waarde die als "geen verbruik" leest');
  assert.equal(b.entitlements, undefined);
  for (const n of b.nietGebouwd) assert.ok(n.reden && n.reden.length > 20, n.veld + ' heeft een reden');
});

test('7. een werkruimte zonder tenant werkt gewoon, en zegt dat hij er geen heeft', async () => {
  const a = await api('/api/bedrijf/lid/aanmeld', { werkruimte: tweede, naam: 'Los' });
  await api('/api/bedrijf/lid/besluit', { werkruimte: tweede, beheerToken: tweedeBeheer, lidId: a.body.lidId, akkoord: true });

  const b = (await api('/api/tenant/bootstrap', { werkruimte: tweede, lidToken: a.body.lidToken })).body.bootstrap;
  assert.equal(b.tenant.org, null);
  assert.equal(b.merk, null, 'geen tenant, geen merk -- en geen verzonnen standaardmerk');
  assert.match(b.tenant.let, /hoort bij geen enkele tenant/);
});

test('8. de bootstrap via de eigen RTG-sessie vertelt eerlijk dat er niets hangt', async () => {
  const u = Date.now().toString().slice(-8);
  const reg = await api('/api/auth/register', { name: 'Los lid', email: 'tn' + u + '@x.nl', phone: '06' + u,
    password: 'geheim12345', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  const mijn = await api('/api/tenant/bootstrap/mijn', {}, reg.body.token);
  assert.equal(mijn.status, 200);
  assert.equal(mijn.body.aantal, 0);
  assert.match(mijn.body.let, /geen enkele werkruimte/);

  const zonder = await api('/api/tenant/bootstrap/mijn', {});
  assert.equal(zonder.status, 401, 'en zonder sessie komt er niets');
});
