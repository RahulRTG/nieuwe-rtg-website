/* De bugjacht: de defecten die uit de gerichte doorlichting kwamen, elk met
   een toets die ZAKT als de reparatie eruit gaat.

   Ze staan hier bij elkaar en niet verspreid over de bestaande bestanden, omdat
   ze een gemeenschappelijke vorm hebben en die vorm het onthouden waard is:

   1. Een grendel aan de verkeerde kant van een await (idem, kassacode).
   2. indexOf(...) van een status die niet in de keten staat: -1, en dan laten
      alle "draait niet achteruit"-vergelijkingen los.
   3. Een grens die bij twijfel doorlaat in plaats van dichtgaat.
   4. Een van de broers mist de controle die zijn broers wel hebben.
   5. Heen en terug zijn niet elkaars omgekeerde (voorraad, bedden).

   Draai los: node --experimental-sqlite --test test/bugjacht.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bugjacht-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
async function zaakLogin(code) {
  const roster = await api('/api/supplier/roster', { code });
  const chef = (roster.body.staff || []).find(m => m.role === 'manager');
  assert.ok(chef, 'manager gevonden bij ' + code);
  const login = await api('/api/supplier/login', { code, staffId: chef.id, pin: '1234' });
  assert.ok(login.body.token, code + ' is aangemeld');
  return login.body.token;
}

let lid, jong;
test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, DEMO_SUPPLIER: 'MERCABIZA' } });
  base = srv.base;
  const u = Date.now().toString().slice(-8);
  lid = (await api('/api/auth/register', { name: 'Bug Jager', email: 'bj' + u + '@x.nl',
    phone: '064' + u.slice(1), password: 'geheim123', geboortedatum: '1985-03-03', tier: 'rtg', pasApp: 'rtg' })).body.token;
  assert.ok(lid, 'het testlid is aangemeld');
  /* Een ECHT account zonder geboortedatum. Aanmelden via het formulier vraagt
     er altijd om, maar createUserSync in de opstart doet dat niet: het
     demo-eigenaarsaccount heeft geen `geboren` in zijn ledenstaat. Dat is
     precies de sessie waarop de leeftijdsgrens fail-open stond -- en uitgerekend
     het account met de meeste rechten. */
  jong = (await api('/api/auth/login', { login: process.env.RTG_OWNER_EMAIL || 'roellie.i@gmail.com',
    password: process.env.DEMO_PASS || 'Imran', pasApp: 'business' })).body.token;
  assert.ok(jong, 'het account zonder geboortedatum is ingelogd');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

/* ---------- 1. de idempotentie-grendel over de await heen ---------- */
test('idem: twee gelijktijdige verzoeken met dezelfde sleutel doen het werk EEN keer', async () => {
  const db = { payIdem: { _keys: [] }, payIdemAfdruk: {} };
  const metIdem = require('../server/lib/idem')({ d: () => db, save: () => {}, naam: 'payIdem' });
  let werkGedaan = 0;
  const werk = async () => {
    werkGedaan++;
    await new Promise(r => setTimeout(r, 20)); // echte I/O: Postgres, de motor, Stripe
    return { ok: true, nummer: werkGedaan };
  };
  const [a, b] = await Promise.all([metIdem('k1', 'afdruk', werk), metIdem('k1', 'afdruk', werk)]);
  assert.equal(werkGedaan, 1, 'het werk is precies EEN keer gedaan');
  assert.equal(a.nummer, 1);
  assert.equal(b.nummer, 1, 'de tweede kreeg het antwoord van de eerste');
  assert.ok(a.herhaald || b.herhaald, 'een van de twee is als herhaling gemerkt');
});

test('idem: een gelijktijdige sleutel met een ANDERE afdruk is een 409, geen stil ander antwoord', async () => {
  const db = { payIdem: { _keys: [] }, payIdemAfdruk: {} };
  const metIdem = require('../server/lib/idem')({ d: () => db, save: () => {}, naam: 'payIdem' });
  const traag = async () => { await new Promise(r => setTimeout(r, 20)); return { ok: true, bedrag: 10 }; };
  const [eerste, tweede] = await Promise.all([
    metIdem('k2', 'bedrag|10', traag),
    new Promise(r => setTimeout(() => r(metIdem('k2', 'bedrag|9999', traag)), 5))
  ]);
  assert.equal(eerste.ok, true);
  assert.equal(tweede.status, 409, 'dezelfde sleutel voor een ander verzoek wordt geweigerd');
});

test('idem: mislukt werk laat de sleutel vrij, en de wachter hangt niet', async () => {
  const db = { payIdem: { _keys: [] }, payIdemAfdruk: {} };
  const metIdem = require('../server/lib/idem')({ d: () => db, save: () => {}, naam: 'payIdem' });
  const stuk = async () => { await new Promise(r => setTimeout(r, 10)); throw new Error('provider down'); };
  const [een, twee] = await Promise.allSettled([metIdem('k3', '', stuk), metIdem('k3', '', stuk)]);
  assert.equal(een.status, 'rejected');
  assert.ok(twee.status === 'rejected' || (twee.value && twee.value.status === 500), 'de wachter krijgt een antwoord, geen eeuwige belofte');
  // en daarna mag het gewoon opnieuw
  const derde = await metIdem('k3', '', async () => ({ ok: true, weer: true }));
  assert.equal(derde.weer, true, 'na een mislukking is de sleutel weer bruikbaar');
});

/* ---------- 2. indexOf van een status buiten de keten ---------- */
test('bagage: een vermiste koffer glipt niet terug naar het begin van de keten', async () => {
  const ops = await zaakLogin('LUCHT');
  // eerst een echte koffer in de kelder: boeken en inchecken op de open vlucht
  const bord = (await api('/api/member/vluchten/bord', {}, lid)).body;
  const open = (bord.vluchten || []).find(v => v.nummer === 'RT205');
  assert.ok(open, 'RT205 staat open voor inchecken');
  const boek = await api('/api/member/vluchten/boek', { id: open.id }, lid);
  assert.equal(boek.status, 200);
  const inc = await api('/api/member/vluchten/incheck', { code: boek.body.boeking.code, koffers: 1 }, lid);
  assert.equal(inc.status, 200, 'ingecheckt met een koffer');
  const lijst = (await api('/api/lucht/bagage', {}, ops)).body;
  const koffer = (lijst.koffers || []).find(k => k.status === 'ingecheckt');
  assert.ok(koffer, 'er ligt een koffer op het bord');
  const vermist = await api('/api/lucht/bagage/zet', { tag: koffer.tag, status: 'vermist' }, ops);
  assert.equal(vermist.status, 200, 'als vermist melden mag');
  const terug = await api('/api/lucht/bagage/zet', { tag: koffer.tag, status: 'ingecheckt' }, ops);
  assert.equal(terug.status, 409, 'vermist -> ingecheckt is geen geldige stap (indexOf gaf -1 en liet alles door)');
  const gevonden = await api('/api/lucht/bagage/zet', { tag: koffer.tag, status: 'op-band' }, ops);
  assert.equal(gevonden.status, 200, 'de ENE bedoelde terugweg blijft open: gevonden, op de band');
  assert.equal(gevonden.body.gevonden, true);
});

/* ---------- 3. een grens die bij twijfel dichtgaat ---------- */
test('privejet: een lid zonder geboortedatum wordt geweigerd, niet doorgelaten', async () => {
  const r = await api('/api/ride/request', { supplierCode: 'JETAG', toCode: 'HOSHI', passengers: 1 }, jong);
  assert.equal(r.status, 403, 'onbekende leeftijd telt als te jong (fail-closed)');
  assert.match(r.body.error || '', /18 jaar/);
  const ok = await api('/api/ride/request', { supplierCode: 'JETAG', toCode: 'HOSHI', passengers: 1 }, lid);
  assert.notEqual(ok.status, 403, 'een lid met een bekende leeftijd van 18+ mag gewoon');
});

/* ---------- 4. de broer die een controle mist ---------- */
test('meldkamer: een afgeronde melding kan niet terug naar ter-plaatse', async () => {
  const korps = await zaakLogin('URGENCIA');
  const eh = await api('/api/supplier/hulp/eenheid/maak', { naam: 'Ambu Test', soort: 'land' }, korps);
  assert.equal(eh.status, 200);
  const m = await api('/api/supplier/hulp/melding/maak', { tekst: 'Testmelding', plek: 'Kade', prio: 1 }, korps);
  assert.equal(m.status, 200);
  await api('/api/supplier/hulp/melding/wijs', { melding: m.body.melding.id, eenheid: eh.body.eenheid.id }, korps);
  const af = await api('/api/supplier/hulp/melding/status', { melding: m.body.melding.id, status: 'afgerond' }, korps);
  assert.equal(af.status, 200);
  const terug = await api('/api/supplier/hulp/melding/status', { melding: m.body.melding.id, status: 'ter-plaatse' }, korps);
  assert.equal(terug.status, 409, 'de eindtoestand-grendel die meldingWijs wel had, geldt nu ook hier');
  // en de eenheid is en blijft vrij
  const bord = (await api('/api/supplier/hulp/overzicht', {}, korps)).body;
  const mijn = (bord.eenheden || []).find(e => e.id === eh.body.eenheid.id);
  assert.equal(mijn && mijn.status, 'vrij', 'de vrijgekomen eenheid blijft vrij');
});

test('meldkamer: afronden maakt alleen de eenheden van DEZE melding vrij', async () => {
  const korps = await zaakLogin('GUARDIA');
  const a = (await api('/api/supplier/hulp/eenheid/maak', { naam: 'Wagen A', soort: 'land' }, korps)).body.eenheid;
  const b = (await api('/api/supplier/hulp/eenheid/maak', { naam: 'Wagen B', soort: 'land' }, korps)).body.eenheid;
  const m1 = (await api('/api/supplier/hulp/melding/maak', { tekst: 'Melding een', prio: 1 }, korps)).body.melding;
  const m2 = (await api('/api/supplier/hulp/melding/maak', { tekst: 'Melding twee', prio: 1 }, korps)).body.melding;
  await api('/api/supplier/hulp/melding/wijs', { melding: m1.id, eenheid: a.id }, korps);
  await api('/api/supplier/hulp/melding/wijs', { melding: m2.id, eenheid: b.id }, korps);
  await api('/api/supplier/hulp/melding/status', { melding: m1.id, status: 'afgerond' }, korps);
  const bord = (await api('/api/supplier/hulp/overzicht', {}, korps)).body;
  const na = id => (bord.eenheden || []).find(e => e.id === id);
  assert.equal(na(a.id).status, 'vrij', 'de eenheid van de afgeronde melding komt vrij');
  assert.equal(na(b.id).status, 'onderweg', 'de eenheid op de ANDERE, lopende melding blijft bezet');
});

test('meldkamer: een ingezette eenheid is niet handmatig op vrij te zetten', async () => {
  const korps = await zaakLogin('BOMBERS');
  const e = (await api('/api/supplier/hulp/eenheid/maak', { naam: 'Blusvoertuig', soort: 'land' }, korps)).body.eenheid;
  const m = (await api('/api/supplier/hulp/melding/maak', { tekst: 'Brand', prio: 1 }, korps)).body.melding;
  await api('/api/supplier/hulp/melding/wijs', { melding: m.id, eenheid: e.id }, korps);
  const zet = await api('/api/supplier/hulp/eenheid/zet', { id: e.id, status: 'vrij' }, korps);
  assert.equal(zet.status, 409, '"de rest volgt de melding" wordt nu ook afgedwongen');
});

/* ---------- 5. heen en terug zijn elkaars omgekeerde ---------- */
test('groothandel: bestellen boven de voorraad kan niet, en annuleren tovert niets bij', async () => {
  // de demo-groothandel logt in met rahul/Imran (DEMO_SUPPLIER=MERCABIZA)
  const gh = (await api('/api/supplier/login', { username: 'rahul', password: 'Imran' })).body.token;
  assert.ok(gh, 'de groothandel is aangemeld');
  const horeca = await zaakLogin('KIKUNOI');
  const lijst = (await api('/api/supplier/groothandel/overzicht', {}, gh)).body;
  const prod = (lijst.producten || []).find(p => typeof p.voorraad === 'number' && p.voorraad > 0);
  assert.ok(prod, 'er is een product met voorraad');
  const teveel = await api('/api/supplier/inkoop/bestel', {
    groothandelCode: 'MERCABIZA', regels: [{ productId: prod.id, aantal: prod.voorraad + 50 }]
  }, horeca);
  assert.equal(teveel.status, 409, 'meer bestellen dan er ligt wordt geweigerd');
  const na = (await api('/api/supplier/groothandel/overzicht', {}, gh)).body;
  const nu = (na.producten || []).find(p => p.id === prod.id);
  assert.equal(nu.voorraad, prod.voorraad, 'de voorraad is niet stiekem naar nul gezakt');
  // en de gewone rondgang klopt: bestellen haalt eraf, annuleren zet exact dat terug
  const best = await api('/api/supplier/inkoop/bestel', {
    groothandelCode: 'MERCABIZA', regels: [{ productId: prod.id, aantal: 2 }]
  }, horeca);
  assert.equal(best.status, 200);
  const tussen = ((await api('/api/supplier/groothandel/overzicht', {}, gh)).body.producten || []).find(p => p.id === prod.id);
  assert.equal(tussen.voorraad, prod.voorraad - 2, 'twee eraf');
  await api('/api/supplier/inkoop/annuleer', { ref: best.body.order.ref }, horeca);
  const terug = ((await api('/api/supplier/groothandel/overzicht', {}, gh)).body.producten || []).find(p => p.id === prod.id);
  assert.equal(terug.voorraad, prod.voorraad, 'en na annuleren staat de teller weer precies gelijk');
});

/* ---------- 6. wat publiek was en het niet hoefde te zijn ---------- */
test('roster: geeft alleen wat de inlogkiezer toont, niet het hele personeelsdossier', async () => {
  const r = await api('/api/supplier/roster', { code: 'KIKUNOI' });
  assert.equal(r.status, 200, 'het inlogscherm blijft werken (er is nog niets om op te authenticeren)');
  const m = r.body.staff[0];
  assert.ok(m.id && m.name, 'de kiezer heeft id en naam nodig');
  assert.equal('lid' in m, false, 'of iemand ook RTG-lid is, hoort niet in een publiek antwoord');
});

test('rides.csv: het sessietoken hoort niet meer in een URL te kunnen', async () => {
  const zaak = await zaakLogin('MKKX');
  const via_url = await fetch(base + '/api/supplier/rides.csv?token=' + encodeURIComponent(zaak));
  assert.notEqual(via_url.status, 200, 'de oude GET met het token in de querystring bestaat niet meer');
  const via_header = await fetch(base + '/api/supplier/rides.csv', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + zaak }, body: '{}'
  });
  assert.equal(via_header.status, 200, 'met het token in de header werkt de export gewoon');
  assert.match(via_header.headers.get('content-type') || '', /csv/);
});

/* ---------- 7. uitloggen dat met een enkel teken te omzeilen was ---------- */
test('uitloggen: het ingetrokken token werkt ook niet met een spatie ervoor', async () => {
  const u = Date.now().toString(36) + 'x';
  const reg = await api('/api/auth/register', { name: 'Uitlog Proef', email: 'ul' + u + '@x.nl',
    phone: '066' + u.slice(0, 7), password: 'geheim123', geboortedatum: '1991-04-04', tier: 'rtg', pasApp: 'rtg' });
  const t = reg.body.token;
  assert.ok(t, 'aangemeld');
  assert.equal((await api('/api/state', {}, t)).status, 200, 'voor het uitloggen werkt het token');
  assert.equal((await api('/api/logout', {}, t)).status, 200);
  assert.equal((await api('/api/state', {}, t)).status, 401, 'na het uitloggen niet meer');
  /* En dit was het gat. De intreklijst bewaart een hash van de RAUWE tekenreeks,
     maar Buffer.from(x, 'base64url') negeert elk teken dat niet in het alfabet
     zit. Hetzelfde token met een spatie erin decodeerde dus identiek, de
     handtekening klopte, en de intreklijst herkende hem niet meer: uitloggen was
     met een enkel teken te omzeilen. Op een geleende computer is dat precies het
     moment waarop iemand denkt veilig te zijn. */
  for (const [hoe, variant] of [['spatie ervoor', ' ' + t], ['spatie erin', t.replace('.', ' .')],
    ['gelijkteken ervoor', '=' + t], ['punt erachter', t + '.']]) {
    assert.equal((await api('/api/state', {}, variant)).status, 401, hoe + ' mag het token niet terugbrengen');
  }
});

/* ---------- 8. een index die stilzwijgend 0 werd ---------- */
test('notities: afvinken zonder index vinkt niet stiekem het eerste punt af', async () => {
  const gemaakt = await api('/api/notities/bewaar', { soort: 'lijst', titel: 'Boodschappen', items: [{ t: 'Brood' }, { t: 'Melk' }] }, lid);
  assert.equal(gemaakt.status, 200);
  const id = gemaakt.body.id;
  for (const raar of [null, '', [], false]) {
    const r = await api('/api/notities/vink', { id, index: raar, af: true }, lid);
    assert.equal(r.status, 400, 'index ' + JSON.stringify(raar) + ' is geen punt en wordt geweigerd');
  }
  const mijn = (await api('/api/notities/mijn', {}, lid)).body;
  const n = (mijn.eigen || []).find(x => x.id === id);
  assert.equal(!!(n.items[0] || {}).af, false, 'het eerste punt staat nog gewoon open');
  const goed = await api('/api/notities/vink', { id, index: 1, af: true }, lid);
  assert.equal(goed.status, 200, 'een echte index werkt gewoon');
});

/* ---------- 9. wat de tweede doorlichting opleverde ---------- */

test('vergetelheid: ledenGidsWeg is echt bedraad, en een gat valt luid', () => {
  /* De gids is de laatste plek waar de sleutel aan de codenaam vastzit. In
     Postgres-modus liep het verwijderen via ledenGidsWeg -- maar die stond niet
     in de exportlijst van db/index.js, dus server.js kreeg undefined, en in
     kern/gids.js sloeg `if (ledenGidsWeg)` daar stilzwijgend op over. Inclusief
     de return erachter, zodat OOK het lokale pad werd overgeslagen: het recht op
     vergetelheid (AVG art. 17) haalde het lid nergens uit de gids terwijl het
     commentaar erboven belooft dat beide opslagvormen gedekt zijn.

     Een ontbrekende regel in een exportlijst, en niets dat erover klaagde. Deze
     toets kijkt naar de bedrading zelf, want dat is wat er brak. */
  const opslag = require('../server/db');
  assert.equal(typeof opslag.ledenGidsWeg, 'function', 'db exporteert ledenGidsWeg');

  // en zonder bedrading hoort het LUID te falen, niet stil over te slaan
  const gids = require('../server/kern/gids')({
    db: { data: { memberDir: {} } }, save: () => {}, liveCodename: () => 'x',
    ledenGidsActief: () => true, ledenGidsHaal: () => null, ledenGidsZet: () => {},
    ledenGidsWeg: undefined, ledenGidsExact: async () => null,
    ledenGidsZoek: async () => [], ledenGidsAantal: () => 0
  });
  assert.throws(() => gids.gidsWeg('user-1'), /niet bedraad/,
    'een niet-bedrade verwijdering klaagt in plaats van stil niets te doen');
});

test('het scan-net dekt ook de RTFoundation-tak', async () => {
  /* "Zo zijn ALLE upload-plekken in een klap gedekt", stond erbij. Express
     draait middleware in registratievolgorde, en de foundation-router werd
     eerder gemount dan de scanner -- die tak kwam er dus nooit langs, inclusief
     de fotokant van het leerlingenschrift. De scanner hangt nu voor de routers. */
  const EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';
  const besmet = 'data:image/png;base64,' + Buffer.from(EICAR).toString('base64');
  const r = await api('/api/foundation/gezin/inloggen', { code: 'XXXX', bijlage: besmet });
  assert.equal(r.status, 422, 'de besmette data-URL wordt geweigerd voordat de router hem ziet');
  // en een schone body loopt gewoon door naar de route (die hem afwijst op de code)
  const schoon = await api('/api/foundation/gezin/inloggen', { code: 'XXXX', bijlage: 'gewone tekst' });
  assert.notEqual(schoon.status, 422, 'een schone body wordt niet tegengehouden');
});

test('voorcheck: elke collectie met centen erin wordt exact nagekeken', () => {
  /* De overslaan-regel kijkt naar de LENGTE van een collectie. Een nieuwe order
     verandert die en wordt opgepikt; `L.som += cent` op een leverancier die er
     al in staat verandert hem NIET. Een wijziging-op-zijn-plaats is de enige
     vorm die hier echt verloren kan gaan, en geld is nou juist wat op zijn
     plaats verandert. directOntvangsten en wallet vielen door zowel de vaste
     lijst als het naam-vangnet. */
  const { exactNodig } = require('../server/db/voorcheck');
  for (const k of ['directOntvangsten', 'wallet', 'paySaldi', 'payIdem', 'directBetalingen',
    'muntOntvangsten', 'bankBoekingen', 'assetTickets'])
    assert.equal(exactNodig(k), true, k + ' hoort altijd exact nagekeken te worden');
  // en niet breder dan geld: De Salon heeft geen cent en mag de goedkope weg
  for (const k of ['posts', 'notifications', 'reviews', 'live'])
    assert.equal(exactNodig(k), false, k + ' hoeft niet elke save volledig geserialiseerd');
});

test('een terugbetaalde rit en boeking zijn niet opnieuw te betalen', async () => {
  /* Dezelfde vorm als bij de bestelling: `paid` was de enige poort, en juist de
     annulering zet die weer op false (paid=false, refunded=true,
     status 'geweigerd'). Alle drie de betaalwegen stonden erop; alleen die van
     de bestelling was gedicht. */
  const rit = await api('/api/ride/request', { supplierCode: 'MKKX', toCode: 'KIKUNOI', passengers: 1 }, lid);
  assert.equal(rit.status, 200, JSON.stringify(rit.body).slice(0, 200));
  const ref = rit.body.ride.ref;
  assert.equal((await api('/api/ride/pay', { ref }, lid)).status, 200, 'eerst gewoon betalen');
  const annu = await api('/api/annuleer', { soort: 'ride', ref }, lid);
  assert.equal(annu.status, 200, 'en dan annuleren met terugbetaling');
  const nogmaals = await api('/api/ride/pay', { ref }, lid);
  assert.equal(nogmaals.status, 409, 'een terugbetaalde rit kan niet opnieuw betaald worden');
  assert.match(nogmaals.body.error || '', /geannuleerd/);
});
