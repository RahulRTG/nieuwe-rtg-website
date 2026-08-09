/* Bewaren, een reis bouwen, en de vraagkant van de Mall.

   Twee dingen die als aparte functies waren bedacht en er een zijn (een
   verlanglijst en "voeg toe aan mijn reis"), plus de aanvraagmarkt: wat niemand
   aanbiedt, kun je vragen.

   Draai los: node --experimental-sqlite --test test/mall-lijsten.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const { MAX_LIJSTEN } = require('../server/kern/mall/lijsten');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-lijst-'));
let srv, base, lid, gast;
const tok = {};

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
async function login(code) {
  const roster = await api('/api/supplier/roster', { code });
  const chef = (roster.body.staff || []).find(m => m.role === 'manager');
  return chef ? (await api('/api/supplier/login', { code, staffId: chef.id, pin: '1234' })).body.token : null;
}
const zoek = async (body) => (await api('/api/mall/zoek', { per: 60, ...(body || {}) }, lid)).body;

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const reg = await api('/api/auth/register', { name: 'Lijst Lid', email: 'lijst@x.nl', phone: '0612345674',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'lifestyle', pasApp: 'lifestyle' });
  lid = reg.body.token;
  // een echte gratis gast (tier 'guest'), zoals de app hem maakt
  gast = (await api('/api/login', { tier: 'guest', pasApp: 'rtg' })).body.token;
  assert.ok(gast, 'de gast heeft een sessie');
  tok.SERENA = await login('SERENA');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

/* ---------------------------------------------------------------------------
   1. Lijsten en de reismand.
   --------------------------------------------------------------------------- */

test('1. een lijst bewaart wat je in de Mall tegenkomt', async () => {
  const nieuw = await api('/api/mall/lijst/nieuw', { naam: 'Later kopen' }, lid);
  assert.equal(nieuw.status, 200);
  assert.equal(nieuw.body.lijst.soort, 'lijst', 'zonder soort is het een gewone lijst');

  const iets = (await zoek({})).items[0];
  assert.ok(iets, 'er is aanbod om te bewaren');
  const bij = await api('/api/mall/lijst/voegtoe', { id: nieuw.body.lijst.id, aanbodId: iets.id }, lid);
  assert.equal(bij.status, 200);
  assert.equal(bij.body.aantal, 1);

  // twee keer hetzelfde is geen twee regels
  const nog = await api('/api/mall/lijst/voegtoe', { id: nieuw.body.lijst.id, aanbodId: iets.id }, lid);
  assert.equal(nog.status, 409, 'hetzelfde aanbod komt er geen tweede keer in');

  const toon = await api('/api/mall/lijst', { id: nieuw.body.lijst.id }, lid);
  assert.equal(toon.body.lijst.regels.length, 1);
  const r = toon.body.lijst.regels[0];
  assert.equal(r.vervallen, false);
  assert.equal(r.aanbod.titel, iets.titel, 'de regel is gekoppeld aan het levende aanbod');
  assert.equal(r.titel, iets.titel, 'en draagt zelf de titel, zodat hij ook zonder het aanbod leesbaar blijft');
});

test('2. een bewaard aanbod dat verdwijnt, vervalt zichtbaar', async () => {
  /* Puur op de kern, want een aanbod laten verdwijnen vraagt om het weghalen
     van een zaak. Stilweg verdwijnen laat iemand zoeken naar iets waarvan hij
     zeker weet dat hij het had bewaard. */
  const { maakMall } = require('../server/kern/mall');
  const db = { data: {
    suppliers: [{ code: 'W', name: 'Winkel', type: 'retail', city: 'Testdorp',
      artikelen: [{ id: 'x1', naam: 'Ding', publiekePrijs: 10, varianten: [{ voorraad: 1 }] }] }],
    supplierTypes: { retail: { label: 'Retail', caps: ['retail'] } },
    partnerTrips: [], markt: { ads: [] }
  } };
  require('../server/kern/werkvormen').haakAan(db);
  const mall = maakMall({ db, save() {}, crypto: require('crypto'),
    isRetail: (s) => s.type === 'retail', haalThuis: () => null, haalLandVind: () => null }).mall;

  const l = mall.mallLijsten.maak('k1', { naam: 'Test' }).lijst;
  const id = mall.mallZoek({}).items[0].id;
  assert.equal(mall.mallLijsten.voegToe('k1', l.id, id).ok, true);

  // de winkel haalt het artikel weg
  db.data.suppliers[0].artikelen = [];
  const na = mall.mallLijsten.toon('k1', l.id);
  assert.equal(na.aantal, 1, 'de regel staat er nog');
  assert.equal(na.lijst.regels[0].vervallen, true, 'maar is als vervallen gemarkeerd');
  assert.ok(na.lijst.regels[0].reden, 'met een reden erbij');
  assert.equal(na.lijst.regels[0].titel, 'Ding', 'en je ziet nog steeds WAT je had bewaard');
  assert.equal(na.vervallen, 1, 'en de lijst telt ze');
});

test('3. een reis is dezelfde lijst met een plek, een periode en vier vakjes', async () => {
  const reis = await api('/api/mall/lijst/nieuw', {
    naam: 'Ibiza augustus', soort: 'reis', plek: 'Ibiza', van: '2026-08-13', tot: '2026-08-19'
  }, lid);
  assert.equal(reis.status, 200);
  const id = reis.body.lijst.id;
  assert.equal(reis.body.lijst.soort, 'reis');

  const leeg = await api('/api/mall/lijst', { id }, lid);
  assert.ok(leeg.body.reis, 'een reis krijgt een reisbeeld');
  assert.equal(leeg.body.reis.plek, 'Ibiza');
  assert.equal(leeg.body.reis.onderdelen.length, 4);
  assert.ok(leeg.body.reis.onderdelen.every(o => o.heeft === false), 'nog niets binnen');

  // een verblijf erbij
  const verblijf = (await zoek({ type: 'verblijf' })).items[0];
  assert.ok(verblijf, 'er is een verblijf');
  await api('/api/mall/lijst/voegtoe', { id, aanbodId: verblijf.id }, lid);
  const na = await api('/api/mall/lijst', { id }, lid);
  const vak = na.body.reis.onderdelen.find(o => o.id === 'verblijf');
  assert.equal(vak.heeft, true, 'het vakje Verblijf is nu gevuld');
  assert.ok(na.body.reis.onderdelen.some(o => !o.heeft), 'en de rest staat nog open');
  assert.match(na.body.reis.opmerking, /niet in een keer/, 'met de eerlijke tekst dat dit geen afrekening is');
});

test('4. lijsten zijn van het lid en van niemand anders', async () => {
  const mijn = await api('/api/mall/lijsten', {}, lid);
  assert.ok(mijn.body.lijsten.length >= 2, 'het lid heeft lijsten');
  const anders = await api('/api/mall/lijsten', {}, gast);
  assert.equal(anders.body.lijsten.length, 0, 'een ander account ziet ze niet');

  // en kan er ook niet in kijken met een id dat hij ergens vandaan heeft
  const id = mijn.body.lijsten[0].id;
  const inkijk = await api('/api/mall/lijst', { id }, gast);
  assert.equal(inkijk.status, 404, 'een lijst van een ander bestaat voor jou niet');
});

test('5. de lijst kent een bovengrens en zegt dat', async () => {
  const uniek = 'vol' + Date.now();
  const v = await api('/api/auth/register', { name: 'Vol Lid', email: uniek + '@x.nl', phone: '0612300000',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'lifestyle', pasApp: 'lifestyle' });
  const t = v.body.token;
  for (let i = 0; i < MAX_LIJSTEN; i++) {
    const r = await api('/api/mall/lijst/nieuw', { naam: 'Lijst ' + i }, t);
    assert.equal(r.status, 200, 'lijst ' + i + ' mag nog');
  }
  const over = await api('/api/mall/lijst/nieuw', { naam: 'Eentje te veel' }, t);
  assert.equal(over.status, 409, 'de grens wordt gehandhaafd');
  assert.match(over.body.error, new RegExp(String(MAX_LIJSTEN)), 'en de melding noemt hem');
});

/* ---------------------------------------------------------------------------
   2. De vraagkant.
   --------------------------------------------------------------------------- */

test('6. een lid plaatst een vraag, en de juiste zaak ziet hem', async () => {
  const a = await api('/api/mall/aanvraag', {
    wat: 'Massage aan huis voor twee personen', verdieping: 'beauty', plek: 'Ibiza', budget: 200
  }, lid);
  assert.equal(a.status, 200, JSON.stringify(a.body));
  assert.equal(a.body.aanvraag.status, 'open');
  assert.equal(a.body.aanvraag.van, 'u', 'voor het lid zelf staat er "u"');

  const zicht = await api('/api/supplier/mall/aanvragen', {}, tok.SERENA);
  assert.equal(zicht.status, 200);
  assert.equal(zicht.body.verdieping, 'beauty', 'de wellness-zaak hoort bij beauty');
  const gezien = zicht.body.aanvragen.find(x => x.id === a.body.aanvraag.id);
  assert.ok(gezien, 'en ziet de aanvraag');
  assert.notEqual(gezien.van, 'u', 'de zaak ziet de codenaam, niet "u"');
  assert.equal(gezien.van, zicht.body.aanvragen[0].van);
});

test('7. een zaak buiten het vak ziet de aanvraag niet', async () => {
  /* De aanvraag staat met opzet in DEZELFDE plaats als de zaak. Stond hij in
     Haarlem, dan hield de plaatsfilter hem al tegen en werd de vakfilter niet
     gemeten: de mutatie "elke zaak ziet elke aanvraag" liet toen geen enkele
     toets zakken (LAT-regel 9). Nu is de plaats gelijk en is het vak het enige
     verschil. */
  const bouw = await api('/api/mall/aanvraag', {
    wat: 'Lekkende kraan in de keuken', verdieping: 'diensten', plek: 'Ibiza'
  }, lid);
  assert.equal(bouw.status, 200);
  const zicht = await api('/api/supplier/mall/aanvragen', {}, tok.SERENA);
  assert.ok(zicht.body.aanvragen.length >= 1, 'de zaak ziet wel andere aanvragen uit Ibiza, anders meet dit niets');
  assert.ok(!zicht.body.aanvragen.some(x => x.id === bouw.body.aanvraag.id),
    'maar een wellness-zaak krijgt geen loodgietersklus in beeld, ook niet in haar eigen stad');

  // en kan er ook niet op reageren
  const poging = await api('/api/supplier/mall/aanvraag/reageer', { id: bouw.body.aanvraag.id, tekst: 'Ik doe het wel' }, tok.SERENA);
  assert.equal(poging.status, 403, 'reageren buiten je vak of werkgebied kan niet');
});

test('8. een zaak reageert, het lid kiest, en er wordt niets geboekt', async () => {
  const a = await api('/api/mall/aanvraag', { wat: 'Gezichtsbehandeling zaterdag', verdieping: 'beauty', plek: 'Ibiza' }, lid);
  const id = a.body.aanvraag.id;

  const r1 = await api('/api/supplier/mall/aanvraag/reageer', { id, tekst: 'Kan zaterdag om 14:00', prijs: 95 }, tok.SERENA);
  assert.equal(r1.status, 200);
  assert.equal(r1.body.aanvraag.aantalReacties, 1);

  // dezelfde zaak die zich bedenkt, wijzigt haar reactie
  const r2 = await api('/api/supplier/mall/aanvraag/reageer', { id, tekst: 'Toch liever 15:00', prijs: 90 }, tok.SERENA);
  assert.equal(r2.body.aanvraag.aantalReacties, 1, 'geen tweede reactie van dezelfde zaak');
  assert.equal(r2.body.aanvraag.reacties[0].prijs, 90, 'de reactie is bijgewerkt');

  const mijn = await api('/api/mall/aanvragen/mijn', {}, lid);
  const die = mijn.body.aanvragen.find(x => x.id === id);
  assert.equal(die.reacties.length, 1, 'het lid ziet de reactie');

  const kies = await api('/api/mall/aanvraag/kies', { id, code: 'SERENA' }, lid);
  assert.equal(kies.status, 200);
  assert.equal(kies.body.aanvraag.status, 'gegund');
  assert.equal(kies.body.aanvraag.reacties[0].gekozen, true);
  assert.match(kies.body.opmerking, /nog niets geboekt of betaald/, 'en dat wordt met zoveel woorden gezegd');
});

test('9. een gratis gast plaatst geen aanvragen', async () => {
  const r = await api('/api/mall/aanvraag', { wat: 'Iets willekeurigs', verdieping: 'diensten', plek: 'Haarlem' }, gast);
  assert.equal(r.status, 403, 'een open vraagmarkt voor gratis accounts is binnen een week een prikbord met troep');
});

test('10. een aanvraag zonder vak of plaats wordt geweigerd, met de reden', async () => {
  const zonderVak = await api('/api/mall/aanvraag', { wat: 'Ik zoek iets moois', plek: 'Ibiza' }, lid);
  assert.equal(zonderVak.status, 400);
  assert.match(zonderVak.body.error, /juiste zaken/, 'zonder vak zou elke zaak alles krijgen');

  const zonderPlek = await api('/api/mall/aanvraag', { wat: 'Ik zoek iets moois', verdieping: 'beauty' }, lid);
  assert.equal(zonderPlek.status, 400);
  assert.match(zonderPlek.body.error, /plaats/);

  const teKort = await api('/api/mall/aanvraag', { wat: 'hm', verdieping: 'beauty', plek: 'Ibiza' }, lid);
  assert.equal(teKort.status, 400);
});

/* ---------------------------------------------------------------------------
   3. De schermen. Niet de opmaak, maar de belofte: de knoppen die dit scherm
      aanbiedt bestaan als route, en wat het scherm zegt klopt met wat de server
      doet. Een scherm dat een route aanroept die niet bestaat is de stilste
      vorm van stuk die er is.
   --------------------------------------------------------------------------- */

test('11. elke route die de nieuwe schermen aanroepen, bestaat ook echt', async () => {
  const paden = new Set();
  for (const f of ['mijnmall.js', 'mijnmall-aanvragen.js', 'leverancier-aanvragen.js']) {
    const bron = fs.readFileSync(path.join(__dirname, '..', 'public', 'apps', f), 'utf8');
    for (const m of bron.matchAll(/api\('(\/api\/[a-z0-9/_-]+)'/g)) paden.add(m[1]);
  }
  assert.ok(paden.size >= 8, 'de schermen roepen werkelijk routes aan (' + paden.size + ')');
  for (const pad of paden) {
    // zonder sessie hoort elke route te weigeren; 404 zou betekenen: bestaat niet
    const r = await fetch(base + pad, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.notEqual(r.status, 404, pad + ' bestaat als route');
    assert.ok([400, 401, 403].includes(r.status), pad + ' is dicht zonder sessie (' + r.status + ')');
  }
});

test('12. de schermen staan in de app-gids en de catalogus', () => {
  /* Een scherm dat nergens vandaan te bereiken is, bestaat voor een lid niet.
     De keuring eist een app-gids; dit houdt vast dat hij ook echt over DEZE
     schermen gaat en niet over een lege plek. */
  const gids = require('../server/kern/appgids');
  for (const pad of ['/apps/mijnmall.html', '/apps/leverancier-aanvragen.html']) {
    const g = gids.appgids ? gids.appgids(pad) : (gids.GIDS || {})[pad];
    const gevonden = g || require('../server/kern/appgids-data/deel2')[pad];
    assert.ok(gevonden, pad + ' heeft een app-gids');
    assert.ok(gevonden.wat && gevonden.doe && gevonden.doe.length >= 2, pad + ' zegt wat het is en wat je er doet');
  }
  const { APPS } = require('../server/kern/appbieb');
  const mijn = APPS.find(a => a.url === '/apps/mijnmall.html');
  assert.ok(mijn, 'Mijn Mall staat in de App-Bibliotheek');
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'public', mijn.url)), 'en de pagina bestaat');
});
