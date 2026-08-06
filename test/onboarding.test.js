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

/* De poort na het inloggen vraagt NIETS wat het huis nog niet nodig heeft. Wat
   het wel nodig heeft om je binnen te laten staat in kern/aanmeldgesprek-aanmeld:
   naam, e-mailadres, geboortedatum (en een wachtwoord). De rest -- telefoon,
   adres, postcode, woonplaats, land, nationaliteit, paspoort -- heeft een LATER
   moment en komt pas als een handeling erom vraagt (kern/gegevenspoort.js). */
test('1. een vers lid wordt bij het inloggen alleen naar naam, e-mail en geboortedatum gevraagd', async () => {
  lid = await registreer('reiziger' + Date.now().toString().slice(-7) + '@x.nl');
  const st = (await api(base, '/api/onboarding/status', {}, lid)).body;
  const gevraagd = st.velden.map(v => v.id).sort();
  assert.deepEqual(gevraagd, ['email', 'geboortedatum', 'naam'], 'meer vraagt de poort niet');
  for (const id of ['telefoon', 'adres', 'postcode', 'woonplaats', 'land', 'nationaliteit', 'paspoort']) {
    assert.ok(!gevraagd.includes(id), id + ' hoort bij een handeling, niet bij de voordeur');
    assert.ok(!st.ontbrekend.includes(id), id + ' mag de onboarding niet blokkeren');
  }
  // ze bestaan wel: een scherm mag ze tonen als "nog aan te vullen", als geen poort
  const later = (st.laterVelden || []).map(v => v.id);
  for (const id of ['telefoon', 'adres', 'postcode', 'woonplaats', 'land', 'nationaliteit']) {
    assert.ok(later.includes(id), id + ' komt terug als later-veld');
  }
  // de drie die wel gevraagd worden, zijn geprefilld uit het account
  assert.deepEqual(st.ontbrekend, [], 'niets ontbreekt: dit stond al in de aanmelding');
  assert.equal(st.klaar, false, 'alleen het contract houdt hem nog tegen');
  assert.equal(st.contract.ondertekend, false, 'contract nog niet getekend');
  assert.ok(st.contract.tekst.length > 50 && st.contract.versie >= 1, 'er is een contracttekst met een versie');
});

test('2. tekenen alleen maakt de onboarding rond; later aanvullen kan gewoon', async () => {
  // ZONDER adres, postcode, woonplaats of paspoort: alleen het contract
  const t0 = await api(base, '/api/onboarding/teken', { naam: 'Reiziger Test', akkoord: true }, lid);
  assert.equal(t0.status, 200);
  assert.equal(t0.body.klaar, true, 'een vers lid is binnen zodra hij tekent');

  await api(base, '/api/onboarding/opslaan', { velden: { adres: 'Reisstraat 1', postcode: '1000 AA', woonplaats: 'Amsterdam', nationaliteit: 'Nederlandse' } }, lid);
  // paspoort telt als ingevuld zodra het ID-bewijs is geupload (KYC)
  await api(base, '/api/verify/upload', { image: PNG }, lid);
  let st = (await api(base, '/api/onboarding/status', {}, lid)).body;
  assert.equal(st.ontbrekend.length, 0, 'alle gevraagde velden ingevuld');
  assert.ok((st.laterVelden || []).find(v => v.id === 'adres').ingevuld, 'het adres staat er nu wel bij');
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
  assert.ok(ids.has('naam') && ids.has('email'), 'wel wie je bent en waar we je bereiken');
  // het adres hoort ook hier bij een handeling, niet bij het aanmelden
  assert.ok(!ids.has('adres'), 'geen adres aan de voordeur');
  assert.ok((st.laterVelden || []).some(v => v.id === 'adres'), 'het adres komt terug als later-veld');
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

test('7. de gratis RTG Pass hoeft geen paspoort, tenzij hij RTG Pay gebruikt', async () => {
  const vrij = await registreer('vrij' + Date.now().toString().slice(-7) + '@x.nl');
  // alle ontbrekende (niet-KYC) velden invullen; de eigenaar kan er eerder een
  // hebben toegevoegd (bijv. noodcontact), dus dynamisch. Geen paspoort nodig.
  let st = (await api(base, '/api/onboarding/status', {}, vrij)).body;
  assert.ok(!st.velden.some(v => v.id === 'paspoort'), 'de gratis RTG Pass vraagt geen paspoort');
  const velden = {};
  st.velden.forEach(v => { if (v.type !== 'kyc' && !v.ingevuld) velden[v.id] = v.id === 'email' ? 'vrij@x.nl' : v.id === 'land' ? 'NL' : 'Vrijwaarde'; });
  await api(base, '/api/onboarding/opslaan', { velden }, vrij);
  await api(base, '/api/onboarding/teken', { naam: 'Vrij Lid', akkoord: true }, vrij);
  st = (await api(base, '/api/onboarding/status', {}, vrij)).body;
  assert.equal(st.klaar, true, 'zonder paspoort is de gratis onboarding rond');

  // maar zodra hij RTG Pay gebruikt, wordt het paspoort geeist (403 + kyc-sein)
  const pay = await api(base, '/api/pay/stuur', { aan: 'IEMAND', centen: 500 }, vrij);
  assert.equal(pay.status, 403, 'RTG Pay is geblokkeerd tot het paspoort er is');
  assert.equal(pay.body.kyc, true, 'met een kyc-sein zodat de app naar de paspoort-stap gaat');

  st = (await api(base, '/api/onboarding/status', {}, vrij)).body;
  assert.ok(st.velden.some(v => v.id === 'paspoort'), 'nu vraagt de onboarding wel het paspoort');
  assert.equal(st.klaar, false, 'en is de onboarding weer niet rond tot het paspoort er is');

  // na de KYC-upload is het rond en blokkeert RTG Pay niet meer op kyc
  await api(base, '/api/verify/upload', { image: PNG }, vrij);
  st = (await api(base, '/api/onboarding/status', {}, vrij)).body;
  assert.equal(st.klaar, true, 'met paspoort is het weer rond');
  const pay2 = await api(base, '/api/pay/stuur', { aan: 'IEMAND', centen: 500 }, vrij);
  assert.notEqual(pay2.body && pay2.body.kyc, true, 'geen kyc-blokkade meer (een andere fout mag)');
});

test('8. de MRZ-vervaldatum levert een paspoort-seintje binnen een half jaar', async () => {
  const lid2 = await registreer('verval' + Date.now().toString().slice(-7) + '@x.nl');
  // een datum ~5 maanden vooruit (binnen het half jaar) en eentje ruim erbuiten
  const overDagen = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
  const binnen = overDagen(150), ver = overDagen(400);

  // ruim buiten een half jaar: nog geen seintje
  await api(base, '/api/onboarding/paspoort', { vervaldatum: ver, nummer: 'NX1234567' }, lid2);
  let prof = (await api(base, '/api/fluister/profiel', {}, lid2)).body;
  assert.ok(!(prof.seintjes || []).some(s => s.soort === 'paspoort'), 'ruim op tijd: nog geen paspoort-seintje');

  // binnen een half jaar: nu wel, met de datum in de tekst
  await api(base, '/api/onboarding/paspoort', { vervaldatum: binnen }, lid2);
  prof = (await api(base, '/api/fluister/profiel', {}, lid2)).body;
  const sein = (prof.seintjes || []).find(s => s.soort === 'paspoort');
  assert.ok(sein, 'binnen een half jaar komt er een paspoort-seintje');
  assert.ok(sein.tekst.includes(binnen), 'het seintje noemt de vervaldatum');

  // een ongeldige datum verandert niets (geen crash, blijft de geldige staan)
  await api(base, '/api/onboarding/paspoort', { vervaldatum: 'geen-datum' }, lid2);
  prof = (await api(base, '/api/fluister/profiel', {}, lid2)).body;
  assert.ok((prof.seintjes || []).some(s => s.soort === 'paspoort' && s.tekst.includes(binnen)), 'ongeldige datum wordt genegeerd');
});

/* ---------- de momenten, rechtstreeks op de kernmodule ----------
   Wat hierboven over de routes loopt, gaat hier over de motor zelf: de betaalde
   passen, en vooral de MIGRATIE. De scope staat in de database, dus een nieuwe
   standaardVelden() raakt een bestaande installatie niet vanzelf -- zonder de
   migratie blijft die tot in lengte van dagen alles vooraf vragen, en dat zou
   geen enkele toets hierboven zien. */
const { maakOnboarding } = require('../server/kern/onboarding.js');
const nodeCrypto = require('node:crypto');

function motor(scopes) {
  const db = { data: scopes ? { onboarding: { scopes, profielen: {} } } : {} };
  const accounts = { getMemberState: () => ({}), saveMemberState: () => {},
    realNameOf: () => 'Naam', emailOf: () => 'x@y.nl', phoneOf: () => null };
  const onb = maakOnboarding({ db, save: () => {}, crypto: nodeCrypto, accounts,
    anthropic: null, schoon: (s, n) => String(s == null ? '' : s).slice(0, n) });
  return { db, onb };
}
/* Met een echt account erin, want een sessie zonder account is een demo-sessie
   en die kan geen paspoort uploaden -- daar telt het veld als voldaan en zou
   deze toets niets bewijzen. */
const sessie = (tier) => ({ key: 'k-' + tier, tier, account: { id: 42, verified: '' } });
const idsVan = (lijst) => (lijst || []).map(v => v.id);

test('9. de betaalde passen houden hun paspoort, de gratis pas niet', () => {
  const { onb } = motor(null);
  const life = onb.status('rtg', sessie('lifestyle'));
  assert.ok(idsVan(life.velden).includes('paspoort'), 'de Lifestyle Pass laat wel een paspoort zien');
  assert.equal(life.klaar, false, 'en zolang dat er niet is, is de onboarding niet rond');
  assert.ok(life.ontbrekend.includes('paspoort'), 'het paspoort staat ook echt in ontbrekend');
  const biz = onb.status('rtg', sessie('business'));
  assert.ok(idsVan(biz.velden).includes('paspoort'), 'de Business Pass ook');
  const gratis = onb.status('rtg', sessie('rtg'));
  assert.ok(!idsVan(gratis.velden).includes('paspoort'), 'de gratis pas niet');
  assert.ok(idsVan(gratis.laterVelden).includes('nationaliteit'), 'nationaliteit wacht daar op zijn moment');
});

test('10. een bestaande installatie schuift mee, en een eigen keuze van de eigenaar blijft', () => {
  // een scope zoals hij in een draaiende installatie staat: zonder momenten,
  // en met een eigen keuze van de eigenaar (telefoon blijft bij de intake)
  const oud = { rtg: { velden: [
    { id: 'naam', label: 'Volledige naam', type: 'text', voorWie: ['guest', 'rtg', 'lifestyle', 'business', 'rtf'] },
    { id: 'telefoon', label: 'Telefoonnummer', type: 'tel', voorWie: ['guest', 'rtg', 'lifestyle', 'business', 'rtf'], moment: 'nu' },
    { id: 'adres', label: 'Straat en huisnummer', type: 'text', voorWie: ['guest', 'rtg', 'lifestyle', 'business', 'rtf'] },
    { id: 'nationaliteit', label: 'Nationaliteit', type: 'text', voorWie: ['rtg', 'lifestyle', 'business'] },
    { id: 'noodcontact', label: 'Noodcontact', type: 'text', voorWie: ['rtg'] }
  ], contract: { versie: 1, titel: 'Oud contract', tekst: 'x'.repeat(60), bijgewerkt: '2026-01-01T00:00:00.000Z' } } };
  const { onb } = motor(oud);
  const st = onb.status('rtg', sessie('rtg'));
  assert.ok(!idsVan(st.velden).includes('adres'), 'het adres schuift mee naar later');
  assert.ok(!idsVan(st.velden).includes('nationaliteit'), 'de nationaliteit ook');
  assert.ok(idsVan(st.laterVelden).includes('adres') && idsVan(st.laterVelden).includes('nationaliteit'),
    'en komt terug als later-veld');
  assert.ok(idsVan(st.velden).includes('telefoon'), 'de eigen keuze van de eigenaar blijft staan');
  assert.ok(idsVan(st.velden).includes('noodcontact'), 'een eigen veld blijft bij de intake');

  // en een beheerronde (de eigenaar past iets aan) mag de momenten niet wissen
  const cfg = onb.config('rtg');
  assert.equal(cfg.velden.find(v => v.id === 'adres').moment, 'later', 'het moment staat in de config');
  onb.zetConfig('rtg', { contract: { titel: 'Nieuwe titel' } });
  const na = onb.status('rtg', sessie('rtg'));
  assert.ok(!idsVan(na.velden).includes('adres'), 'na een beheerronde staat het adres er nog steeds niet');
  // ook een voorstel dat het veld niet kent (een oudere client) trekt niets terug
  onb.zetConfig('rtg', { velden: cfg.velden.map(v => ({ id: v.id, label: v.label, type: v.type, voorWie: v.voorWie })) });
  const na2 = onb.status('rtg', sessie('rtg'));
  assert.ok(!idsVan(na2.velden).includes('adres'), 'een voorstel zonder moment zet de intake niet terug');
  assert.ok(idsVan(na2.velden).includes('telefoon'), 'en laat de keuze van de eigenaar staan');
});

/* De intake-route mag het ledendossier niet aanraken voor de nationaliteit.

   Waarom deze toets bestaat. Bij het verkleinen van de intake stond hier even
   een regel die de nationaliteit doorschreef naar member_state, "zodat hij
   landt waar de lezers kijken". Goed bedoeld, en precies verkeerd: deze route
   staat alleen achter auth, dus elk lid kan er zijn eigen velden in zetten. Er
   ontstond zo een tweede schrijver naast de enige die er hoort te zijn, de
   identiteitscontrole van het kantoor. Het gat was zo groot als het klinkt: een
   lid dat door het kantoor als Duitse was vastgelegd zette zichzelf op
   Nederlandse en liep daarmee langs de landregel van de eigenaar heen.

   Wie de nationaliteit wel mag zetten doet dat met bewijs: het kantoor na
   verificatie, of de MRZ-scan van het paspoort. Wat een lid hier typt blijft in
   het onboardingprofiel. */
test('de intake schrijft geen nationaliteit naar het ledendossier', () => {
  let dossier = { nationaliteit: 'Duitse' };   // door het kantoor vastgelegd
  let geschreven = false;
  const accounts = {
    getMemberState: () => dossier,
    saveMemberState: (id, md) => { geschreven = true; dossier = md; },
    realNameOf: () => 'Test', emailOf: () => 't@x.nl', phoneOf: () => null
  };
  const lid = require('../server/kern/onboarding/lid')({
    accounts, save: () => {}, schoon: (s, n) => String(s).slice(0, n),
    crypto: require('crypto'), nu: () => Date.now(),
    scopeVan: () => ({ velden: [{ id: 'nationaliteit', label: 'Nationaliteit', type: 'text', voorWie: ['rtg'], moment: 'later' }],
      contract: { versie: 1, titel: 't', tekst: 't' } }),
    profielVan: () => ({ velden: {}, ondertekend: {} }), profielId: () => 'p1'
  });

  lid.slaOp('rtg', { key: 'k', tier: 'rtg', account: { id: 1 } }, { nationaliteit: 'Nederlandse' });

  assert.equal(dossier.nationaliteit, 'Duitse',
    'wat het kantoor vastlegde blijft staan; een lid overschrijft dat niet via de intake');
  assert.equal(geschreven, false,
    'de intake raakt het ledendossier hier niet aan, ook niet ongemerkt');
});
