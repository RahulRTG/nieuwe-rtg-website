/* Het vraagbeeld: wat er gevraagd wordt en niet geleverd, en de lus naar de
   Kansenlaag van het stadsweefsel.

   Dit is het onderdeel met de grootste kans om verkeerd gebouwd te worden.
   Bijhouden waar mensen naar zoeken kan een zoekprofiel per persoon worden, en
   dat mag hier onder geen beding. De eerste vier toetsen gaan daarom niet over
   wat het kan, maar over wat het NIET bewaart.

   Draai los: node --experimental-sqlite --test test/mall-vraagbeeld.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const vb = require('../server/kern/mall/vraagbeeld');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vraag-'));
let srv, base, lid, tokSerena;

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const reg = await api('/api/auth/register', { name: 'Vraag Lid', email: 'vraag@x.nl', phone: '0612345672',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'lifestyle', pasApp: 'lifestyle' });
  lid = reg.body.token;
  const roster = await api('/api/supplier/roster', { code: 'SERENA' });
  const chef = (roster.body.staff || []).find(m => m.role === 'manager');
  tokSerena = (await api('/api/supplier/login', { code: 'SERENA', staffId: chef.id, pin: '1234' })).body.token;
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

/* ---------------------------------------------------------------------------
   1. Wat er NIET wordt bewaard.
   --------------------------------------------------------------------------- */

/* De opslag is sqlite en geen los db.json, dus deze twee toetsen kijken naar
   wat noteer() WEGSCHRIJFT in plaats van naar een bestand. Dat is dezelfde
   functie die de route gebruikt (toets 4 bewijst dat de route hem echt
   aanroept), en hier is de opgeslagen vorm precies te zien. */
function verseTeller() {
  const db = { data: {} };
  const v = require('../server/kern/mall/vraagbeeld')({ db, save() {}, plek: { plekVan: () => ({ slug: null }) } }).mallVraagbeeld;
  return { db, v };
}

test('1. er wordt geen enkele sleutel naar de zoeker bewaard', () => {
  const { db, v } = verseTeller();
  v.noteer({ woorden: ['zwembadonderhoud'], plek: 'ibiza', verdieping: 'diensten', treffers: 0 });
  const tekst = JSON.stringify(db.data.mallVraag);
  assert.match(tekst, /zwembadonderhoud/, 'het woord is geteld, anders meet deze toets niets');
  for (const verboden of ['key', 'codename', 'sessie', 'session', 'ip', 'token', 'email', 'naam']) {
    assert.ok(!new RegExp('"' + verboden + '"', 'i').test(tekst),
      'het vraagbeeld draagt geen veld "' + verboden + '"');
  }
  // de opgeslagen rij bestaat uit precies deze velden en geen andere
  const rij = Object.values(Object.values(db.data.mallVraag.weken)[0])[0];
  assert.deepEqual(Object.keys(rij).sort(), ['gevonden', 'leeg', 'n', 'plek', 'verdieping', 'woord'],
    'een rij is een teller, geen gebeurtenis met een afzender');
});

test('2. er worden woorden geteld en geen zinnen', () => {
  const { db, v } = verseTeller();
  const zin = ['kinderstoel', 'huren', 'voor', 'de', 'bruiloft', 'van', 'mijn', 'zus'];
  v.noteer({ woorden: zin, plek: 'ibiza', treffers: 0 });
  const tekst = JSON.stringify(db.data.mallVraag);
  assert.ok(!tekst.includes('bruiloft van mijn zus'), 'de zin staat er niet in');
  assert.match(tekst, /kinderstoel/, 'de losse woorden wel');
  const rijen = Object.values(Object.values(db.data.mallVraag.weken)[0]);
  assert.ok(rijen.every(r => !/ /.test(r.woord)), 'geen enkele rij draagt een spatie, dus geen enkele rij is een zin');
});

test('3. cijfers en adresachtige invoer worden niet geteld', () => {
  assert.equal(vb.telbaar('scooter'), true);
  assert.equal(vb.telbaar('caf'), true, 'drie letters mag');
  assert.equal(vb.telbaar('06'), false, 'te kort en cijfers');
  assert.equal(vb.telbaar('0612345678'), false, 'een telefoonnummer telt niet mee');
  assert.equal(vb.telbaar('jan@example.nl'), false, 'een e-mailadres evenmin');
  assert.equal(vb.telbaar('kerkstraat12'), false, 'een adres met huisnummer ook niet');
  assert.equal(vb.telbaar('a'.repeat(30)), false, 'en geen plakwoord van dertig tekens');
});

test('4. onder de drempel komt een woord niet naar buiten', async () => {
  const zeldzaam = 'harpreparatie';
  await api('/api/mall/zoek', { q: zeldzaam, plek: 'ibiza' }, lid);
  const zaak = await api('/api/supplier/mall', {}, tokSerena);
  assert.equal(zaak.status, 200);
  assert.ok(zaak.body.vraag, 'de zaak krijgt een vraagbeeld');
  assert.equal(zaak.body.vraag.drempel, vb.DREMPEL);
  assert.ok(!zaak.body.vraag.zoekwoorden.some(w => w.woord === zeldzaam),
    'een woord dat een enkeling zocht blijft binnen');

  // pas boven de drempel komt hij tevoorschijn
  for (let i = 0; i < vb.DREMPEL; i++) await api('/api/mall/zoek', { q: zeldzaam, plek: 'ibiza' }, lid);
  const na = await api('/api/supplier/mall', {}, tokSerena);
  assert.ok(na.body.vraag.zoekwoorden.some(w => w.woord === zeldzaam),
    'boven de drempel ziet de zaak hem wel');
});

/* ---------------------------------------------------------------------------
   2. Wat het wel doet: het tekort en de lus.
   --------------------------------------------------------------------------- */

test('5. het kantoorbeeld is niet voor leden', async () => {
  /* Het tekortenbeeld is bedrijfsinformatie van RTG zelf. Deze toets heette
     eerst "vaak gezocht is een tekort" en mat dat niet; hij meet nu wat hij
     zegt, en toets 6 doet de tekortlogica. */
  for (let i = 0; i < vb.DREMPEL + 2; i++) await api('/api/mall/zoek', { q: 'padelbaan', plek: 'ibiza' }, lid);
  const k = await api('/api/office/mall/kansen', { plek: 'ibiza' }, lid);
  assert.ok([401, 403].includes(k.status), 'een lid komt niet bij het kantoorbeeld (' + k.status + ')');
  const zonder = await api('/api/office/mall/kansen', { plek: 'ibiza' });
  assert.ok([401, 403].includes(zonder.status), 'en zonder sessie al helemaal niet');
});

test('6. het tekort komt met de reden en zonder een woord dat wel iets opleverde', async () => {
  /* Puur op de kern, zodat er niets van de volgorde van andere toetsen af
     hangt. Een woord dat treffers geeft is geen tekort, ook niet als het vaak
     wordt gezocht -- anders staat "hotel" bovenaan elke tekortenlijst. */
  const db = { data: {} };
  const ctx = { db, save() {}, plek: { plekVan: () => ({ slug: 'ibiza' }) } };
  const v = require('../server/kern/mall/vraagbeeld')(ctx).mallVraagbeeld;
  for (let i = 0; i < vb.DREMPEL; i++) v.noteer({ woorden: ['zeilles'], plek: 'ibiza', verdieping: 'sport', treffers: 0 });
  for (let i = 0; i < vb.DREMPEL; i++) v.noteer({ woorden: ['hotel'], plek: 'ibiza', verdieping: 'reizen', treffers: 7 });

  const t = v.tekorten('ibiza');
  assert.ok(t.some(x => x.woord === 'zeilles'), 'wat niets oplevert is een tekort');
  assert.ok(!t.some(x => x.woord === 'hotel'), 'wat wel iets oplevert is dat niet');
  const z = t.find(x => x.woord === 'zeilles');
  assert.equal(z.gezocht, vb.DREMPEL);
  assert.equal(z.zonderResultaat, vb.DREMPEL);
  assert.equal(z.gemiddeld, 0);

  const k = v.kansen('ibiza');
  assert.ok(k.perVerdieping.some(p => p.verdieping === 'sport'), 'het tekort is per verdieping gebundeld');
  assert.match(k.privacy, /nooit per persoon/, 'en het beeld zegt zelf hoe het is opgebouwd');
});

test('7. de Mall-vraag komt aan in de Kansenlaag van het stadsweefsel', () => {
  /* De lus: mensen zoeken -> de Mall ziet een tekort -> de kansenlaag ziet een
     ondernemerskans. Zonder deze koppeling blijft het vraagbeeld een cijfer in
     de Mall in plaats van een kans in de stad. */
  const bron = fs.readFileSync(path.join(__dirname, '..', 'server', 'opzet', 'weefseldraden.js'), 'utf8');
  assert.match(bron, /mallvraag:/, 'de vierde draad is gelegd');
  assert.match(bron, /mallVraagbeeld\.tekorten/, 'en hij haalt de tekorten uit het vraagbeeld');

  const kansen = fs.readFileSync(path.join(__dirname, '..', 'server', 'kern', 'stadsweefsel', 'kansen.js'), 'utf8');
  assert.match(kansen, /gevraagdNietGeleverd/, 'de kansenlaag geeft ze door');
  assert.match(kansen, /mallVraagBron/, 'uit een eigen bron, laat gebonden zoals de andere drie');
});

test('8. oude weken vervallen, en het beeld blijft eindig', () => {
  const db = { data: {} };
  const v = require('../server/kern/mall/vraagbeeld')({ db, save() {}, plek: { plekVan: () => ({ slug: null }) } }).mallVraagbeeld;
  v.noteer({ woorden: ['iets'], plek: 'ibiza', treffers: 0 });
  // met de hand meer weken erbij dan er bewaard mogen blijven
  const weken = db.data.mallVraag.weken;
  for (let i = 1; i <= vb.WEKEN + 3; i++) weken['2020-W' + String(i).padStart(2, '0')] = { 'x|oud': { woord: 'oud', n: 1, gevonden: 0, leeg: 1 } };
  v.noteer({ woorden: ['nogiets'], plek: 'ibiza', treffers: 0 });
  const over = Object.keys(db.data.mallVraag.weken);
  assert.ok(over.length <= vb.WEKEN, 'er blijven hoogstens ' + vb.WEKEN + ' weken staan (nu ' + over.length + ')');
  assert.ok(over.includes(vb.weekVan(new Date())), 'en de huidige week hoort daarbij');
});

test('9. alleen een echte zoekopdracht telt mee, geen interne aanroep', () => {
  /* De Mall roept zichzelf aan (de home, de reizenstrook, een lijst). Telde dat
     mee, dan wees het vraagbeeld naar binnen in plaats van naar de markt. De
     route zet `noteer`; alles wat dat niet doet, hoort niets te tellen. */
  const { maakMall } = require('../server/kern/mall');
  const db = { data: {
    suppliers: [{ code: 'W', name: 'Winkel', type: 'retail', city: 'Testdorp',
      artikelen: [{ id: 'x1', naam: 'Zeilles', publiekePrijs: 10, varianten: [{ voorraad: 1 }] }] }],
    supplierTypes: { retail: { label: 'Retail', caps: ['retail'] } },
    partnerTrips: [], markt: { ads: [] }
  } };
  require('../server/kern/werkvormen').haakAan(db);
  const mall = maakMall({ db, save() {}, crypto: require('crypto'),
    isRetail: (s) => s.type === 'retail', haalThuis: () => null, haalLandVind: () => null }).mall;

  const tellen = () => {
    const v = db.data.mallVraag;
    if (!v) return 0;
    return Object.values(v.weken).reduce((n, w) => n + Object.values(w).reduce((m, r) => m + r.n, 0), 0);
  };

  mall.mallHome({ plek: 'testdorp' });
  mall.mallZoek({ q: 'zeilles' });              // zonder noteer: een interne aanroep
  assert.equal(tellen(), 0, 'de home en een interne zoekopdracht tellen niet mee');

  mall.mallZoek({ q: 'zeilles', noteer: true }); // zoals de route hem doet
  assert.equal(tellen(), 1, 'een echte zoekopdracht wel');
});
