/* De toegangseis voor nieuwe partners: alleen een bedrijf waar minstens een
   persoon een Business Pass heeft, kan een bedrijfscode krijgen. Zonder pass
   geen aanvraag; en het kantoor keurt alleen aanvragen met pass-bewijs goed.
   Draai: node --experimental-sqlite --test test/partnerpas.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-pp-'));
let child, businessToken, rtgToken, officeToken, eigenaarToken;
let partnerCode, partnerPin;

async function api(pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return fetch(BASE + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
}
const json = r => r.json();
const aanvraag = extra => Object.assign({
  company: 'Bodega Norte', type: 'restaurant', city: 'Ibiza',
  contactName: 'Pep Serra', email: 'pep@bodeganorte.example', akkoord: true,
  bevoegd: true, waarheidsgetrouw: true, kvkNummer: '68750110',
  vestigingsnummer: '000037178598', bewijzen: { nvwa: 'NVWA-IBIZA-2026' }
}, extra);

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  businessToken = (await json(await api('/api/login', { username: 'Rahul', password: 'Imran' }))).token;
  rtgToken = (await json(await api('/api/login', { tier: 'rtg' }))).token;
  officeToken = (await json(await api('/api/office/login', { code: 'RTG-OFFICE' }))).token;
  eigenaarToken = (await json(await api('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran' }))).token;
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('zonder Business Pass geen aanvraag (en dus geen code)', async () => {
  const kaal = await api('/api/partner/apply', aanvraag());
  assert.equal(kaal.status, 403);
  assert.match((await kaal.json()).error, /Business Pass/);
  // een gewone RTG Pass telt niet: het moet een Business Pass zijn
  const rtg = await api('/api/partner/apply', aanvraag({ passToken: rtgToken }));
  assert.equal(rtg.status, 403);
});

test('met Business Pass: aanvraag met pass-bewijs, officiële controles en daarna pas een code', async () => {
  const ok = await api('/api/partner/apply', aanvraag({ passToken: businessToken }));
  assert.equal(ok.status, 200);
  // het kantoor ziet de aanvraag met het pass-bewijs en keurt goed
  const st = await json(await api('/api/office/state', {}, officeToken));
  const a = (st.state.partnerApplications || []).find(x => x.company === 'Bodega Norte');
  assert.ok(a && a.businessPass && a.businessPass.key === 'business', 'het pass-bewijs zit op de aanvraag');
  assert.equal((await api('/api/office/partner/decide', { id: a.id, action: 'goedkeuren' }, officeToken)).status, 403,
    'de gedeelde kantoordeur mag geen partners toelaten');
  assert.equal((await api('/api/office/partner/decide', { id: a.id, action: 'goedkeuren' }, eigenaarToken)).status, 409,
    'ook de eigenaar kan de officiële controles niet overslaan');
  for (const eis of a.toelating.eisen) {
    const uitkomst = eis.id === 'vergunningenscan' ? 'niet_van_toepassing' : 'geverifieerd';
    const check = await api('/api/office/partner/controle', { id: a.id, onderdeel: eis.id,
      uitkomst, referentie: uitkomst === 'niet_van_toepassing' ? 'Geen extra lokale vergunning nodig' : 'Officieel register ' + eis.id }, eigenaarToken);
    assert.equal(check.status, 200, eis.id + ': ' + await check.text());
  }
  const besluit = await json(await api('/api/office/partner/decide', { id: a.id, action: 'goedkeuren' }, eigenaarToken));
  assert.ok(besluit.code || besluit.ok, 'goedkeuren levert een bedrijfscode op');
  partnerCode = besluit.code; partnerPin = besluit.pin;
});

test('een buitenlands bedrijf met wereldhandel krijgt het volledige internationale dossier', async () => {
  const wereldwijd = aanvraag({ company: 'Belgica Global Trade', type: 'zzp', city: 'Antwerpen',
    email: 'trade@belgica.example', landCode: 'BE', registratieNummer: 'BE 0123.456.789',
    registerBron: 'https://e-justice.europa.eu/topics/registers-business-insolvency-land/business-registers-search-company-eu/general-information-find-company_en',
    internationaleHandel: true, goederen: true, euBtw: true, douane: true,
    bewijzen: { vies: 'BE0123456789', eori: 'BE0123456789', goederencode: 'HS 0901 · BE naar JP' },
    passToken: businessToken });
  const ok = await api('/api/partner/apply', wereldwijd);
  assert.equal(ok.status, 200, await ok.text());
  const st = await json(await api('/api/office/state', {}, officeToken));
  const a = (st.state.partnerApplications || []).find(x => x.company === 'Belgica Global Trade');
  assert.equal(a.registratie.landCode, 'BE');
  assert.equal(a.registratie.sleutel, 'BE:BE0123456789');
  assert.equal(a.registratie.voorcontrole.status, 'handmatig');
  const ids = a.toelating.eisen.map(e => e.id);
  for (const id of ['handelsregister', 'sancties_vn', 'sancties_eu', 'handelsscope',
    'lokale_handelsregels', 'vies', 'eori', 'goederencode']) assert.ok(ids.includes(id), id);
  assert.equal((await api('/api/office/partner/decide', { id: a.id, action: 'goedkeuren' }, eigenaarToken)).status, 409,
    'ook een buitenlandse aanvraag kan de internationale controles niet overslaan');
});

test('het kantoor ziet de automatische officiële handelsbronnen en hun update-interval', async () => {
  assert.equal((await api('/api/office/partner/regels')).status, 401);
  const regels = await json(await api('/api/office/partner/regels', {}, officeToken));
  assert.equal(regels.automatisch, true);
  assert.ok(regels.bronnen.length >= 10);
  assert.ok(regels.bronnen.some(b => b.id === 'sancties_vn'));
  assert.ok(regels.bronnen.some(b => b.id === 'dual_use'));
});

test('partner schorsen trekt bestaande toegang onmiddellijk in', async () => {
  const roster = await json(await api('/api/supplier/roster', { code: partnerCode }));
  const manager = roster.staff.find(x => x.role === 'manager');
  const login = await json(await api('/api/supplier/login', { code: partnerCode, staffId: manager.id, pin: partnerPin }));
  assert.ok(login.token, 'de nieuwe manager kan voor schorsing naar binnen');
  const stop = await api('/api/office/partner/status', { code: partnerCode, status: 'geschorst', reden: 'Geautomatiseerde toegangstest' }, eigenaarToken);
  assert.equal(stop.status, 200);
  assert.equal((await api('/api/supplier/state', {}, login.token)).status, 401, 'bestaande sessie is ingetrokken');
  assert.equal((await api('/api/supplier/login', { code: partnerCode, staffId: manager.id, pin: partnerPin })).status, 403, 'nieuwe toegang blijft dicht');
  assert.equal((await api('/api/office/partner/status', { code: partnerCode, status: 'actief' }, eigenaarToken)).status, 200, 'boardroom kan een schorsing gecontroleerd opheffen');
});
