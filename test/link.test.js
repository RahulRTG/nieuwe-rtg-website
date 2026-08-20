/* RTG LINK (server/kern/link/, LINK.md) -- de adres- en capabilitylaag.

   Wat hier bewezen moet worden is niet dat een code te lezen valt (dat doet
   test/rtgcode.test.js), maar de vier beloftes waar de laag op staat:

   1. TWEE DEUREN, EEN WAARHEID. De contactpin heeft zijn eigen loketten en de
      linkdeur wijst dezelfde mensen aan. Lopen ze uit elkaar, dan is er een
      tweede uitvoering ontstaan (LAT.md regel 4) -- en dat is precies de fout
      die je pas maanden later ziet.
   2. DE REM IS VAN HET HUIS. Sinds de verhuizing naar kern/link/rem.js delen de
      deuren hun budget. Een tweede deur met een eigen teller is geen tweede deur
      maar een omweg om de eerste heen.
   3. DE INTENTIELIJST KENT HET ONDERWERP NIET (LINK.md par. 3.1). Dat is geen
      belofte in commentaar maar in de handtekening, en hier wordt hij gemeten.
   4. ELKE INTENTIE WIJST NAAR EEN BESTAANDE WEG (LAT.md regel 6).

   Draai los: node --experimental-sqlite --test test/link.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const maakSociaal = require('../server/kern/sociaal');
const maakLink = require('../server/kern/link');
const intenties = require('../server/kern/link/intenties');
const { startServer, stop } = require('./helper');

const UUR = 60 * 60 * 1000;
const WORTEL = path.join(__dirname, '..');

/* Dezelfde nepdatabase als test/contactpin.test.js, met de linklaag erbovenop --
   want dat is de stapeling die in het echt ook draait: de laag leent zijn
   oplossers bij de deuren die er al zijn. */
function maak(opties = {}) {
  const beschermd = new Set(opties.beschermd || []);
  const crypto = require('node:crypto');
  const db = { data: { connections: [], blocks: [], reports: [], memberChats: {}, contactPins: {} } };
  const rtf = {
    profielInfoVanHandle(h) {
      if (!String(h).startsWith('rtf:')) return null;
      return { codenaam: 'Kind ' + h, kind: true, beschermd: beschermd.has(h) };
    },
    socialProfielen() { return []; }
  };
  const dyncode = require('../server/kern/dyncode')({ crypto,
    dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-linksleutel-')) });
  const sociaal = maakSociaal({ db, save() {}, sseToCustomer() {}, rtf, crypto,
    gidsHaal: h => ({ codename: 'Lid ' + h, tier: 'rtg' }),
    gidsHaalWacht: async h => ({ codename: 'Lid ' + h, tier: 'rtg' }),
    gidsZoekCodenaam: async () => [], media: {}, dyncodeGeef: () => dyncode });
  const link = maakLink({ db, save() {}, dyncodeGeef: () => dyncode,
    handleVanPin: sociaal.handleVanPin, pinNormaliseer: sociaal.pinNormaliseer,
    pinKijk: sociaal.pinKijk, liveKijk: sociaal.liveKijk,
    persoonRate: (mij) => sociaal.sociaalRate(mij, 'pinzoek', 30, UUR),
    zaakVan: (code) => (code === 'RITZ' ? { code: 'RITZ', name: 'Hotel Ritz' } : null) });
  link.linkRemReset();
  return { db, sociaal, link, dyncode };
}
const lid = (key) => ({ soort: 'lid', key });

/* ---------- 1. het register: welk soort ding is dit? ---------- */

test('het register duidt elke vorm die het huis kent, en niets anders', async () => {
  const { sociaal, link } = maak();
  const pin = sociaal.pinVan('A');
  const gevallen = [
    ['rtg:pin:' + pin, 'persoon', 'vast'],
    ['rtg:tafel:RITZ:Terras%203', 'plaats', 'vast'],
    ['rtg:entree:RITZ', 'zaak', 'vast'],
    ['rtg:kas:BETAAL123', 'betaalcode', 'vast']
  ];
  for (const [tekst, type, vorm] of gevallen) {
    const r = await link.linkLos(lid('B'), tekst);
    assert.equal(r.status, 200, tekst + ' hoort te lukken (' + (r.error || '') + ')');
    assert.equal(r.type, type, tekst);
    assert.equal(r.vorm, vorm, tekst);
  }
  // en een gewone tekst is geen code: geen type, en ook geen 404 die iets suggereert
  const vreemd = await link.linkLos(lid('B'), 'https://ergens-anders/qr');
  assert.equal(vreemd.status, 422);
  assert.match(vreemd.error, /geen RTG-code/i);
});

test('de linkdeur leest een pin zoals een mens hem doorgeeft', async () => {
  const { sociaal, link } = maak();
  const pin = sociaal.pinVan('A');
  const opHetScherm = pin.slice(0, 4) + '-' + pin.slice(4);        // zo staat hij er
  const uitgesproken = pin.slice(0, 4) + ' ' + pin.slice(4).toLowerCase();
  for (const vorm of [pin, opHetScherm, uitgesproken]) {
    const r = await link.linkLos(lid('B'), 'rtg:pin:' + vorm);
    assert.equal(r.status, 200, 'de vorm "' + vorm + '" hoort gewoon te werken');
    assert.equal(r.onderwerp.key, 'A');
  }
  // en iets dat geen pin IS, is geen 404 maar "dat is geen pin"
  const kort = await link.linkLos(lid('B'), 'rtg:pin:1234');
  assert.equal(kort.status, 400);
  assert.match(kort.error, /acht tekens/i);
});

test('een codesoort die het huis wel kent maar deze laag nog niet, zegt dat ook zo', async () => {
  const { link, dyncode } = maak();
  const zegel = dyncode.maak({ soort: 'zegel', code: 'Z1' });
  const r = await link.linkLos(lid('B'), zegel.token);
  assert.equal(r.status, 422);
  assert.equal(r.soort, 'zegel');
  assert.match(r.error, /nog niets mee/i);
  assert.doesNotMatch(r.error, /geen RTG-code/i, 'een code van ons is geen vreemde code');
});

/* ---------- 2. twee deuren, een waarheid ---------- */

test('de pindeur en de linkdeur wijzen dezelfde mens aan, met dezelfde band', async () => {
  const { sociaal, link } = maak();
  const pin = sociaal.pinVan('A');

  const viaPin = sociaal.pinZoek('B', pin);
  const viaLink = await link.linkLos(lid('B'), 'rtg:pin:' + pin);
  assert.equal(viaPin.key, 'A');
  assert.equal(viaLink.onderwerp.key, viaPin.key, 'dezelfde mens');
  assert.equal(viaLink.onderwerp.codename, viaPin.codename);
  assert.equal(viaLink.onderwerp.status, viaPin.st, 'dezelfde band');

  // en na het verbinden verschuift de band bij ALLEBEI mee
  await sociaal.pinVerbind('B', pin);
  const na = await link.linkLos(lid('B'), 'rtg:pin:' + pin);
  assert.equal(na.onderwerp.status, sociaal.pinZoek('B', pin).st);
  assert.equal(na.onderwerp.status, 'aangevraagd');
});

test('een pin die uit staat is bij BEIDE deuren stil, met hetzelfde antwoord als onbekend', async () => {
  const { sociaal, link } = maak();
  const pin = sociaal.pinVan('A');
  sociaal.pinUit('A', true);
  assert.equal(sociaal.pinZoek('B', pin).status, 404, 'de pindeur zwijgt');
  const uit = await link.linkLos(lid('B'), 'rtg:pin:' + pin);
  const onbekend = await link.linkLos(lid('B'), 'rtg:pin:00000000');
  assert.equal(uit.status, 404);
  assert.deepEqual(uit, onbekend, 'uit en onbekend geven op de linkdeur letterlijk hetzelfde');
});

test('beschermd en geblokkeerd geven op de linkdeur hetzelfde niets als onbekend', async () => {
  const { sociaal, link } = maak({ beschermd: ['rtf:kind'] });
  const kindPin = sociaal.pinVan('rtf:kind');
  const blokPin = sociaal.pinVan('C');
  sociaal.blokkeer('C', 'B');                        // C blokkeert B
  const onbekend = await link.linkLos(lid('B'), 'rtg:pin:00000000');
  assert.deepEqual(await link.linkLos(lid('B'), 'rtg:pin:' + kindPin), onbekend, 'een beschermd kind');
  assert.deepEqual(await link.linkLos(lid('B'), 'rtg:pin:' + blokPin), onbekend, 'iemand die jou blokkeerde');
});

/* ---------- 3. de remmen, en dat ze van de LAAG zijn ---------- */

test('missers op de linkdeur sluiten ook de pindeur: de rem is van het huis', async () => {
  const { sociaal, link } = maak();
  /* Verdeeld over tien vragers, ruim onder de dertig per lid: als de teller aan
     de VRAGER hing, zou geen van hen ook maar in de buurt komen. Hij hangt aan de
     deur, dus samen lopen ze het huisbudget leeg -- en dat merkt iemand die zelf
     nog niets deed, aan de ANDERE deur. */
  const budget = link.LINK_MIS_PER_MINUUT;
  for (let i = 0; i <= budget; i++)
    await link.linkLos(lid('gokker' + (i % 10)), 'rtg:pin:ZZ' + String(i).padStart(6, '0'));
  assert.equal(sociaal.pinZoek('nooit-eerder', '00000000').status, 429,
    'de contactpin deelt zijn rem met de linkdeur');
  assert.equal((await link.linkLos(lid('ook-niet-eerder'), 'rtg:tafel:RITZ:1')).status, 429,
    'en de linkdeur zelf gaat ook dicht, voor elk type');
  link.linkRemReset();
  assert.equal(sociaal.pinZoek('nooit-eerder', '00000000').status, 404, 'na het terugzetten weer open');
});

test('de dertig-per-uur van de contactpin geldt over de twee deuren samen', async () => {
  const { sociaal, link } = maak();
  // vijftien missers via de pindeur, vijftien via de linkdeur: samen dertig
  for (let i = 0; i < 15; i++) sociaal.pinZoek('vrager', 'AA' + String(i).padStart(6, '0'));
  for (let i = 0; i < 15; i++) await link.linkLos(lid('vrager'), 'rtg:pin:BB' + String(i).padStart(6, '0'));
  const pin = sociaal.pinVan('A');
  assert.equal(sociaal.pinZoek('vrager', pin).status, 429, 'de eenendertigste komt er niet door...');
  assert.equal((await link.linkLos(lid('vrager'), 'rtg:pin:' + pin)).status, 429,
    '...en ook niet langs de andere deur');
  // een ander lid heeft er geen last van: de teller hangt hier wel aan de vrager
  assert.equal((await link.linkLos(lid('ander'), 'rtg:pin:' + pin)).status, 200);
  link.linkRemReset();
});

test('een verlopen ondertekende code telt niet als misser, een vervalste wel', async () => {
  const { sociaal, link, dyncode } = maak();
  const c = sociaal.liveMaak('A');
  for (const v of sociaal.liveOpen.values()) v.vervalt = Date.now() - 1;
  const verlopen = dyncode.maak({ soort: 'contact', code: 'weg', ttlMs: 1000 });
  await new Promise(r => setTimeout(r, 1100));
  const r1 = await link.linkLos(lid('B'), verlopen.token);
  assert.equal(r1.status, 410, 'verlopen is verlopen');
  // vervalsen: de handtekening klopt niet meer
  const stuk = c.token.slice(0, -2) + (c.token.slice(-2) === 'AA' ? 'BB' : 'AA');
  const r2 = await link.linkLos(lid('B'), stuk);
  assert.equal(r2.status, 422);
  /* En nu het verschil dat de toets moet zien: honderd VERLOPEN codes laten de
     deur open, honderd VERVALSTE doen hem dicht. Een lid met een oude QR is geen
     raadster; wie zelf een token in elkaar zet, komt niet langs de handtekening. */
  link.linkRemReset();
  for (let i = 0; i < link.LINK_MIS_PER_MINUUT + 5; i++) await link.linkLos(lid('B'), verlopen.token);
  assert.equal((await link.linkLos(lid('B'), 'rtg:tafel:RITZ:1')).status, 200, 'verlopen kost geen budget');
  for (let i = 0; i < link.LINK_MIS_PER_MINUUT + 5; i++) await link.linkLos(lid('B'), stuk);
  assert.equal((await link.linkLos(lid('B'), 'rtg:tafel:RITZ:1')).status, 429, 'vervalsen kost dat wel');
  link.linkRemReset();
});

/* ---------- 4. de intenties ---------- */

test('de intentielijst hangt aan de SCANNER en niet aan de gescande mens', () => {
  /* De belofte staat in de handtekening: `voor` krijgt het onderwerp niet. Deze
     toets meet dat aan de bron, want een handtekening is met een extra veld zo
     opgerekt -- en dan is het menu een profieluitdraai (LINK.md par. 3.1). */
  const bron = fs.readFileSync(path.join(WORTEL, 'server/kern/link/intenties.js'), 'utf8');
  const code = bron.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const verboden of ['onderwerp', 'handle', 'require(', 'db.', 'codenaam']) {
    assert.ok(!code.includes(verboden),
      'intenties.js noemt "' + verboden + '" -- dan kan de lijst iets over de ANDER gaan zeggen');
  }
  // en dezelfde vraag geeft altijd hetzelfde antwoord: geen verborgen invoer
  const a = intenties.voor({ type: 'persoon', scanner: 'lid', vorm: 'vast', band: 'geen' });
  const b = intenties.voor({ type: 'persoon', scanner: 'lid', vorm: 'vast', band: 'geen' });
  assert.deepEqual(a, b);
  assert.deepEqual(a.map(i => i.id), ['contact.verbinden']);
});

/* De routetabel uit de bron: pad -> de poortwachters die ervoor staan. */
function routetabel() {
  const paden = new Map();
  (function loop(map) {
    for (const naam of fs.readdirSync(map)) {
      const p = path.join(map, naam);
      if (fs.statSync(p).isDirectory()) { loop(p); continue; }
      if (!naam.endsWith('.js')) continue;
      const bron = fs.readFileSync(p, 'utf8');
      for (const m of bron.matchAll(/app\.(?:get|post|put|delete|patch)\(\s*['"](\/api\/[^'"]*)['"]\s*,([^)]{0,120})/g))
        paden.set(m[1], (paden.get(m[1]) || '') + ' ' + m[2]);
    }
  })(path.join(WORTEL, 'server'));
  return paden;
}

test('elke intentie wijst naar een weg die echt bestaat', () => {
  /* Een menuregel zonder route is een belofte in tekst zonder belofte in code
     (LAT.md regel 6). We lezen de echte routetabel uit de bron. */
  const paden = routetabel();
  // eerst de meter zelf: vindt de scan te weinig, dan bewijst de rest niets
  assert.ok(paden.size > 500, 'de routescan vindt maar ' + paden.size + ' paden; dan meet deze toets niets');
  for (const c of intenties.CATALOGUS)
    for (const weg of Object.values(c.wegen))
      assert.ok(paden.has(weg), 'intentie ' + c.id + ' wijst naar ' + weg + ', en die route bestaat niet');
});

test('en die weg staat achter de poort die bij DIE scanner hoort', () => {
  /* DE TOETS HIERBOVEN WAS NIET GENOEG, en dat bleek bij de kassacode. 'kas.innen'
     bood een personeelssessie /api/supplier/pay/in aan: die route BESTAAT, dus de
     vorige toets liet hem door. Alleen staat er supplierAuth voor, en dat eist rol
     'supplier' -- een personeelssessie komt er nooit langs. Een menuregel die naar
     een deur wijst die voor jou op slot zit, is net zo goed een belofte zonder weg.

     De regel is eenvoudig: een weg voor een lid staat achter `auth`, een weg voor
     een zaak achter `supplierAuth`. Wie een rol toevoegt waarvoor dat niet opgaat,
     moet hier langs. */
  const POORT = { lid: 'auth', supplier: 'supplierAuth' };
  const paden = routetabel();
  let gekeken = 0;
  for (const c of intenties.CATALOGUS) {
    for (const [sleutel, weg] of Object.entries(c.wegen)) {
      const rol = sleutel.split(':')[0];
      const poort = POORT[rol];
      assert.ok(poort, 'de rol "' + rol + '" heeft geen bekende poort; vul POORT aan of denk na');
      const mw = paden.get(weg) || '';
      /* supplierAuth bevat 'auth' als deeltekst, dus voor een lid kijken we naar
         het hele woord -- anders keurt deze toets een zaakdeur goed voor een lid. */
      const heeft = poort === 'auth' ? /\bauth\b/.test(mw) : mw.includes(poort);
      assert.ok(heeft, 'intentie ' + c.id + ' geeft ' + rol + ' de weg ' + weg +
        ', maar daar staat geen ' + poort + ' voor (wel: "' + mw.trim() + '")');
      gekeken++;
    }
  }
  assert.ok(gekeken >= 6, 'er zijn maar ' + gekeken + ' wegen gekeurd; dan meet deze toets te weinig');
});

test('een zaak scant geen mens, en een lid int geen betaalcode', async () => {
  const { sociaal, link } = maak();
  const pin = sociaal.pinVan('A');
  const zaak = await link.linkLos({ soort: 'supplier', code: 'RITZ' }, 'rtg:pin:' + pin);
  assert.equal(zaak.status, 403, 'een zaak heeft geen band met een mens en lost hem dus niet op');
  const kasBijLid = await link.linkLos(lid('B'), 'rtg:kas:BETAAL123');
  assert.deepEqual(kasBijLid.intenties, [], 'een lid kan een kascode niet innen');
  const kasBijZaak = await link.linkLos({ soort: 'supplier', code: 'RITZ' }, 'rtg:kas:BETAAL123');
  assert.deepEqual(kasBijZaak.intenties.map(i => i.id), ['kas.innen']);
});

test('de naam van een plek komt uit ons register en niet uit de gescande code', async () => {
  const { link } = maak();
  const r = await link.linkLos(lid('B'), 'rtg:tafel:RITZ:Terras%203');
  assert.equal(r.onderwerp.naam, 'Hotel Ritz', 'de naam die WIJ kennen');
  assert.equal(r.onderwerp.plek, 'Terras 3');
  assert.deepEqual(r.intenties.map(i => i.id), ['plaats.bestellen']);
  // een sticker met een zaakcode die niet bestaat, levert niets op
  assert.equal((await link.linkLos(lid('B'), 'rtg:tafel:NEPZAAK:1')).status, 404);
});

test('de levende code geeft geen sleutel terug, ook niet via de linkdeur', async () => {
  const { sociaal, link } = maak();
  const c = sociaal.liveMaak('A');
  const r = await link.linkLos(lid('B'), c.token);
  assert.equal(r.type, 'persoon');
  assert.equal(r.vorm, 'levend');
  assert.equal(r.onderwerp.codename, 'Lid A');
  assert.equal(r.onderwerp.key, undefined, 'de sleutel hoort deze weg niet uit te komen');
  assert.deepEqual(r.intenties.map(i => i.id), ['contact.verbinden']);
  assert.equal(r.intenties[0].weg, '/api/member/pin/live/verbind', 'de levende weg, niet de vaste');
});

/* ---------- 5. de bon ---------- */

test('de bon bewaart wat er gebeurde, telt zijn staart en is van jou alleen', () => {
  const { link } = maak();
  link.linkBon({ wie: 'A', type: 'persoon', intentie: 'contact.verbinden', vorm: 'vast', naar: 'B' });
  const mijn = link.linkBonnen('A');
  assert.equal(mijn.bonnen.length, 1);
  assert.equal(mijn.bonnen[0].naar, 'B');
  assert.equal(link.linkBonnen('B').bonnen.length, 0, 'de ontvanger krijgt niet jouw bon');
  // de staart wordt geteld en niet stilgezwegen
  for (let i = 0; i < link.LINK_BON_MAX + 3; i++) link.linkBon({ wie: 'A', intentie: 'x' });
  const vol = link.linkBonnen('A');
  assert.equal(vol.bonnen.length, link.LINK_BON_MAX);
  assert.equal(vol.nietBewaard, 4, 'wat eraf viel staat er als getal bij');
});

/* ---------- 6. een waarheid over de rollen ---------- */

test('de scan-rollen en de uitgifte-rollen gaan over dezelfde lijst', () => {
  const { ROLLEN } = require('../server/kern/link/wie');
  const bron = fs.readFileSync(path.join(WORTEL, 'server/routes/code.js'), 'utf8');
  const blok = bron.slice(bron.indexOf('const MAG = {'), bron.indexOf('};', bron.indexOf('const MAG = {')));
  assert.ok(blok.includes('lid:'), 'de uitgiftelijst is gevonden');
  const rollen = [...blok.matchAll(/^\s{4}([a-z]+):/gm)].map(m => m[1]).filter(r => r !== 'lid');
  assert.deepEqual(rollen.sort(), [...ROLLEN].sort(),
    'wie.js kent andere rollen dan routes/code.js uitgeeft; dan herkent de ene deur iemand die de andere een rol geeft');
});

/* ---------- 7. de deur zelf, op een echte server ---------- */
let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-link-'));

test.before(async () => { ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } })); });
test.after(() => { stop(child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

const json = r => r.json();
function api(pad, body, token) {
  return fetch(BASE + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {}) });
}
async function nieuwLid(naam) {
  const reg = await json(await api('/api/auth/register', { name: naam,
    email: naam.replace(/\s/g, '') + Date.now() + '@voorbeeld.test', phone: '0611122233',
    password: 'geheim123', geboortedatum: '1990-05-05', tier: 'rtg' }));
  const st = await json(await api('/api/state', {}, reg.token));
  return { token: reg.token, codenaam: st.state.user.codename };
}

test('de linkdeur staat dicht zonder sessie en open met', async () => {
  const zonder = await api('/api/link/los', { tekst: 'rtg:pin:00000000' });
  assert.equal(zonder.status, 401, 'een gescande code is geen geloofsbrief');
  const anna = await nieuwLid('Anna Link');
  const eigen = await json(await api('/api/member/pin', {}, anna.token));
  const boris = await nieuwLid('Boris Link');
  const r = await json(await api('/api/link/los', { tekst: 'rtg:pin:' + eigen.pin }, boris.token));
  assert.equal(r.type, 'persoon');
  assert.equal(r.onderwerp.codename, anna.codenaam, 'de codenaam, nooit de echte naam');
  assert.ok(!JSON.stringify(r).includes('Anna Link'), 'de echte naam blijft in de kluis');
  assert.deepEqual(r.intenties.map(i => i.id), ['contact.verbinden']);
});

test('scannen doet niets; pas de handeling erna schrijft een bon', async () => {
  const carla = await nieuwLid('Carla Link');
  const dirk = await nieuwLid('Dirk Link');
  const pin = (await json(await api('/api/member/pin', {}, carla.token))).toon;

  /* Eerst nakijken DAT het scannen lukte. Zonder deze bewering ziet de toets het
     verschil niet tussen "kijken schrijft geen bon" en "er is niets gevonden, dus
     ook niets om over te schrijven" -- en dan bewijst hij het eerste niet
     (LAT.md regel 9). Zo is deze toets ook echt zakkend gezien. */
  const kijk = await json(await api('/api/link/los', { tekst: 'rtg:pin:' + pin }, dirk.token));
  assert.equal(kijk.onderwerp.codename, carla.codenaam, 'de scan vond Carla');
  const naKijken = await json(await api('/api/link/bonnen', {}, dirk.token));
  assert.deepEqual(naKijken.bonnen, [], 'kijken is geen daad, en dus geen bon');
  const stil = await json(await api('/api/member/connections', {}, carla.token));
  assert.equal((stil.requests || []).length, 0, 'en er ging ook echt niets de deur uit');

  // en nu de weg volgen die de intentie noemde
  await json(await api('/api/member/pin/connect', { pin }, dirk.token));
  const naDoen = await json(await api('/api/link/bonnen', {}, dirk.token));
  assert.equal(naDoen.bonnen.length, 1);
  assert.equal(naDoen.bonnen[0].intentie, 'contact.verbinden');
  assert.equal(naDoen.bonnen[0].vorm, 'vast');
  assert.equal((await json(await api('/api/link/bonnen', {}, carla.token))).bonnen.length, 0,
    'de ontvanger heeft niets gedaan en heeft dus geen bon');
});
