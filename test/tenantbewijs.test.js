/* DE BEWIJSPOORT -- geen enterprisebewering zonder bron.

   Dit bestand bestaat om een fout die dit huis echt heeft gemaakt:
   public/shared/enterprise-shell.js zette "Enterprise beveiligd · versleutelde
   werkruimte · audit gereed · Commercial" op het scherm, en geen van die vier
   had een bron. Het probleem was niet die ene schil maar dat een bewering een
   stuk TEKST was, en tekst kun je altijd typen.

   Vier beweringen die deze toets vastlegt:

   1. Elke bewering heeft OF een bron OF een reden waarom hij vandaag niet mag.
      Nooit allebei leeg -- dat is de vorm die het typen weer mogelijk maakt.
   2. Wat waar is, is waar OM EEN AANWIJSBARE REDEN: het contract, de
      SSO-koppeling, het journaal. Zet je de bron weg, dan valt de bewering.
   3. "Eigen domein" en "SLA" staan er ALTIJD, en altijd op nee. Weglaten leest
      als vergeten, en dan typt iemand ze een keer met de hand.
   4. De platformcijfers worden niet als tenantcijfers gepresenteerd.

   Draai los: node --experimental-sqlite --test test/tenantbewijs.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bewijs-'));
let srv, base, tech, ruimte, beheer, lidToken;

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
const bedrijf = (pad, body) => api('/api/bedrijf' + pad, body);
const rij = (s, id) => s.beweringen.find(b => b.id === id);

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  tech = (await api('/api/techniek/inloggen', { login: 'roellie.i@gmail.com', wachtwoord: 'Imran' })).body.token;
  const w = await bedrijf('/werkruimte/maak', { naam: 'Statusklant' });
  ruimte = w.body.werkruimte; beheer = w.body.beheerToken;
  const l = await bedrijf('/lid/aanmeld', { werkruimte: ruimte, naam: 'Pia' });
  lidToken = l.body.lidToken;
  await bedrijf('/lid/besluit', { werkruimte: ruimte, beheerToken: beheer, lidId: l.body.lidId, akkoord: true });
  await api('/api/techniek/tenant', { org: 'O-S', naam: 'Statusklant' }, tech);
  await api('/api/techniek/tenant/bind', { org: 'O-S', soort: 'werkruimte', code: ruimte }, tech);
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. elke bewering heeft een bron of een reden -- nooit allebei leeg', async () => {
  const r = await api('/api/tenant/status', { werkruimte: ruimte, beheerToken: beheer });
  assert.equal(r.status, 200);
  const s = r.body.status;
  assert.ok(s.beweringen.length >= 6, 'er staan beweringen in');
  for (const b of s.beweringen) {
    assert.ok(typeof b.mag === 'boolean', b.id + ' zegt ja of nee');
    if (b.mag) assert.ok(b.bron && b.bron.length > 5, b.id + ' staat op JA en noemt zijn bron');
    else assert.ok(b.reden && b.reden.length > 15, b.id + ' staat op NEE en zegt waarom');
  }
  assert.deepEqual(s.toonbaar, s.beweringen.filter(b => b.mag).map(b => b.id),
    'de toonbare lijst is precies wat op ja staat');
  assert.match(s.let, /mag alleen tonen wat hierboven op mag:true staat/);
});

test('2. het contract draagt zijn eigen bewering, en verliest hem als het verloopt', async () => {
  const lees = async () => rij((await api('/api/tenant/status', { werkruimte: ruimte, beheerToken: beheer })).body.status, 'lopend-contract');

  const voor = await lees();
  assert.equal(voor.mag, true);
  assert.match(voor.bron, /pakket proef/);

  await api('/api/techniek/tenant/contract', { org: 'O-S', tot: '2020-01-01' }, tech);
  const na = await lees();
  assert.equal(na.mag, false, 'een verlopen contract draagt de bewering niet meer');
  assert.equal(na.bron, null, 'en er blijft geen bron staan die nergens meer op slaat');
  assert.match(na.reden, /verlopen/);

  await api('/api/techniek/tenant/contract', { org: 'O-S', tot: null }, tech);
  assert.equal((await lees()).mag, true, 'verlengen brengt hem terug');
});

test('3. het auditspoor komt uit het journaal en niet uit een vinkje', async () => {
  const lees = async () => rij((await api('/api/tenant/status', { werkruimte: ruimte, beheerToken: beheer })).body.status, 'audit-spoor');

  /* EEN VERSE WERKRUIMTE HEEFT GEEN SPOOR, en de bewering hoort dat te zeggen
     in plaats van vast op ja te staan omdat er een journaalveld BESTAAT. Dit
     is precies het verschil tussen een bron en een vinkje. */
  const voor = await lees();
  assert.equal(voor.mag, false, 'er is nog niets gebeurd, dus er valt niets te auditen');
  assert.match(voor.reden, /nog geen enkele journaalregel/);

  const leden = await bedrijf('/leden', { werkruimte: ruimte, beheerToken: beheer });
  await bedrijf('/lid/rollen', { werkruimte: ruimte, beheerToken: beheer,
    lidId: leden.body.leden[0].id, rollen: ['projectleider'] });

  const na = await lees();
  assert.equal(na.mag, true, 'na een echte handeling wel');
  assert.match(na.bron, /journaalregels/, 'met het aantal erbij: ' + na.bron);
  assert.match(na.bron, /wie het journaal leest staat er zelf in/);
});

test('4. zonder identiteitsprovider bestaat de SSO-bewering niet', async () => {
  const s = (await api('/api/tenant/status', { werkruimte: ruimte, beheerToken: beheer })).body.status;
  const sso = rij(s, 'eigen-identiteitsprovider');
  assert.equal(sso.mag, false, 'deze tenant heeft geen koppeling');
  assert.match(sso.reden, /geen SSO-koppeling/);
});

test('5. "eigen domein" en "SLA" staan er altijd, en altijd op nee', async () => {
  const s = (await api('/api/tenant/status', { werkruimte: ruimte, beheerToken: beheer })).body.status;

  const dom = rij(s, 'eigen-domein');
  assert.equal(dom.mag, false);
  assert.match(dom.reden, /geen externe hosting/);
  assert.match(dom.reden, /4\.21/, 'met de weg ernaartoe');

  /* DE SLA IS EEN BEREKENING EN GEEN MENING: vier voorwaarden, en zolang er
     een ontbreekt komt hij niet op ja. Ze staan los opgesomd, want "nee"
     zonder te zeggen wat er ontbreekt is een dichte deur zonder sleutelgat. */
  const sla = rij(s, 'sla');
  assert.equal(sla.mag, false);
  assert.equal(sla.voorwaarden.length, 4);
  assert.equal(sla.voorwaarden.filter(v => v.ja).length, 2, 'twee van de vier zijn er wel');
  assert.match(sla.reden, /Er ontbreekt nog/);
  assert.match(sla.reden, /incidentproces/);
  assert.match(sla.reden, /herstelproef/);
  for (const v of sla.voorwaarden) assert.ok(v.reden && v.reden.length > 10, v.wat + ' legt zich uit');
});

test('6. de platformcijfers worden niet als tenantcijfers gepresenteerd', async () => {
  const s = (await api('/api/tenant/status', { werkruimte: ruimte, beheerToken: beheer })).body.status;
  assert.match(s.platformbreed.wat, /over de hele server en niet over deze organisatie/);
  assert.match(s.platformbreed.nietGemeten, /geen meting per organisatie/);

  /* De harde vorm van dezelfde eis: er staat NERGENS een beschikbaarheids- of
     uptimegetal in dit antwoord. Een cijfer dat de meting niet kan dragen, is
     preciezer dan de werkelijkheid en dus onwaar -- en het zou het eerste zijn
     wat een scherm oppikt. */
  const tekst = JSON.stringify(s);
  assert.ok(!/99[.,]\d/.test(tekst), 'geen 99,9-achtig getal in de tenantstand');
  assert.ok(!/uptime|beschikbaarheid *: *\d/i.test(tekst), 'en geen uptimecijfer');
});

test('7. een werkruimte zonder tenant krijgt geen verzonnen stand', async () => {
  const los = await bedrijf('/werkruimte/maak', { naam: 'Los' });
  const r = await api('/api/tenant/status',
    { werkruimte: los.body.werkruimte, beheerToken: los.body.beheerToken });
  assert.equal(r.status, 200);
  assert.equal(r.body.tenant, null);
  assert.match(r.body.let, /geen enkele organisatie met een contract/);
});
