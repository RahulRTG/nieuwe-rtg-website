/* De vindlaag van de RTG Mall: het universele aanbod-object, het locatiemodel
   met servicegebied, en de zoek-/ontdeklaag daarboven. De Mall is hiermee niet
   langer een winkel met spullen maar de commerciele voorkant van heel RTG.

   Elke toets hieronder is met een mutatie nagetrokken (LAT-regel 2); wat er per
   toets is omgezet en welke toets daarvan zakte staat in het commit-bericht.
   Draai los: node --experimental-sqlite --test test/mall-vindlaag.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const { VERDIEPINGEN, TYPEN, verdiepingVan } = require('../server/kern/mall/aanbodvorm');
const { slugVan, BEREIK_IDS, GENRE_BEREIK } = require('../server/kern/mall/plek');
const { advertentieOpenbaar } = require('../server/kern/markt/openbaar');
const { reisAanbod } = require('../server/kern/reisbureau');

function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

let srv, base, lid;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-mallvind-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const reg = await api(base, '/api/auth/register', { name: 'Mall Bezoeker', email: 'vind@x.nl', phone: '0612345678',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  lid = reg.body.token;
  assert.ok(lid, 'lid-registratie geeft een token');
});
test.after(() => stop(srv && srv.child));

/* ---------------------------------------------------------------------------
   1. Het aanbod-object zelf: vorm, dekking en de belofte dat elke knop ergens
      op uitkomt.
   --------------------------------------------------------------------------- */

test('1. de zoeklaag levert aanbod uit meer dan een domein, in een gedeelde vorm', async () => {
  const r = await api(base, '/api/mall/zoek', { per: 60 }, lid);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.stuk, [], 'geen enkele bron valt om');
  assert.deepEqual(r.body.geweigerd, [], 'geen bron levert een half aanbod-object');
  assert.ok(r.body.totaal >= 10, 'er staat werkelijk aanbod in de Mall, geen lege lijst');

  const bronnen = new Set(r.body.items.map(a => a.bron));
  assert.ok(bronnen.size >= 4, 'de Mall toont meer dan een domein tegelijk, gevonden: ' + [...bronnen].join(', '));
  // dit is de kern van de hele verbouwing: reizen staan in de Mall
  assert.ok(bronnen.has('reisbureau'), 'de samengestelde reizen staan in de Mall');

  for (const a of r.body.items) {
    assert.ok(TYPEN[a.type], a.titel + ' heeft een bekend type (' + a.type + ')');
    assert.ok(a.titel && a.id && a.cta, a.id + ' heeft titel, id en een knoptekst');
    assert.ok(['zaak', 'particulier', 'rtg'].includes(a.aanbieder.soort), a.titel + ' zegt wie de aanbieder is');
    assert.ok(VERDIEPINGEN.some(v => v.id === a.verdieping), a.titel + ' staat op een bestaande verdieping');
    assert.ok(a.pagina && a.pagina.startsWith('/apps/'), a.titel + ' wijst naar een pagina in de app');
  }
});

test('2. elke knop in de Mall komt uit op een pagina die echt bestaat', async () => {
  const r = await api(base, '/api/mall/zoek', { per: 60 }, lid);
  const paginas = [...new Set(r.body.items.map(a => a.pagina.split('?')[0]))];
  assert.ok(paginas.length >= 3, 'meer dan een bestemming, anders bewijst deze toets niets');
  for (const p of paginas) {
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'public', p)), p + ' bestaat als echte pagina');
  }
  // en niets belandt meer op de generieke app-pagina: dat was de doodlopende val
  assert.ok(!paginas.includes('/apps/app.html'), 'geen enkel aanbod valt terug op het generieke bureaublad');
});

test('3. de prijs van een reis in de Mall is dezelfde als bij het reisbureau', async () => {
  const bureau = await api(base, '/api/reisbureau', {}, lid);
  const mall = await api(base, '/api/mall/zoek', { type: 'reis', per: 60 }, lid);
  assert.ok(bureau.body.reizen.length >= 1, 'er staan reizen klaar');
  assert.equal(mall.body.totaal, bureau.body.reizen.length, 'evenveel reizen in de Mall als bij het bureau');
  for (const r of bureau.body.reizen) {
    const inMall = mall.body.items.find(a => a.id === 'reis:' + r.id);
    assert.ok(inMall, r.titel + ' staat in de Mall');
    assert.equal(inMall.prijs.bedrag, r.prijs, r.titel + ': dezelfde prijs, uit dezelfde projectie');
    assert.equal(inMall.cta, 'Reis aanvragen', 'nooit "Kopen": een mens bevestigt de reis');
  }
});

/* ---------------------------------------------------------------------------
   2. Zoeken: relevantie, intentie en de belofte dat beschikbaarheid alleen
      sorteert en niet toelaat.
   --------------------------------------------------------------------------- */

test('4. een zoekwoord vindt wat het betekent, en niet wat er toevallig op lijkt', async () => {
  const r = await api(base, '/api/mall/zoek', { q: 'ring' }, lid);
  assert.equal(r.status, 200);
  assert.ok(r.body.totaal >= 1, 'de ring wordt gevonden');
  for (const a of r.body.items) {
    const hooi = (a.titel + ' ' + (a.uitleg || '') + ' ' + a.aanbieder.naam + ' ' + a.kenmerken.join(' ')).toLowerCase();
    assert.ok(/(^|[^a-z0-9])ring/.test(hooi), a.titel + ' bevat "ring" als woord, niet als toeval');
  }
});

test('5. beschikbaarheid sorteert wel, maar laat niets toe dat niet gevraagd is', async () => {
  // "scooter" bestaat niet in de demo-Mall; wat er wel staat is op voorraad.
  // Toen beschikbaarheid meetelde in de relevantie gaf dit negen treffers.
  const r = await api(base, '/api/mall/zoek', { q: 'scooter' }, lid);
  assert.equal(r.status, 200);
  assert.equal(r.body.totaal, 0, 'geen scooter, dus geen treffers -- ook geen ringen en honing');
  assert.ok(r.body.totaalVoorFilter > 0, 'en de Mall was wel degelijk gevuld');
});

test('6. de zoekzin wordt gelezen: intentie en plek komen eruit', async () => {
  const r = await api(base, '/api/mall/zoek', { q: 'restaurant ibiza' }, lid);
  assert.equal(r.status, 200);
  assert.ok(r.body.plek, 'Ibiza is als plek herkend en niet als zoekwoord');
  assert.equal(r.body.plek.slug, 'ibiza');
  assert.ok(r.body.gelezen.typen.includes('eten'), '"restaurant" is een intentie: eten');
  assert.ok(r.body.totaal >= 1, 'en er komt aanbod uit');
  for (const a of r.body.items) assert.ok(a.plek.stad === null || /ibiza/i.test(a.plek.stad) || a.bereik.soort !== 'adres',
    a.titel + ' hoort bij Ibiza of bedient het vanuit zijn werkgebied');
});

test('7. rangschikken gebeurt niet op partnerstatus', async () => {
  /* De belofte uit de kop van kern/mall/zoek.js, hier vastgehouden: de score
     mag geen term hebben die naar de aanbieder kijkt. Een tekstscan is grof,
     maar precies grof genoeg -- hij zakt zodra iemand `partner` of `status` in
     de weging betrekt. */
  const bron = fs.readFileSync(path.join(__dirname, '..', 'server', 'kern', 'mall', 'zoekweging.js'), 'utf8');
  const weging = bron.slice(bron.indexOf('function relevantie'), bron.indexOf('const boost'));
  assert.ok(weging.length > 100, 'de weging is gevonden, anders meet deze toets niets');
  assert.ok(!/partner|status|betaal|premium/i.test(weging), 'geen enkele partner- of betaalterm in de weging');
});

/* ---------------------------------------------------------------------------
   3. Locatie en servicegebied.
   --------------------------------------------------------------------------- */

test('8. de plekken komen uit het aanbod dat er werkelijk is', async () => {
  const r = await api(base, '/api/mall/plekken', {}, lid);
  assert.equal(r.status, 200);
  assert.ok(r.body.plekken.length >= 2, 'meer dan een plek');
  assert.equal(r.body.landbron, true, 'de landbepaling van de Reiswijzer is echt aangesloten');
  for (const p of r.body.plekken) {
    assert.ok(p.aantal > 0, p.stad + ' bestaat alleen omdat er iets staat');
    assert.equal(p.slug, slugVan(p.stad), p.stad + ' heeft een sluitende slug');
  }
  const ibiza = r.body.plekken.find(p => p.slug === 'ibiza');
  assert.ok(ibiza, 'Ibiza staat in de lijst');
  assert.equal(ibiza.land, 'ES', 'en de Mall weet in welk land dat ligt');
});

// alle pagina's van een zoekopdracht; de zoeklaag geeft er hoogstens 60 per keer
async function alles(body) {
  const uit = [];
  for (let p = 1; p <= 20; p++) {
    const r = await api(base, '/api/mall/zoek', { ...body, per: 60, pagina: p }, lid);
    assert.equal(r.status, 200);
    uit.push(...r.body.items);
    if (p >= r.body.paginas) return { items: uit, totaal: r.body.totaal };
  }
  throw new Error('meer dan 20 paginas; deze toets leest niet alles en zou dus niets bewijzen');
}

test('9. een plek filtert het aanbod, en wat elders hoort valt weg', async () => {
  const overal = await alles({});
  const ibiza = await alles({ plek: 'ibiza' });
  assert.equal(overal.items.length, overal.totaal, 'alle pagina\'s zijn gelezen');
  assert.equal(ibiza.items.length, ibiza.totaal, 'ook van Ibiza');
  assert.ok(ibiza.totaal > 0, 'Ibiza heeft aanbod');
  assert.ok(ibiza.totaal < overal.totaal, 'en dat is minder dan de hele Mall -- het filter doet iets');

  // wat overblijft hoort hier: eigen plek, of een bereik dat hier komt
  for (const a of ibiza.items) {
    const hier = a.plek.slug === 'ibiza';
    const komtHier = ['europa', 'online', 'land', 'straal', 'stad'].includes(a.bereik.soort);
    assert.ok(hier || komtHier, a.titel + ' staat in Mall Ibiza met een reden (' + a.plek.slug + '/' + a.bereik.soort + ')');
  }
  // en een reis naar elders hoort er juist NIET in te staan
  const elders = overal.items.find(a => a.type === 'reis' && a.plek.slug && a.plek.slug !== 'ibiza');
  assert.ok(elders, 'er is een reis naar een andere bestemming, anders bewijst het volgende niets');
  assert.ok(!ibiza.items.some(a => a.id === elders.id), elders.titel + ' hoort niet in Mall Ibiza');
});

test('10. het servicegebied is instelbaar en bepaalt wie er in de buurt staat', async () => {
  // elk genre heeft een verdedigbare aanname, en die staat als aanname gemarkeerd
  for (const soort of Object.values(GENRE_BEREIK)) {
    assert.ok(BEREIK_IDS.includes(soort), soort + ' is een bestaand bereik');
  }
  assert.equal(GENRE_BEREIK.hotel, 'adres', 'naar een hotel ga je toe');
  assert.equal(GENRE_BEREIK.bouw, 'straal', 'een bouwer komt naar jou toe');
  assert.equal(GENRE_BEREIK.jet, 'europa', 'een jet haalt je overal op');
});

/* ---------------------------------------------------------------------------
   4. De verdiepingen en de reparatie van de doodlopende genres.
   --------------------------------------------------------------------------- */

test('11. elk genre met aanbod landt op een verdieping en heeft een echte bestemming', async () => {
  const r = await api(base, '/api/mall/zoek', { per: 60 }, lid);
  const genres = [...new Set(r.body.items.map(a => a.genre).filter(Boolean))];
  assert.ok(genres.length >= 3, 'er zijn genres om over te oordelen');
  for (const g of genres) {
    const v = verdiepingVan(g, 'product');
    assert.ok(VERDIEPINGEN.some(x => x.id === v), g + ' landt op een bestaande verdieping');
  }
});

test('12. de vervoergenres zijn niet langer doodlopend', async () => {
  /* Dit was het gat: jet, helikopter, taxi, charter, verhuur en tweewielers
     stonden wel in de leveranciersgids maar wezen naar /apps/app.html met
     boekbaar=false, terwijl hangar.html en ov.html gewoon bestonden. */
  const gids = await api(base, '/api/mall', {}, lid);
  assert.equal(gids.status, 200);
  const dood = (gids.body.gids || []).filter(g =>
    ['jet', 'helikopter', 'taxi', 'charter', 'verhuur', 'tweewielers'].includes(g.type) && !g.boekbaar);
  assert.deepEqual(dood.map(g => g.type), [], 'geen enkel vervoergenre is nog doodlopend');

  const vervoer = (gids.body.gids || []).filter(g => ['jet', 'taxi'].includes(g.type));
  assert.ok(vervoer.length >= 1, 'er staan vervoerpartners in de gids, anders bewijst het bovenstaande niets');
  for (const g of vervoer) {
    assert.notEqual(g.pagina, '/apps/app.html', g.type + ' wijst niet meer naar het generieke bureaublad');
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'public', g.pagina)), g.pagina + ' bestaat');
  }
});

/* ---------------------------------------------------------------------------
   5. Wie de aanbieder is, en de regels die daaraan vastzitten.
   --------------------------------------------------------------------------- */

test('13. een gemelde marktplaats-advertentie is ook via de Mall onzichtbaar', () => {
  /* De Mall leest de advertenties zelf; zonder gedeelde regel zou een
     advertentie die in de Marktplaats verborgen is via de Mall alsnog
     zichtbaar zijn. Deze functie is de gedeelde waarheid. */
  assert.equal(advertentieOpenbaar({ titel: 'fiets', melders: [] }), true, 'een gewone advertentie mag');
  assert.equal(advertentieOpenbaar({ titel: 'fiets', melders: ['a', 'b', 'c'] }), false, 'drie meldingen: verborgen');
  assert.equal(advertentieOpenbaar({ titel: 'fiets', verwijderd: true, melders: [] }), false, 'verwijderd is weg');
  assert.equal(advertentieOpenbaar(null), false, 'geen advertentie is geen advertentie');
});

test('14. de reisprojectie heeft een bron en die is gedeeld', () => {
  // reisAanbod is de enige plek waar een trip-rij een prijs en een titel krijgt
  const db = { data: { partnerTrips: [{ id: 't1', title: 'Test', dest: 'Ibiza', netto: 1234, includes: ['a'] }] } };
  const uit = reisAanbod(db);
  assert.equal(uit.length, 1);
  assert.equal(uit[0].prijs, 1234, 'de nettoprijs komt ongewijzigd door');
  assert.equal(uit[0].bestemming, 'Ibiza');
  assert.deepEqual(reisAanbod({ data: {} }), [], 'zonder reizen een lege lijst, geen fout');
});

test('15. de home toont per verdieping wat er op deze plek staat', async () => {
  const r = await api(base, '/api/mall/home', { plek: 'ibiza' }, lid);
  assert.equal(r.status, 200);
  assert.ok(r.body.plek && r.body.plek.slug === 'ibiza');
  assert.ok(r.body.verdiepingen.length >= 2, 'meer dan een verdieping heeft aanbod op Ibiza');
  const som = r.body.verdiepingen.reduce((n, v) => n + v.aantal, 0);
  assert.equal(som, r.body.totaal, 'de verdiepingen tellen op tot het totaal -- niets valt buiten de boot');
  for (const v of r.body.verdiepingen) assert.ok(v.aantal > 0, v.label + ' staat er alleen omdat er iets in staat');
});

test('17. een half aanbod-object wordt geweigerd EN gemeld, niet stil weggelaten', () => {
  /* Gevonden doordat de mutatie "haal de melding weg" werd AFGESLAGEN: de
     toetsen keken wel of `geweigerd` leeg was, maar niets dwong een weigering
     af, dus de melding zelf was nergens op afgerekend (LAT-regel 2 en 5). Deze
     toets bouwt de Mall op een zaak met een artikel zonder naam. */
  const { maakMall } = require('../server/kern/mall');
  const db = { data: {
    suppliers: [{ code: 'STUK', name: 'Zaak met een gat', type: 'retail', city: 'Testdorp',
      loc: { lat: 52.38, lng: 4.63, label: 'Testdorp' },
      artikelen: [
        { id: 'goed', naam: 'Sjaal', publiekePrijs: 40, varianten: [] },
        { id: 'fout', naam: '', publiekePrijs: 10, varianten: [] }
      ] }],
    supplierTypes: { retail: { label: 'Retail', caps: ['retail'] } },
    partnerTrips: [], markt: { ads: [] }
  } };
  require('../server/kern/werkvormen').haakAan(db);
  const mall = maakMall({ db, save() {}, crypto: require('crypto'),
    isRetail: (s) => s.type === 'retail', haalThuis: () => null, haalLandVind: () => null }).mall;

  const d = mall.aanbodAlles();
  const titels = d.aanbod.map(a => a.titel);
  assert.ok(titels.includes('Sjaal'), 'het goede artikel komt er gewoon in');
  assert.ok(!titels.includes(''), 'het artikel zonder naam komt er niet in');
  assert.ok(d.geweigerd.length >= 1, 'en de weigering wordt GEMELD in plaats van verzwegen');
  assert.equal(d.geweigerd[0].bron, 'retail', 'met de bron erbij');
  assert.equal(d.geweigerd[0].reden, 'titel', 'en waarom hij is geweigerd');
});

test('16. de Mall belooft geen keurmerk dat RTG niet geeft', async () => {
  const r = await api(base, '/api/mall/home', { plek: 'ibiza' }, lid);
  assert.match(r.body.opmerking, /niet garant/i, 'de home zegt zelf dat RTG niet garant staat voor een ander');
  const zoek = await api(base, '/api/mall/zoek', { per: 60 }, lid);
  const statussen = new Set(zoek.body.items.map(a => a.aanbieder.status).filter(Boolean));
  for (const s of statussen) {
    assert.ok(['RTG Partner', 'RTG Verified', 'RTG Business', 'Marktplaats-lid'].includes(s),
      s + ' is een bekende, feitelijke stand en geen kwaliteitsoordeel');
  }
});
