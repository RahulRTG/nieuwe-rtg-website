/* De verplichte onboarding + het contract: elk account vult de standaardgegevens
   in (paspoort, e-mail, telefoon, adres, ...) en tekent het contract. De eigenaar
   past de eisen en het contract aan (met AI in gewone taal, hier via de ingebouwde
   parser omdat er geen AI-sleutel is), en elke leverancier kan hetzelfde voor de
   eigen scope. Draai: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const OWNER = 'baas' + Date.now().toString().slice(-6) + '@rtg-test.nl';

function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

let srv, base, lid, brand;

test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-onb-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, DEMO_SUPPLIER: 'KIKUNOI', RTG_OWNER_EMAIL: OWNER } });
  base = srv.base;
  brand = (await api(base, '/api/supplier/login', { username: 'rahul', password: 'Imran' })).body.token;
});
test.after(() => stop(srv && srv.child));

async function registreer(email) {
  const u = Date.now().toString().slice(-8) + Math.floor(Math.random() * 99);
  return (await api(base, '/api/auth/register', { name: 'Reiziger ' + u, email, phone: '06' + u.slice(0, 8),
    password: 'geheim123', geboortedatum: '1990-01-01', land: 'NL', tier: 'rtg', pasApp: 'rtg' })).body.token;
}

test('1. een nieuw account moet standaardgegevens invullen en het contract tekenen', async () => {
  lid = await registreer('reiziger' + Date.now().toString().slice(-7) + '@x.nl');
  const st = (await api(base, '/api/onboarding/status', {}, lid)).body;
  assert.equal(st.klaar, false, 'net geregistreerd: onboarding nog niet rond');
  // naam/e-mail/telefoon/geboortedatum/land zijn geprefilld uit het account
  const ingevuld = new Set(st.velden.filter(v => v.ingevuld).map(v => v.id));
  assert.ok(ingevuld.has('naam') && ingevuld.has('email') && ingevuld.has('telefoon'), 'accountgegevens zijn geprefilld');
  // adres/postcode/woonplaats/nationaliteit/paspoort ontbreken nog
  assert.ok(st.ontbrekend.includes('adres') && st.ontbrekend.includes('paspoort'), 'adres en paspoort ontbreken nog');
  assert.equal(st.contract.ondertekend, false, 'contract nog niet getekend');
  assert.ok(st.contract.tekst.length > 50 && st.contract.versie >= 1, 'er is een contracttekst met een versie');
});

test('2. gegevens opslaan + KYC + tekenen maakt de onboarding rond', async () => {
  await api(base, '/api/onboarding/opslaan', { velden: { adres: 'Reisstraat 1', postcode: '1000 AA', woonplaats: 'Amsterdam', nationaliteit: 'Nederlandse' } }, lid);
  // paspoort telt als ingevuld zodra het ID-bewijs is geupload (KYC)
  await api(base, '/api/verify/upload', { image: PNG }, lid);
  let st = (await api(base, '/api/onboarding/status', {}, lid)).body;
  assert.equal(st.ontbrekend.length, 0, 'alle velden ingevuld (paspoort via KYC)');
  assert.equal(st.klaar, false, 'nog niet rond: contract moet nog getekend');
  // tekenen zonder akkoord/naam faalt
  assert.equal((await api(base, '/api/onboarding/teken', { naam: '', akkoord: false }, lid)).status, 400);
  const t = await api(base, '/api/onboarding/teken', { naam: 'Reiziger Test', akkoord: true }, lid);
  assert.equal(t.status, 200);
  assert.equal(t.body.klaar, true, 'na tekenen is de onboarding rond');
  assert.equal(t.body.contract.ondertekend, true);
});

test('3. de eigenaar past met AI de eisen en het contract aan; niet-eigenaar mag niet', async () => {
  // de eigenaar bestaat al als demo-account (RTG_OWNER_EMAIL); inloggen i.p.v. registreren
  const owner = (await api(base, '/api/auth/login', { login: OWNER, password: 'Imran', pasApp: 'business' })).body.token;
  assert.ok(owner, 'eigenaar kan inloggen');
  // een gewoon lid mag de platformconfig niet zien
  assert.equal((await api(base, '/api/onboarding/config', {}, lid)).status, 403, 'niet-eigenaar krijgt 403');
  const cfg0 = (await api(base, '/api/onboarding/config', {}, owner)).body;
  assert.ok(cfg0.config && Array.isArray(cfg0.config.velden), 'eigenaar ziet de config');
  const v0 = cfg0.config.contract.versie;
  // AI (ingebouwde parser): een veld toevoegen + een regel aan het contract
  const r = await api(base, '/api/onboarding/config/ai', { opdracht: 'Voeg het veld noodcontact toe en zet in het contract dat reizen op eigen risico is.' }, owner);
  assert.equal(r.status, 200);
  assert.ok(r.body.config.velden.some(v => v.id === 'noodcontact'), 'nieuw veld staat in de config');
  assert.ok(r.body.config.contract.tekst.includes('eigen risico'), 'de contractregel is toegevoegd');
  assert.ok(r.body.config.contract.versie > v0, 'gewijzigde tekst = nieuwe contractversie');
});

test('4. een nieuw lid krijgt automatisch de aangepaste eisen (noodcontact ontbreekt)', async () => {
  const nieuw = await registreer('na-wijziging' + Date.now().toString().slice(-6) + '@x.nl');
  const st = (await api(base, '/api/onboarding/status', {}, nieuw)).body;
  assert.ok(st.velden.some(v => v.id === 'noodcontact'), 'het nieuwe veld geldt meteen voor iedereen');
  assert.ok(st.ontbrekend.includes('noodcontact'), 'en ontbreekt nog bij dit lid');
});

test('6. een RTF-gezinslid tekent hetzelfde platformcontract, maar zonder paspoort', async () => {
  // een gezin aanmaken levert code + token voor de volwassen beheerder
  const g = (await api(base, '/api/foundation/gezin/maak', { gezinsnaam: 'Gezin Test', naam: 'Sam Ouder', pin: '1234', avatar: '👑', kleur: '#C9A24B' })).body;
  assert.ok(g.code && g.token, 'gezin aangemaakt met code en token');
  const st = (await api(base, '/api/rtf/onboarding/status', { code: g.code, token: g.token })).body;
  assert.equal(st.tier, 'rtf');
  assert.equal(st.klaar, false, 'nog niet rond');
  // RTF reist niet met een reispas: geen paspoort/geboortedatum/nationaliteit-eis
  const ids = new Set(st.velden.map(v => v.id));
  assert.ok(!ids.has('paspoort') && !ids.has('nationaliteit'), 'geen KYC/paspoort voor RTF');
  assert.ok(ids.has('email') && ids.has('adres'), 'wel de gewone contactgegevens');
  // alle (niet-KYC) velden invullen + tekenen maakt het rond; de eigenaar kan
  // eerder velden hebben toegevoegd (bijv. noodcontact), dus vul dynamisch
  const velden = {};
  st.velden.forEach(v => { if (v.type !== 'kyc') velden[v.id] = v.id === 'email' ? 'sam@x.nl' : v.id === 'land' ? 'NL' : 'Sam Ouder'; });
  await api(base, '/api/rtf/onboarding/opslaan', { code: g.code, token: g.token, velden });
  const t = await api(base, '/api/rtf/onboarding/teken', { code: g.code, token: g.token, naam: 'Sam Ouder', akkoord: true });
  assert.equal(t.status, 200);
  assert.equal(t.body.klaar, true, 'na invullen + tekenen is de RTF-onboarding rond');
});

test('5. elke leverancier heeft een eigen scope die los AI-aanpasbaar is', async () => {
  const cfg = (await api(base, '/api/supplier/onboarding/config', {}, brand)).body;
  assert.ok(cfg.config && cfg.config.contract, 'leverancier heeft een eigen onboarding-config');
  const r = await api(base, '/api/supplier/onboarding/ai', { opdracht: 'Voeg het veld bsn toe' }, brand);
  assert.equal(r.status, 200);
  assert.ok(r.body.config.velden.some(v => v.id === 'bsn'), 'leverancier past de eigen scope aan');
  // de platform-scope is daardoor NIET veranderd
  const plat = (await api(base, '/api/onboarding/status', {}, lid)).body;
  assert.ok(!plat.velden.some(v => v.id === 'bsn'), 'de eigen scope lekt niet naar het platform');
});
