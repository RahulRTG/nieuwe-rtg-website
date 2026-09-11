/* WELKE KAARTEN WIL DIT LID -- de keuzelaag (kern/navigatie/mijnkaarten.js).

   RTG biedt elk gebied aan dat de bron kan leveren; een lid kiest zelf welke
   kaarten hij wil hebben. Wat hier bewezen wordt is niet dat er een lijst
   bewaard wordt (dat is een array in een object), maar de dingen die een lid
   kunnen misleiden:

     - "aangeboden" en "gebouwd" blijven apart, en de KEUZE is een derde ding;
     - een gebied dat niet te kiezen is, zegt WAAROM -- twee redenen, en ze
       zijn allebei echt (de licentiepoort, en een bron zonder downloadadres);
     - kiezen van iets dat nog niet gebouwd is mag WEL en het antwoord zegt met
       zoveel woorden dat er dan nog niet gerekend wordt;
     - de kantoorkant telt AANTALLEN en nooit wie -- welke landen iemand wil
       hebben, zegt iets over waar hij komt.

   Draai los: node --test test/navigatiemijnkaarten.test.js */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { bouwPakket } = require('./navigatie-pakket-fixture');

const NL_VAK = { lat0: 50.7, lat1: 53.72, lng0: 3.2, lng1: 7.3 };
const GEBIEDEN = [
  { code: 'nederland', naam: 'Nederland', soort: 'land', vak: NL_VAK,
    downloadAdres: 'https://example.invalid/nederland.osm.pbf' },
  { code: 'frankrijk', naam: 'Frankrijk', soort: 'land', vak: { lat0: 41, lat1: 51.2, lng0: -5.2, lng1: 9.6 },
    downloadAdres: 'https://example.invalid/frankrijk.osm.pbf' },
  /* Zonder downloadadres: staat in de index, is nooit te bouwen. */
  { code: 'atlantis', naam: 'Atlantis', soort: 'land', vak: { lat0: 20, lat1: 30, lng0: -40, lng1: -30 } }
];

/* Een verse datamap met een index, en desgevraagd een gebouwd pakket. De
   modules worden opnieuw geladen omdat de gebiedenlaag zijn index en catalogus
   op een mtime onthoudt. */
function metWereld(fn, { bouw = [], licentie = 'ODbL 1.0', naamsvermelding = 'OpenStreetMap-bijdragers' } = {}) {
  const oud = process.env.RTG_DATA_DIR;
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-mijnkaarten-'));
  const nav = path.join(map, 'navigatie');
  fs.mkdirSync(nav, { recursive: true });
  fs.writeFileSync(path.join(nav, 'gebieden.json'), JSON.stringify({
    bron: 'fixture', licentie, naamsvermelding, gebieden: GEBIEDEN }));
  for (const code of bouw) {
    const g = GEBIEDEN.find(x => x.code === code);
    bouwPakket({ map: nav, code, lat: (g.vak.lat0 + g.vak.lat1) / 2, lng: (g.vak.lng0 + g.vak.lng1) / 2,
      plaats: g.naam, land: g.naam, licentie });
  }
  process.env.RTG_DATA_DIR = map;
  for (const m of ['gebieden', 'gebiedsindex', 'pakket', 'mijnkaarten']) {
    delete require.cache[require.resolve('../server/kern/navigatie/' + m + '.js')];
  }
  delete require.cache[require.resolve('../server/kern/eigencollectie.js')];
  const db = { data: {} };
  const laag = require('../server/kern/navigatie/mijnkaarten.js')({ db, save() {} });
  try { return fn({ laag, db, map }); }
  finally {
    if (oud === undefined) delete process.env.RTG_DATA_DIR; else process.env.RTG_DATA_DIR = oud;
    for (const m of ['gebieden', 'gebiedsindex', 'pakket', 'mijnkaarten']) {
      delete require.cache[require.resolve('../server/kern/navigatie/' + m + '.js')];
    }
    delete require.cache[require.resolve('../server/kern/eigencollectie.js')];
    try { fs.rmSync(map, { recursive: true, force: true }); } catch (e) {}
  }
}

test('1. het beeld houdt aangeboden, gebouwd en gekozen apart', () => {
  metWereld(({ laag }) => {
    const b = laag.navKaartenBeeld('LID-1');
    assert.equal(b.telling.aangeboden, 3);
    /* EEN gebied is gebouwd. Zouden die twee samen worden geteld, dan belooft
       het scherm een kaart die niemand heeft gebouwd. */
    assert.equal(b.telling.gebouwd, 1);
    assert.equal(b.telling.gekozen, 0, 'gekozen is een DERDE ding en geen gevolg van gebouwd');
    const nl = b.gebieden.find(g => g.code === 'nederland');
    assert.equal(nl.gebouwd, true);
    assert.equal(nl.aangeboden, true);
    assert.equal(nl.gekozen, false);
    const fr = b.gebieden.find(g => g.code === 'frankrijk');
    assert.equal(fr.gebouwd, false, 'aangeboden is geen dekking');
  }, { bouw: ['nederland'] });
});

test('2. kiezen van een NIET gebouwd gebied mag, en het antwoord zegt dat er niet gerekend wordt', () => {
  metWereld(({ laag }) => {
    const r = laag.navKaartKies('LID-1', 'frankrijk');
    assert.equal(r.status, 200);
    assert.equal(r.gekozen, true);
    assert.equal(r.gebouwd, false);
    /* Dit is de hele reden dat kiezen mag: het IS het verzoek. Maar een lid
       mag niet denken dat er al een kaart klaarstaat. */
    assert.match(r.wat, /nog niet gebouwd/);
    assert.match(r.wat, /rekent de navigatie hier niet/);

    const g = laag.navKaartKies('LID-1', 'nederland');
    assert.match(g.wat, /meteen gebruikt/, 'en een gebouwd gebied zegt iets anders: ' + g.wat);
    assert.notEqual(g.wat, r.wat, 'twee heel verschillende dingen, dus twee zinnen');
  }, { bouw: ['nederland'] });
});

test('3. een gebied zonder downloadadres is niet te kiezen, met de reden', () => {
  metWereld(({ laag }) => {
    const b = laag.navKaartenBeeld('LID-1');
    const a = b.gebieden.find(g => g.code === 'atlantis');
    assert.ok(a, 'hij staat er WEL: weglaten roept de vraag op waarom hij ontbreekt');
    assert.equal(a.teKiezen, false);
    assert.match(a.waarom, /downloadadres/);
    const r = laag.navKaartKies('LID-1', 'atlantis');
    assert.equal(r.status, 409, 'en de route weigert hem ook');
    assert.match(r.error, /downloadadres/);
  });
});

test('4. zonder naamsvermelding is NIETS te kiezen: de licentiepoort staat hier ook', () => {
  metWereld(({ laag }) => {
    const b = laag.navKaartenBeeld('LID-1');
    assert.equal(b.gebieden.every(g => !g.teKiezen), true, 'ODbL zonder vermelding: geen enkel gebied');
    for (const g of b.gebieden) assert.match(g.waarom, /naamsvermelding/);
    assert.equal(laag.navKaartKies('LID-1', 'nederland').status, 409);
  }, { naamsvermelding: '' });
});

test('5. de keuze is van DIT lid en lekt niet naar een ander', () => {
  metWereld(({ laag }) => {
    laag.navKaartKies('LID-1', 'nederland');
    assert.deepEqual(laag.navKaartenBeeld('LID-1').mijn, ['nederland']);
    assert.deepEqual(laag.navKaartenBeeld('LID-2').mijn, [], 'een ander lid ziet zijn eigen lijst');
    laag.navKaartKies('LID-2', 'frankrijk');
    assert.deepEqual(laag.navKaartenBeeld('LID-1').mijn, ['nederland'], 'en de eerste blijft ongemoeid');
  }, { bouw: ['nederland'] });
});

test('6. twee keer kiezen geeft EEN keuze, en weghalen wat er niet staat is geen fout', () => {
  metWereld(({ laag }) => {
    laag.navKaartKies('LID-1', 'nederland');
    laag.navKaartKies('LID-1', 'nederland');
    assert.deepEqual(laag.navKaartenBeeld('LID-1').mijn, ['nederland'], 'geen dubbele rij');
    /* HET BEELD ZIET EEN DUBBELING NIET: het bouwt een Set, dus een tweede
       rij in de OPSLAG valt daar weg. De mutatiemotor liet die versie
       overleven, en de schade zit dan bij het kantoor -- `navKaartVraag()`
       telt per lid zijn eigen lijst af, dus een lid dat twee keer in zijn
       eigen rij staat, telt als twee leden die deze kaart willen. */
    const v = laag.navKaartVraag().gevraagd.find(x => x.code === 'nederland');
    assert.equal(v.aantal, 1, 'een lid dat twee keer kiest, is EEN lid dat deze kaart wil');
    const eerst = laag.navKaartWeg('LID-1', 'nederland');
    assert.equal(eerst.verwijderd, true);
    const nog = laag.navKaartWeg('LID-1', 'nederland');
    assert.equal(nog.status, 200, 'twee tikken op dezelfde knop is geen foutmelding');
    assert.equal(nog.verwijderd, false, 'maar het antwoord zegt wel dat er niets af ging');
  }, { bouw: ['nederland'] });
});

test('7. de kantoorvraag telt AANTALLEN en nooit wie', () => {
  metWereld(({ laag }) => {
    laag.navKaartKies('LID-1', 'frankrijk');
    laag.navKaartKies('LID-2', 'frankrijk');
    laag.navKaartKies('LID-3', 'nederland');
    const v = laag.navKaartVraag();
    const fr = v.gevraagd.find(x => x.code === 'frankrijk');
    assert.equal(fr.aantal, 2);
    assert.equal(v.gevraagd[0].code, 'frankrijk', 'het meest gevraagde bovenaan');
    /* GEEN SLEUTELS IN HET ANTWOORD. Welke landen iemand wil hebben, zegt iets
       over waar hij komt; dat hoort bij de codenaam en nooit in een lijst die
       een medewerker leest. De bewering staat op de hele tekst en niet op een
       veld, want een nieuw veld zou hem stil kunnen introduceren. */
    const tekst = JSON.stringify(v);
    for (const sleutel of ['LID-1', 'LID-2', 'LID-3']) {
      assert.equal(tekst.includes(sleutel), false, sleutel + ' staat niet in het antwoord');
    }
  }, { bouw: ['nederland'] });
});

test('8. het antwoord zegt dat de kaart NIET op het toestel staat', () => {
  metWereld(({ laag }) => {
    const b = laag.navKaartenBeeld('LID-1');
    /* Een leeg veld wordt door de lezer met zijn eigen aanname gevuld. Dus
       niet alleen `false`, maar ook waarom -- en dat het de lijst is die het
       toestel straks ophaalt. */
    /* NULL EN NIET FALSE, en dat is de hele bewering: sinds
       kern/navigatie/toestelpakket.js is de kaart wel op te halen, maar deze
       laag kan niet WETEN of hij op het toestel staat -- dat meet het scherm
       (shared/kaartpakket.js). `false` zou een bewering zijn die deze kant
       niet kan doen. */
    assert.equal(b.opToestel, null);
    assert.match(b.opToestelWaarom, /alleen het toestel/i);
    assert.match(b.opToestelWaarom, /opruimen/, 'en dat de browser hem mag weggooien');
  }, { bouw: ['nederland'] });
});

test('9. zonder gebiedsindex is de lijst leeg MET een reden, en niet stilzwijgend nul', () => {
  const oud = process.env.RTG_DATA_DIR;
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-mijnkaarten-leeg-'));
  try {
    process.env.RTG_DATA_DIR = map;
    for (const m of ['gebieden', 'gebiedsindex', 'pakket', 'mijnkaarten']) {
      delete require.cache[require.resolve('../server/kern/navigatie/' + m + '.js')];
    }
    delete require.cache[require.resolve('../server/kern/eigencollectie.js')];
    const laag = require('../server/kern/navigatie/mijnkaarten.js')({ db: { data: {} }, save() {} });
    const b = laag.navKaartenBeeld('LID-1');
    assert.deepEqual(b.gebieden, []);
    assert.ok(b.reden, 'er staat een reden');
    assert.match(b.reden, /navigatie:index/, 'en die wijst de weg: ' + b.reden);
  } finally {
    if (oud === undefined) delete process.env.RTG_DATA_DIR; else process.env.RTG_DATA_DIR = oud;
    for (const m of ['gebieden', 'gebiedsindex', 'pakket', 'mijnkaarten']) {
      delete require.cache[require.resolve('../server/kern/navigatie/' + m + '.js')];
    }
    delete require.cache[require.resolve('../server/kern/eigencollectie.js')];
    try { fs.rmSync(map, { recursive: true, force: true }); } catch (e) {}
  }
});

test('10. een keuze voor een gebied dat de bron niet meer aanbiedt, verdwijnt niet stil', () => {
  metWereld(({ laag, map }) => {
    laag.navKaartKies('LID-1', 'frankrijk');
    /* De bron laat Frankrijk vallen. De keuze van het lid wordt NIET
       opgeruimd -- een bron die een gebied een dag hernoemt, zou anders zijn
       lijst wissen -- maar het verschil tussen "gekozen" en "op het scherm"
       hoort verklaard te zijn in plaats van raar. */
    const pad = path.join(map, 'navigatie', 'gebieden.json');
    fs.writeFileSync(pad, JSON.stringify({ bron: 'fixture', licentie: 'ODbL 1.0',
      naamsvermelding: 'OpenStreetMap-bijdragers', gebieden: GEBIEDEN.filter(g => g.code !== 'frankrijk') }));
    const t = Date.now() + 5000;
    fs.utimesSync(pad, t / 1000, t / 1000);
    fs.utimesSync(path.join(map, 'navigatie'), t / 1000, t / 1000);

    const b = laag.navKaartenBeeld('LID-1');
    assert.equal(b.gebieden.some(g => g.code === 'frankrijk'), false, 'hij staat niet meer in de catalogus');
    assert.deepEqual(b.mijn, ['frankrijk'], 'de keuze staat er nog');
    assert.deepEqual(b.gekozenNietAangeboden, ['frankrijk'], 'en het verschil is benoemd');
  }, { bouw: ['nederland'] });
});

/* ---------------------------------------------------------------------------
   DE ROUTES, OVER HTTP EN NIET LANGS DE KERN.

   Hierboven staat de laag; dit is de deur. Twee redenen waarom dit er apart
   staat en niet alleen in test/navigatiekaarten.e2e.js:

   1. die e2e MELDT ZICH AF op een machine zonder browser, en dan raakt geen
      enkele toets deze drie routes meer -- DEKKING.json eist dat elke route
      die de server registreert ooit is aangeraakt, en die eis kent geen norm
      om hem mee te verlagen;
   2. de deur is hier het onderwerp: de poort (geen gast), de sessiesleutel die
      uit de SESSIE komt en niet uit het lichaam, en dat de keuze van het ene
      lid niet bij het andere terechtkomt.
   --------------------------------------------------------------------------- */

const { startServer, stop } = require('./helper');

let srv, base;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kaartroutes-'));

const post = (pad, body, token) => fetch(base + pad, { method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' },
    token ? { Authorization: 'Bearer ' + token } : {}),
  body: JSON.stringify(body || {}) })
  .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

let seq = 0;
async function nieuwLid() {
  const u = (Date.now() + (++seq)).toString().slice(-8);
  const reg = await post('/api/auth/register', { name: 'Kaartlid ' + seq, email: 'kl' + u + '@x.nl',
    phone: '06' + u, password: 'geheim123', geboortedatum: '1990-05-05', geslacht: 'v',
    tier: 'rtg', pasApp: 'rtg' });
  return reg.body.token;
}

test.before(async () => {
  /* De index komt in de datamap van de SERVER: dezelfde plek waar
     kern/navigatie/pakket.js hem zoekt. */
  const nav = path.join(TMP, 'navigatie');
  fs.mkdirSync(nav, { recursive: true });
  fs.writeFileSync(path.join(nav, 'gebieden.json'), JSON.stringify({
    bron: 'fixture', licentie: 'ODbL 1.0', naamsvermelding: 'OpenStreetMap-bijdragers',
    gebieden: GEBIEDEN }));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('11. de drie routes zitten achter de ledeninlog, en een GAST komt er niet in', async () => {
  for (const pad of ['/api/nav/gebieden', '/api/nav/gebied/kies', '/api/nav/gebied/weg']) {
    const zonder = await post(pad, { code: 'nederland' });
    assert.ok(zonder.status === 401 || zonder.status === 403, pad + ' blijft dicht zonder sessie (' + zonder.status + ')');
  }
  /* EEN GAST IS INGELOGD EN GEEN LID. RTG Navigatie is voor leden -- dat doen
     de zes bestaande nav-routes ook, en een zevende die het niet doet is een
     stille uitzondering. Zonder deze toets kon `geenGast` uit alle drie
     verdwijnen zonder dat er iets zakte. */
  const gast = (await post('/api/login', { tier: 'guest' })).body.token;
  assert.ok(gast, 'een gastsessie');
  for (const pad of ['/api/nav/gebieden', '/api/nav/gebied/kies', '/api/nav/gebied/weg']) {
    const r = await post(pad, { code: 'nederland' }, gast);
    assert.equal(r.status, 403, pad + ' weigert een gast');
    assert.match(String(r.body.error), /voor leden/i);
  }
});

test('12. over HTTP: kiezen, terugzien en weghalen -- en de sleutel komt uit de SESSIE', async () => {
  const a = await nieuwLid();
  const b = await nieuwLid();
  assert.ok(a && b, 'twee leden');

  const leeg = await post('/api/nav/gebieden', {}, a);
  assert.equal(leeg.status, 200);
  assert.deepEqual(leeg.body.mijn, []);
  assert.ok(leeg.body.telling.aangeboden >= 3, 'de catalogus komt door de route');

  const kies = await post('/api/nav/gebied/kies', { code: 'frankrijk' }, a);
  assert.equal(kies.status, 200);
  assert.equal(kies.body.gekozen, true);
  /* EERST DE LENGTE EN DAARNA DE INHOUD, en die eerste regel is geen dubbelop:
     de lege lijsten in deze toets (hierboven, en bij lid B) bewijzen alleen iets
     als `mijn` AANTOONBAAR gevuld kan raken. Zonder deze regel is elke
     `deepEqual(..., [])` hier vanzelf waar voor een route die altijd niets
     teruggeeft -- de vorm die scripts/tandeloos.js meldt, en hij meldde precies
     deze. */
  const na = await post('/api/nav/gebieden', {}, a);
  assert.equal(na.body.mijn.length, 1, 'de lijst raakt werkelijk gevuld');
  assert.deepEqual(na.body.mijn, ['frankrijk']);

  /* HET ANDERE LID ZIET ZIJN EIGEN LIJST. Zou de laag de sleutel uit het
     LICHAAM lezen, dan kon een lid de lijst van een ander zetten of zien --
     daarom staat er in de route `req.session.key` en niets uit req.body. */
  assert.deepEqual((await post('/api/nav/gebieden', {}, b)).body.mijn, []);

  /* HIER STOND EEN TANDELOZE BEWERING: hij vroeg met een sleutel uit het
     lichaam die NERGENS iets achter had, en een leeg antwoord bewijst dan
     niets -- een route die de sleutel uit het lichaam leest, geeft daar ook
     een lege lijst. De mutatiemotor liet die versie overleven. Nu heeft B een
     EIGEN keuze: leest de route de sleutel uit het lichaam, dan verdwijnt die
     keuze uit zijn antwoord. */
  /* De sleutel gaat OOK mee bij het kiezen: alle drie de routes moeten hem uit
     de sessie halen, en een toets die er maar een van meet, laat de andere
     twee open. */
  await post('/api/nav/gebied/kies', { code: 'nederland', sleutel: 'anders', key: 'anders' }, b);
  const eigen = await post('/api/nav/gebieden', { sleutel: 'anders', key: 'anders', code: 'anders' }, b);
  assert.deepEqual(eigen.body.mijn, ['nederland'], 'een sleutel in het lichaam doet niets');
  await post('/api/nav/gebied/weg', { code: 'nederland', sleutel: 'anders' }, b);
  assert.deepEqual((await post('/api/nav/gebieden', {}, b)).body.mijn, [],
    'en weghalen raakt de EIGEN lijst, niet die van een sleutel uit het lichaam');

  const weg = await post('/api/nav/gebied/weg', { code: 'frankrijk' }, a);
  assert.equal(weg.status, 200);
  assert.deepEqual((await post('/api/nav/gebieden', {}, a)).body.mijn, []);
});

test('13. een gebied dat niet bestaat wordt geweigerd, en een onveilige code komt nergens', async () => {
  const a = await nieuwLid();
  const weg = await post('/api/nav/gebied/kies', { code: 'bestaatniet' }, a);
  assert.equal(weg.status, 404);
  /* Een code die een pad zou kunnen worden, hoort al bij de catalogus af te
     vallen -- en dus als "staat niet in de catalogus" terug te komen, niet als
     een fout uit de bestandslaag. */
  const traversal = await post('/api/nav/gebied/kies', { code: '../../../etc/passwd' }, a);
  assert.equal(traversal.status, 404, JSON.stringify(traversal.body));
  assert.deepEqual((await post('/api/nav/gebieden', {}, a)).body.mijn, []);
});

test('14. de keuze hangt aan het LID en niet aan de sessie: na opnieuw inloggen staat hij er nog', async () => {
  /* Dit is de belofte zelf ("uw keuze blijft staan") en hij hangt aan de vraag
     wat `req.session.key` IS. Zou dat een sleutel per aanmelding zijn, dan
     verloor een lid zijn kaarten bij elke nieuwe inlog en groeide de collectie
     met elke sessie mee. Dus gemeten en niet aangenomen. */
  const u = (Date.now() + (++seq)).toString().slice(-8);
  const email = 'kl' + u + '@x.nl';
  const reg = await post('/api/auth/register', { name: 'Kaartlid blijft', email,
    phone: '06' + u, password: 'geheim123', geboortedatum: '1990-05-05', geslacht: 'v',
    tier: 'rtg', pasApp: 'rtg' });
  const eerste = reg.body.token;
  assert.ok(eerste, 'ingeschreven');
  await post('/api/nav/gebied/kies', { code: 'frankrijk' }, eerste);
  assert.deepEqual((await post('/api/nav/gebieden', {}, eerste)).body.mijn, ['frankrijk']);

  const opnieuw = await post('/api/auth/login', { email, password: 'geheim123' });
  const tweede = opnieuw.body.token;
  assert.ok(tweede, 'opnieuw ingelogd: ' + JSON.stringify(opnieuw.body).slice(0, 120));
  assert.notEqual(tweede, eerste, 'een nieuw token, dus een nieuwe sessie');
  assert.deepEqual((await post('/api/nav/gebieden', {}, tweede)).body.mijn, ['frankrijk'],
    'de keuze hoort bij het lid en niet bij de sessie');
});
