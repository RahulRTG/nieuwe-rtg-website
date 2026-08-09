/* Integratietests voor RTG Wereld: de laag die van De Salon, Pulse, RTG
   Zakelijk, de genootschappen en de verhalen één app maakt met één schakelaar.

   Wat hier bewust WEL wordt getoetst en waarom (LAT-regel 9): niet "de route
   geeft iets terug", maar per bewering het verschil dat hij hoort te maken.
   Een gratis pas MOET buiten Business blijven, een Business-post MOET in de
   feed van een Lifestyle-lid staan en MOET uit die van een gratis lid blijven,
   en een onbekende verwijzing MOET 404 geven in plaats van een gokje.

   De belangrijkste toets staat onderaan: `zakelijkPro` en de echte PRO-poort
   van routes/zakelijk.js zeggen hetzelfde. Die twee lijsten bestaan naast
   elkaar zolang zakelijk.js niet is verbouwd, en dit is wat ze gelijk houdt --
   getoetst tegen de ECHTE route en niet tegen een kopie van de lijst, want een
   toets tegen een kopie slaagt altijd.

   Draai los: node --experimental-sqlite --test test/wereldlaag.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, elevateTier } = require('./helper');

const rechten = require('../server/kern/wereld/rechten');
const koppel = require('../server/kern/wereld/koppel');

let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-wereld-'));

function post(pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return fetch(BASE + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
}
const json = r => r.json();

// Een echt lid met een echte sessie. Lifestyle en Business komen nooit uit een
// zelfregistratie (merkregel: alleen na menselijk akkoord), dus die lopen langs
// dezelfde office-akkoordflow als in het echt.
async function lid(naam, email, tier) {
  const regTier = (tier === 'lifestyle' || tier === 'business') ? 'rtg' : tier;
  const d = await json(await post('/api/auth/register', {
    name: naam, email, phone: '0612345678', password: 'geheim123',
    geboortedatum: '1990-01-01', tier: regTier
  }));
  assert.ok(d.token, 'registratie geeft een sessietoken');
  if (regTier !== tier) {
    const office = (await json(await post('/api/office/login', { code: 'RTG-OFFICE' }))).token;
    await elevateTier(BASE, d.token, tier, office);
  }
  /* De LIVE codenaam (via /api/metier/ik), niet die uit het registratie-antwoord:
     dat is de naam die de ledengids kent en die de app zelf toont. */
  const p = await json(await post('/api/metier/ik', {}, d.token));
  return { token: d.token, codenaam: p.profiel.codenaam };
}

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

/* ---------- de schakelaar: één app, verschillende werelden ---------- */

test('de gratis pas krijgt Lifestyle en Communities, maar Business blijft dicht', async () => {
  const g = await lid('Gratis Lid', 'gratis@x.nl', 'rtg');
  const st = await json(await post('/api/wereld/state', {}, g.token));

  assert.equal(st.ik.pas, 'rtg');
  const open = st.modi.filter(m => m.open).map(m => m.id);
  assert.deepEqual(open.sort(), ['alles', 'genootschap', 'lifestyle', 'prive'],
    'precies deze vier staan open voor de gratis pas');
  const bus = st.modi.find(m => m.id === 'business');
  assert.equal(bus.open, false, 'Business staat dicht');
  assert.match(bus.reden, /Lifestyle en Business/, 'en zegt waarom');

  // dicht is dicht: niet alleen onzichtbaar in de lijst, ook geweigerd
  const kiezen = await post('/api/wereld/modus', { modus: 'business' }, g.token);
  assert.equal(kiezen.status, 403, 'de modus kiezen mag niet');
  const feed = await post('/api/wereld/feed', { modus: 'business' }, g.token);
  assert.equal(feed.status, 403, 'en de feed rechtstreeks opvragen ook niet');
});

test('Lifestyle en Business krijgen alle vijf de werelden', async () => {
  for (const [naam, mail, pas] of [['Lief Lid', 'lief@x.nl', 'lifestyle'], ['Baas Lid', 'baas@x.nl', 'business']]) {
    const l = await lid(naam, mail, pas);
    const st = await json(await post('/api/wereld/state', {}, l.token));
    assert.equal(st.ik.pas, pas);
    assert.equal(st.modi.filter(m => m.open).length, 5, pas + ' heeft alle vijf de werelden');
    assert.equal((await post('/api/wereld/modus', { modus: 'business' }, l.token)).status, 200);
  }
});

test('de profiellagen lopen met de pas mee', async () => {
  const g = await lid('Lagen Gratis', 'lagen1@x.nl', 'rtg');
  const b = await lid('Lagen Baas', 'lagen2@x.nl', 'business');
  const lagen = async t => (await json(await post('/api/wereld/state', {}, t))).lagen.map(l => l.id);

  assert.deepEqual(await lagen(g.token), ['persoonlijk'], 'de gratis pas heeft één laag');
  assert.deepEqual(await lagen(b.token), ['persoonlijk', 'professioneel', 'creator', 'ondernemer'],
    'Business heeft ze alle vier');
});

/* ---------- de ene feed ---------- */

test('een Salon-post komt in de wereldfeed, en de bron staat erbij', async () => {
  const l = await lid('Feed Lid', 'feed@x.nl', 'rtg');
  const geplaatst = await json(await post('/api/salon/plaats', { tekst: 'Een avond in Lissabon.' }, l.token));
  assert.ok(geplaatst.ok || geplaatst.post, 'de post is echt geplaatst: ' + JSON.stringify(geplaatst).slice(0, 120));

  const f = await json(await post('/api/wereld/feed', { modus: 'lifestyle' }, l.token));
  const mijn = f.items.find(i => i.tekst === 'Een avond in Lissabon.');
  assert.ok(mijn, 'de post staat in de wereldfeed');
  assert.equal(mijn.bron, 'salon', 'met de bron erbij');
  assert.equal(mijn.open, 'rtg://salon/' + mijn.id.split(':')[1], 'en een verwijzing terug naar de Salon');
});

test('een zakelijke post blijft uit de feed van de gratis pas -- ook in "Alles"', async () => {
  const b = await lid('Zakelijk Baas', 'zbaas@x.nl', 'business');
  const g = await lid('Zakelijk Gratis', 'zgratis@x.nl', 'rtg');

  await post('/api/zakelijk/profiel/zet', { naam: 'Baas', kop: 'Oprichter' }, b.token);
  const p = await json(await post('/api/zakelijk/post', { tekst: 'Wij zoeken een operations manager.' }, b.token));
  assert.ok(!p.error, 'de zakelijke post is geplaatst: ' + JSON.stringify(p).slice(0, 120));

  const vanBaas = await json(await post('/api/wereld/feed', { modus: 'alles' }, b.token));
  assert.ok(vanBaas.bronnen.includes('zakelijk'), 'Business ziet de zakelijke bron in Alles');
  assert.ok(vanBaas.items.some(i => i.tekst === 'Wij zoeken een operations manager.'),
    'en de post staat er echt in');

  const vanGratis = await json(await post('/api/wereld/feed', { modus: 'alles' }, g.token));
  assert.ok(!vanGratis.bronnen.includes('zakelijk'), 'de gratis pas krijgt de zakelijke bron niet');
  assert.ok(!vanGratis.items.some(i => i.bron === 'zakelijk'),
    'en er lekt geen enkel zakelijk item in zijn "Alles"');
});

test('een prikbordbericht komt in Communities, en alleen bij de leden', async () => {
  /* Deze toets bestond eerst NIET, en dat was een gat met gevolgen: de
     genootschap-lezer las de opslag verkeerd (groepen staan in
     `db.data.genootschap.groepen`, niet als losse sleutels) en gaf dus altijd
     nul berichten. Geen fout, geen log -- alleen een lege lijst. De toets die er
     wel was keek of de BRON meedeed in de modus, niet of er inhoud uitkwam, en
     kon daarom niet zakken (LAT-regel 9). */
  const a = await lid('Genoot A', 'ga@x.nl', 'rtg');
  const b = await lid('Genoot B', 'gb@x.nl', 'rtg');
  const buiten = await lid('Genoot Buiten', 'gc@x.nl', 'rtg');

  const opgericht = await json(await post('/api/genootschap/richt-op',
    { naam: 'De Zeilers', soort: 'besloten' }, a.token));
  const groep = opgericht.groep && opgericht.groep.id;
  assert.ok(groep, 'het genootschap is opgericht: ' + JSON.stringify(opgericht).slice(0, 140));

  const uitn = await json(await post('/api/genootschap/nodig-uit', { groep, wie: b.codenaam }, a.token));
  assert.ok(!uitn.error, 'de uitnodiging is verstuurd: ' + JSON.stringify(uitn).slice(0, 140));
  const binnen = await json(await post('/api/genootschap/binnen', { groep }, b.token));
  assert.ok(!binnen.error, 'B treedt binnen: ' + JSON.stringify(binnen).slice(0, 120));

  const geplaatst = await json(await post('/api/genootschap/prik',
    { groep, tekst: 'Zaterdag varen we uit.' }, a.token));
  assert.ok(!geplaatst.error, 'het bericht staat op het prikbord: ' + JSON.stringify(geplaatst).slice(0, 120));

  const communities = async t =>
    (await json(await post('/api/wereld/feed', { modus: 'genootschap' }, t))).items;

  const bijB = await communities(b.token);
  const raak = bijB.find(i => i.tekst === 'Zaterdag varen we uit.');
  assert.ok(raak, 'een medelid ziet het bericht in Communities');
  assert.equal(raak.bron, 'genootschap', 'met de juiste bron');
  assert.equal(raak.auteur, a.codenaam, 'en op codenaam van de plaatser');

  assert.ok((await communities(a.token)).some(i => i.tekst === 'Zaterdag varen we uit.'),
    'de plaatser ziet hem ook');
  assert.ok(!(await communities(buiten.token)).some(i => i.tekst === 'Zaterdag varen we uit.'),
    'wie er niet in zit ziet niets -- besloten blijft besloten');
});

test('de feed is chronologisch, nieuwste eerst -- geen algoritme', async () => {
  const l = await lid('Tijd Lid', 'tijd@x.nl', 'rtg');
  await post('/api/salon/plaats', { tekst: 'eerst' }, l.token);
  await new Promise(r => setTimeout(r, 1100));
  await post('/api/salon/plaats', { tekst: 'daarna' }, l.token);

  const f = await json(await post('/api/wereld/feed', { modus: 'lifestyle' }, l.token));
  const i1 = f.items.findIndex(i => i.tekst === 'daarna');
  const i2 = f.items.findIndex(i => i.tekst === 'eerst');
  assert.ok(i1 >= 0 && i2 >= 0, 'beide posts staan in de feed');
  assert.ok(i1 < i2, 'de nieuwste staat boven de oudste');

  const tijden = f.items.map(i => new Date(i.at).getTime());
  for (let i = 1; i < tijden.length; i++)
    assert.ok(tijden[i - 1] >= tijden[i], 'de hele lijst loopt aflopend, niet alleen de kop');
});

/* ---------- Privé: de enige bron die niet publiek is ---------- */

test('Privé toont het verhaal van een vriend, en juist niet dat van een vreemde', async () => {
  /* LAT.md-regel 9 noemt precies dit geval als een toets die vroeger niets
     bewees ("hij ziet het", "hij mag er niet bij" en "het bestaat niet" waren
     alle drie goed). Daarom staan hier drie harde beweringen: A ZIET het, C
     ziet het NIET, en A ziet zijn eigen verhaal ook. */
  const a = await lid('Verhaal A', 'va@x.nl', 'rtg');
  const b = await lid('Verhaal B', 'vb@x.nl', 'rtg');
  const c = await lid('Verhaal C', 'vc@x.nl', 'rtg');

  // A en B worden vrienden; C blijft erbuiten
  const mijA = await json(await post('/api/member/connections', {}, a.token));
  const mijB = await json(await post('/api/member/connections', {}, b.token));
  await post('/api/member/connect', { key: mijB.me }, a.token);
  await post('/api/member/connect/respond', { key: mijA.me, action: 'accept' }, b.token);

  // B plaatst een verhaal (een echte 1x1-PNG, want de poort eist een geldige foto)
  const foto = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const geplaatst = await json(await post('/api/member/story/post', { foto, tekst: 'Zonsondergang' }, b.token));
  assert.ok(geplaatst.ok, 'het verhaal is echt geplaatst: ' + JSON.stringify(geplaatst).slice(0, 120));

  const prive = async t => (await json(await post('/api/wereld/feed', { modus: 'prive' }, t))).items;

  const bijA = await prive(a.token);
  assert.equal(bijA.filter(i => i.bron === 'verhalen').length, 1,
    'de vriend ziet precies één verhaal');
  assert.equal(bijA[0].tekst, 'Zonsondergang', 'en het is dat van B');
  // de naam echt vergelijken en niet alleen kijken of er iets staat: de
  // terugval 'Een lid' zag er jarenlang uit als een naam (zie feed.js)
  assert.equal(bijA[0].auteur, b.codenaam, 'op codenaam van B, niet op de terugval');

  const bijC = await prive(c.token);
  assert.equal(bijC.filter(i => i.bron === 'verhalen').length, 0,
    'een vreemde ziet het verhaal van B niet');

  const bijB = await prive(b.token);
  assert.ok(bijB.some(i => i.tekst === 'Zonsondergang'), 'B ziet zijn eigen verhaal wel');
});

/* ---------- de modus is een voorkeur, geen recht ---------- */

test('een onthouden modus die niet meer mag, valt terug op Alles', async () => {
  const l = await lid('Val Lid', 'val@x.nl', 'business');
  await post('/api/wereld/modus', { modus: 'business' }, l.token);
  assert.equal((await json(await post('/api/wereld/state', {}, l.token))).modus, 'business',
    'de keuze wordt onthouden');

  // dezelfde opgeslagen keuze, maar nu gelezen als een gratis pas: de functie
  // die de route gebruikt, moet hem weigeren en niet doorlaten omdat hij er ooit stond
  assert.equal(rechten.modusOpen('rtg', 'business'), false,
    'dezelfde onthouden waarde is voor een gratis pas geen geldige modus meer');
  assert.equal(rechten.modusOpen('business', 'business'), true);
});

/* ---------- de koppellaag ---------- */

test('de koppelkaart komt één keer mee in de state, en klopt met de server', async () => {
  const l = await lid('Link Lid', 'link@x.nl', 'rtg');
  const st = await json(await post('/api/wereld/state', {}, l.token));

  assert.ok(st.koppelkaart && st.koppelkaart.salon, 'de kaart wordt bezorgd');
  assert.equal(st.koppelkaart.salon.app, '/apps/salon.html');
  // het scherm bouwt de link met deze kaart; die moet hetzelfde opleveren als
  // de server zelf zou doen, anders is de bezorgde kaart een tweede waarheid
  const k = st.koppelkaart.salon;
  assert.equal(k.app + '?' + k.param + '=ab12', koppel.open('rtg://salon/ab12').url,
    'de bezorgde kaart en koppel.open() lopen uiteen');
});

test('een gesprek mag alleen met iemand met wie je echt verbonden bent', async () => {
  /* De poort hangt aan het doel en niet verderop (LAT-regel 7): deze route
     mag geen link uitdelen voor een codenaam die je niet kent, ook al zou
     /api/comm/begin het later alsnog weigeren. */
  const a = await lid('Chat A', 'ca@x.nl', 'rtg');
  const b = await lid('Chat B', 'cb@x.nl', 'rtg');
  const vreemde = await lid('Chat X', 'cx@x.nl', 'rtg');

  const mijA = await json(await post('/api/member/connections', {}, a.token));
  const mijB = await json(await post('/api/member/connections', {}, b.token));
  await post('/api/member/connect', { key: mijB.me }, a.token);
  await post('/api/member/connect/respond', { key: mijA.me, action: 'accept' }, b.token);

  const r = await json(await post('/api/wereld/gesprek', { codenaam: b.codenaam, over: 'rtg://salon/ab12' }, a.token));
  assert.match(r.url, /^\/apps\/comm\.html\?met=/, 'hij wijst naar de aparte berichten-app');
  assert.ok(r.url.includes(encodeURIComponent(b.codenaam)), 'met de codenaam erin');
  assert.ok(!r.url.includes(mijB.me), 'en nooit een sleutel');
  assert.ok(r.url.includes('over='), 'het onderwerp gaat mee');

  // een vluchtig ding (een verhaal leeft 24 uur) hoort niet als link door te leven
  const vluchtig = await json(await post('/api/wereld/gesprek', { codenaam: b.codenaam, over: 'rtg://verhalen/x1' }, a.token));
  assert.ok(!vluchtig.url.includes('over='), 'een verhaal gaat niet als verwijzing mee');

  // en de drie manieren waarop het NIET mag
  assert.equal((await post('/api/wereld/gesprek', { codenaam: vreemde.codenaam }, a.token)).status, 403,
    'een vreemde levert geen link op');
  assert.equal((await post('/api/wereld/gesprek', { codenaam: 'BestaatNiet9' }, a.token)).status, 403,
    'een codenaam die niet bestaat evenmin');
  assert.equal((await post('/api/wereld/gesprek', {}, a.token)).status, 400, 'zonder wie: geweigerd');
});

/* ---------- de twee lijsten die gelijk moeten blijven ---------- */

test('zakelijkPro zegt hetzelfde als de echte PRO-poort van routes/zakelijk.js', async () => {
  /* Getoetst tegen de ECHTE route: we kloppen met elke pas op /api/zakelijk/feed
     en vergelijken of hij binnenkomt met wat rechten.zakelijkPro voorspelt.
     Zouden we hier de PRO-lijst uit dat bestand importeren en met onze lijst
     vergelijken, dan toetsten we twee kopieën tegen elkaar en zou de toets ook
     slagen als beide fout zijn. */
  const passen = [
    ['rtg', await lid('Poort Gratis', 'poort1@x.nl', 'rtg')],
    ['lifestyle', await lid('Poort Lief', 'poort2@x.nl', 'lifestyle')],
    ['business', await lid('Poort Baas', 'poort3@x.nl', 'business')]
  ];
  for (const [pas, l] of passen) {
    const r = await post('/api/zakelijk/feed', {}, l.token);
    const binnen = r.status === 200;
    assert.equal(binnen, rechten.zakelijkPro(pas),
      'pas ' + pas + ': de echte poort (' + r.status + ') en zakelijkPro lopen uiteen');
  }
});

/* ---------- de rechten zelf, zonder server ---------- */

test('de trap is cumulatief: elke pas heeft alles van de pas eronder', () => {
  const r = rechten.vermogens('rtg'), l = rechten.vermogens('lifestyle'), b = rechten.vermogens('business');
  for (const v of r) assert.ok(l.includes(v), 'Lifestyle mist het RTG-vermogen ' + v);
  for (const v of l) assert.ok(b.includes(v), 'Business mist het Lifestyle-vermogen ' + v);
  assert.ok(b.length > l.length && l.length > r.length, 'en elke trede voegt echt iets toe');
  assert.deepEqual(rechten.vermogens('guest'), [], 'een gast heeft geen enkel vermogen');
  assert.deepEqual(rechten.modiVoor('guest'), [], 'en dus ook geen enkele wereld');
});

test('elke soort in de koppelkaart beantwoordt de deelvraag bewust', () => {
  for (const [soort, k] of Object.entries(koppel.KAART)) {
    assert.equal(typeof k.deel, 'boolean', soort + ' zegt niet of hij gedeeld mag worden');
    const ref = 'rtg://' + soort + '/abc123';
    assert.equal(koppel.magDelen(ref), k.deel, soort + ': magDelen volgt de kaart niet');
    assert.ok(koppel.open(ref).url.startsWith(k.app), soort + ': open() wijst naar een andere app dan de kaart');
  }
});
