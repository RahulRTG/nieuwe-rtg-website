/* Wereldtalen: het register, de Boardroom-schakelaars en het overal-in-je-eigen-
   taal-chatten. Iedereen schrijft in de eigen taal; de ander leest alles in de
   zijne (vertaling per bericht, gecachet). NL en EN zijn de basis en blijven
   altijd aan. Draai: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { TALEN, STANDAARD, STANDAARD_VERSIE, bestaat, naamEn, maakTalen } = require('../server/talen');
const vertaal = require('../server/translate');
const { startServer, stop } = require('./helper');

const OWNER = 'talen-owner@x.nl';

function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

// ---- 1. het register ----
test('register: dekt de wereld, kent endoniemen en Engelse namen', () => {
  assert.ok(TALEN.length >= 100, 'ruim honderd wereldtalen (' + TALEN.length + ')');
  assert.ok(bestaat('zh') && bestaat('ar') && bestaat('sw') && bestaat('fy'), 'van Chinees tot Fries');
  assert.equal(naamEn('ja'), 'Japanese');
  assert.ok(!bestaat('xx'), 'onzin-codes bestaan niet');
});

test('register: basistalen altijd aan, schakelen werkt, taalVan valt veilig terug', () => {
  const db = { data: {} };
  const t = maakTalen({ db, save: () => {} });
  assert.deepEqual(t.actieve().map(x => x.code), STANDAARD, 'standaard zijn alle 114 talen actief');
  assert.equal(db.data.talen.standaardVersie, STANDAARD_VERSIE);
  assert.equal(t.zet('fr', false).ok, true, 'Frans uit');
  assert.equal(t.zet('fr', true).ok, true, 'Frans aan');
  assert.ok(t.isActief('fr'));
  assert.equal(t.taalVan('fr'), 'fr', 'actieve taal mag');
  assert.equal(t.zet('ja', false).ok, true, 'Japans uit');
  assert.equal(t.taalVan('ja'), 'nl', 'inactieve taal valt terug op nl');
  assert.equal(t.taalVan('geen-taal'), 'nl');
  assert.equal(t.zet('nl', false).status, 409, 'de basis kan niet uit');
  assert.equal(t.zet('fr', false).ok, true, 'Frans weer uit');
  assert.ok(!t.isActief('fr'));
  assert.equal(t.zet('xx', true).status, 404, 'onbekende taal bestaat niet');
});

test('register: de oude nl/en-stand migreert eenmalig naar alle 114 talen', () => {
  let saves = 0;
  const db = { data: { talen: { actief: ['nl', 'en'] } } };
  const t = maakTalen({ db, save: () => { saves++; } });
  assert.equal(t.actieve().length, TALEN.length);
  assert.equal(db.data.talen.standaardVersie, STANDAARD_VERSIE);
  assert.equal(saves, 1, 'de migratie wordt een keer bewaard');
  t.actieve();
  assert.equal(saves, 1, 'volgende lezingen herschrijven de database niet');
});

// ---- 2. de vertaallaag ----
test('translate: nl/en via woordenboek; vreemde taal zonder AI blijft heel', async () => {
  const en = await vertaal.translate('hallo', 'en', 'nl');
  assert.equal(en.text, 'hello', 'woord-voor-woord nl->en werkt zonder AI');
  const fr = await vertaal.translate('Tot vanavond bij het diner.', 'fr', 'nl');
  assert.equal(fr.translated, false, 'zonder AI-sleutel komt fr onvertaald terug');
  assert.equal(fr.text, 'Tot vanavond bij het diner.', 'nooit kapot');
  assert.equal(vertaal.localize('Zojuist betaald', 'fr'), 'Just paid', 'seed-inhoud: Engelse terugval voor elke niet-nl taal');
});

test('translate: een UI-scherm gaat als batch naar het model en wordt gecachet', async () => {
  let aanroepen = 0;
  vertaal.setAnthropic({ messages: { create: async (p) => {
    aanroepen++;
    const invoer = JSON.parse(p.messages[0].content);
    return { content: [{ type: 'text', text: JSON.stringify(invoer.map(t => 'FR:' + t)) }] };
  } } });
  try {
    const bron = ['Uniek schermlabel alfa', 'Unieke schermknop beta'];
    const een = await vertaal.translateBatch(bron, 'fr', 'nl');
    assert.deepEqual(een.map(x => x.text), bron.map(t => 'FR:' + t));
    assert.equal(aanroepen, 1, 'een schermgroep kost een modelaanroep');
    const twee = await vertaal.translateBatch(bron, 'fr', 'nl');
    assert.deepEqual(twee.map(x => x.text), bron.map(t => 'FR:' + t));
    assert.equal(aanroepen, 1, 'de tweede keer komt volledig uit de cache');
  } finally { vertaal.setAnthropic(null); }
});

test('translate: de batch stuurt alleen toegestane UI-bronnen naar het model', async () => {
  const gezien = [];
  vertaal.setAnthropic({ messages: { create: async (p) => {
    const invoer = JSON.parse(p.messages[0].content); gezien.push(...invoer);
    return { content: [{ type: 'text', text: JSON.stringify(invoer.map(t => 'FR:' + t)) }] };
  } } });
  try {
    const ui = 'Toegestane unieke UI-bron gamma';
    const prive = 'Persoonlijke vrije tekst delta';
    const uit = await vertaal.translateBatch([ui, prive], 'fr', 'nl', { ai: t => t === ui });
    assert.deepEqual(gezien, [ui]);
    assert.equal(uit[0].text, 'FR:' + ui);
    assert.equal(uit[1].text, prive, 'niet-toegestane tekst blijft lokaal en heel');
  } finally { vertaal.setAnthropic(null); }
});

// ---- 3. end-to-end: Boardroom-schakelaars + chatten in je eigen taal ----
let srv, base, owner, lid, winkel;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-talen-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_OWNER_EMAIL: OWNER, ANTHROPIC_API_KEY: '', DEMO_SUPPLIER: 'KIKUNOI' } });
  base = srv.base;
  owner = (await api(base, '/api/techniek/inloggen', { login: OWNER, wachtwoord: 'Imran' })).body.token;
  const u = Date.now().toString().slice(-8);
  lid = (await api(base, '/api/auth/register', { name: 'Taal Lid', email: 't' + u + '@x.nl',
    phone: '069' + u, password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' })).body.token;
  winkel = (await api(base, '/api/supplier/login', { username: 'rahul', password: 'Imran' })).body.token;
});
test.after(() => stop(srv && srv.child));

test('Boardroom: alle wereldtalen met schakelaars; aanzetten maakt ze kiesbaar', async () => {
  assert.ok(owner, 'eigenaar ingelogd');
  const alles = await api(base, '/api/boardroom/talen', {}, owner);
  assert.equal(alles.status, 200);
  assert.ok(alles.body.talen.length >= 100, 'de hele wereld staat erin');
  const nl = alles.body.talen.find(t => t.code === 'nl');
  assert.ok(nl.aan && nl.basis, 'nl is basis en aan');

  // publiek: standaard de hele wereld
  const voor = await api(base, '/api/talen', {});
  assert.equal(voor.body.talen.length, TALEN.length);

  // eigenaar kan niet-basistalen uit- en weer aanzetten
  assert.equal((await api(base, '/api/boardroom/taal', { code: 'fr', aan: false }, owner)).status, 200);
  assert.equal((await api(base, '/api/boardroom/taal', { code: 'ja', aan: false }, owner)).status, 200);
  const uit = await api(base, '/api/talen', {});
  assert.ok(!uit.body.talen.some(t => t.code === 'fr' || t.code === 'ja'));
  assert.equal((await api(base, '/api/boardroom/taal', { code: 'fr', aan: true }, owner)).status, 200);
  assert.equal((await api(base, '/api/boardroom/taal', { code: 'ja', aan: true }, owner)).status, 200);
  const na = await api(base, '/api/talen', {});
  const codes = na.body.talen.map(t => t.code);
  assert.ok(codes.includes('fr') && codes.includes('ja'), 'fr en ja zijn nu kiesbaar');
  assert.ok(na.body.talen.find(t => t.code === 'ja').naam === '日本語', 'endoniem gaat mee naar de kiezer');

  // de basis kan niet uit
  assert.equal((await api(base, '/api/boardroom/taal', { code: 'en', aan: false }, owner)).status, 409);
});

test('gastchat: lid schrijft in eigen taal; partner leest in de zijne (cache + orig)', async () => {
  // het lid schrijft Nederlands; de partner leest in het Engels: woordenboekpad, deterministisch
  const stuur = await api(base, '/api/partner/chat/send', { supplierCode: 'KIKUNOI', text: 'hallo', lang: 'nl' }, lid);
  assert.equal(stuur.status, 200);

  const st = await api(base, '/api/supplier/state', {}, winkel);
  const chats = st.body.state.guestChats || [];
  assert.ok(chats.length >= 1, 'de partner ziet het gesprek');
  const key = chats[0].key;

  const enkant = await api(base, '/api/supplier/chat/history', { key, lang: 'en' }, winkel);
  assert.equal(enkant.status, 200);
  const m = enkant.body.messages.find(x => x.orig === 'hallo');
  assert.ok(m, 'het bericht is vertaald en draagt het origineel mee');
  assert.equal(m.text, 'hello', 'de partner leest het in zijn eigen taal');

  // het lid schrijft in een aangezette wereldtaal: de brontaal wordt vastgelegd,
  // en zonder AI-sleutel blijft de tekst heel (nooit kapot)
  const fr = await api(base, '/api/partner/chat/send', { supplierCode: 'KIKUNOI', text: 'Bonsoir, une table pour deux ce soir?', lang: 'fr' }, lid);
  assert.equal(fr.status, 200);
  const nlkant = await api(base, '/api/supplier/chat/history', { key, lang: 'nl' }, winkel);
  const fm = nlkant.body.messages.find(x => (x.orig || x.text).includes('Bonsoir'));
  assert.ok(fm, 'het Franse bericht is er, met de brontaal vastgelegd');
});

test('Rahul/concierge: antwoordt in de taal van het lid en de geschiedenis leest per kijker', async () => {
  const u = Date.now().toString().slice(-8);
  const rtg = (await api(base, '/api/auth/register', { name: 'Rahul Lid', email: 'b' + u + '@x.nl',
    phone: '061' + u, password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })).body.token;

  // het lid schrijft in het Engels; zonder AI-sleutel vertaalt het demo-antwoord
  // via het woordenboek mee en draagt het de juiste taal
  const r = await api(base, '/api/chat/send', { text: 'hallo', lang: 'en' }, rtg);
  assert.equal(r.status, 200);
  const rahul = r.body.messages.filter(m => m.from === 'rahul').pop();
  assert.ok(rahul && rahul.text.length > 0, 'Rahul antwoordt');
  assert.equal(rahul.lang, 'en', 'het antwoord draagt de taal van het lid');

  // de geschiedenis leest per kijker: zelfde gesprek, nl-bril -> nl-mechaniek
  const hist = await api(base, '/api/chat/history', { lang: 'en' }, rtg);
  assert.equal(hist.status, 200);
  assert.ok(hist.body.messages.length >= 2, 'lid + Rahul staan in de geschiedenis');
});

test('sollicitatiechat: ook daar leest ieder in de eigen taal', async () => {
  // werkgever maakt een vacature; het lid solliciteert en er ontstaat een chat
  await api(base, '/api/supplier/vacature', { func: 'Gastheer', soort: 'bijbaan', minLeeftijd: 18 }, winkel);
  const st = await api(base, '/api/supplier/state', {}, winkel);
  const vacId = st.body.state.vacatures[0].id;
  await api(base, '/api/cv/save', { name: 'Taal Lid', contact: 't@x.nl', skills: 'talen', experience: 'horeca' }, lid);
  assert.equal((await api(base, '/api/member/apply', { supplierCode: 'KIKUNOI', vacatureId: vacId }, lid)).status, 200);
  const st2 = await api(base, '/api/supplier/state', {}, winkel);
  const app2 = st2.body.state.applications.find(a => a.name === 'Taal Lid');
  const uit = await api(base, '/api/supplier/apply/decide', { id: app2.id, action: 'uitnodigen' }, winkel);
  assert.ok(uit.body.chat, 'chat geopend');

  // sollicitant schrijft nl; werkgever leest en (in het Engels) ziet de vertaling
  await api(base, '/api/member/apply/chat/send', { id: app2.id, text: 'hallo', lang: 'nl' }, lid);
  const en = await api(base, '/api/supplier/apply/chat', { id: app2.id, lang: 'en' }, winkel);
  assert.equal(en.status, 200);
  const b = (en.body.chat.berichten || []).find(x => x.orig === 'hallo');
  assert.ok(b && b.tekst === 'hello', 'werkgever leest het bericht in zijn eigen taal');
});
