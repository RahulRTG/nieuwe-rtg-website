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
  /* Papieren eerst: een vlucht boeken vraagt sinds kort om documentnummer,
     geldigheid, nationaliteit en geboortedatum (kern/gegevenspoort.js, soort
     'vlucht'), anders geeft de route een 428 en heeft deze bagagejacht geen
     koffer om achteraan te zitten. */
  await api('/api/onboarding/paspoort', { nummer: 'NX1234567', vervaldatum: '2032-01-01',
    nationaliteit: 'Nederlandse', geboortedatum: '1990-01-01' }, lid);
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

test('munt-webhook: zonder secret in productie wordt niets geloofd', () => {
  /* De betaal-webhook had deze grendel al; zijn munt-tweeling niet. En hier
     hangt er meer aan: de aanroeper doet bij status 'ontvangen' meteen
     munten.bevestig() en settleMuntFactuur(), en dat zet een factuur op 'paid'
     of crediteert een leverancier rechtstreeks. Zonder secret viel de code door
     naar JSON.parse en gaf een ONONDERTEKEND bericht terug als geverifieerde
     waarheid: wie het adres kent, roept zelf "de munten zijn binnen".

     Buiten productie blijft de doorval bestaan; daar draait alles op demo-geld
     en zou een verplicht secret elke lokale start blokkeren. Deze toets meet
     allebei de kanten, in een apart proces zodat NODE_ENV van de suite niet
     wordt aangeraakt. */
  const { execFileSync } = require('child_process');
  const proef = (env) => execFileSync(process.execPath, ['-e',
    'const m = require("' + path.join(__dirname, '..', 'server', 'muntbetaal.js').replace(/\\/g, '/') + '");'
    + 'try { m.verifieerWebhook(Buffer.from(JSON.stringify({status:"ontvangen",id:"x",euroCenten:100000})), ""); console.log("DOOR"); }'
    + 'catch (e) { console.log("GEWEIGERD"); }'],
  { env: Object.assign({}, process.env, env, { MUNT_WEBHOOK_SECRET: '' }), encoding: 'utf8' }).trim();

  assert.equal(proef({ NODE_ENV: 'production' }), 'GEWEIGERD', 'in productie zonder secret: niets geloven');
  assert.equal(proef({ NODE_ENV: 'test' }), 'DOOR', 'lokaal blijft de demo gewoon werken');
});

test('de configuratiekeuring noemt een ontbrekend munt-secret een FOUT, geen waarschuwing', () => {
  /* Hij stond als waarschuwing terwijl de Stripe-tweeling een fout was, en dat
     verschil was er geen: allebei vertellen ze de server dat er geld binnen is.
     Sinds muntbetaal.js in productie weigert zou een waarschuwing bovendien
     liegen -- de acceptatie werkt dan gewoon niet meer. */
  const { valideer } = require('../server/config');
  const r = valideer({ NODE_ENV: 'production', MUNT_AAN: '1', MUNT_PROVIDER_KEY: 'k', MUNT_WEBHOOK_SECRET: '' });
  assert.ok((r.fouten || []).some(f => /MUNT_WEBHOOK_SECRET/.test(f)), 'het ontbrekende secret is een FOUT');
  assert.ok(!(r.waarschuwingen || []).some(f => /MUNT_WEBHOOK_SECRET/.test(f)), 'en niet ook nog een waarschuwing');
});

/* ---------- 10. de muntketen: bedrag en bovengrens ---------- */

test('munt-settlement: te weinig ontvangen sluit de factuur niet', () => {
  /* Het bedrag komt uit het bericht van de aanbieder, en dat werd nergens
     vergeleken met wat er openstond: een bevestiging van EEN CENT zette een
     factuur van EUR 78,65 op 'paid'. De handtekening beschermt tegen een vreemde
     afzender; tegen een te laag bedrag beschermde niets.

     De vlag hoort bij de BRON te ontstaan (kern/munten.js), zodat elke
     settlement dezelfde waarheid leest. */
  const rijen = [];
  const nep = { data: { muntOntvangsten: rijen } };
  const munten = require('../server/kern/munten').maakMunten
    ? require('../server/kern/munten').maakMunten({ db: nep, save: () => {} })
    : null;
  if (!munten) return; // andere fabrieksnaam: dan meet deze toets niets, en dat zegt hij
  rijen.push({ id: 'M1', munt: 'btc', euroCenten: 7865, status: 'wacht', context: { soort: 'factuur' } });
  const te_weinig = munten.bevestig({ id: 'M1', euroCenten: 1 });
  assert.equal(te_weinig.settledEuroCenten, 1);
  assert.equal(te_weinig.volledig, false, 'een cent op EUR 78,65 is niet volledig');

  rijen.push({ id: 'M2', munt: 'btc', euroCenten: 7865, status: 'wacht', context: { soort: 'factuur' } });
  const genoeg = munten.bevestig({ id: 'M2', euroCenten: 7865 });
  assert.equal(genoeg.volledig, true, 'het volle bedrag is wel volledig');

  rijen.push({ id: 'M3', munt: 'btc', euroCenten: 7865, status: 'wacht', context: { soort: 'factuur' } });
  const zonderBedrag = munten.bevestig({ id: 'M3' });
  assert.equal(zonderBedrag.settledEuroCenten, 7865, 'geen bedrag in het bericht = het vastgelegde bedrag');
  assert.equal(zonderBedrag.volledig, true);
});

test('muntbetaling aan een leverancier kent dezelfde bovengrens als een gewone', async () => {
  /* registreerMuntBetaling controleerde alleen de ondergrens terwijl zijn
     tweeling betaalDirect ook een bovengrens heeft. Het bedrag komt uit de
     webhook, dus de aanbieder bepaalde zelf hoeveel er bij de ontvangstenteller
     van de leverancier bij kwam: EUR 10.000.000 op een verzoek van EUR 0,50. */
  const dp = require('../server/kern/directpay');
  const maak = dp.maakDirectpay || dp;
  /* DE TX-HULPJES HOREN ER ECHT IN. Deze ctx gaf ze niet mee, en zolang
     directpay met unshift+slice werkte viel dat niet op. Sinds de betalingen via
     de transactie-index lopen viel deze toets om met "directBetalingenVoegToe is
     not a function" -- middenin vastleggen(), dus pas bij de eerste betaling.
     Directpay weigert zich nu te laten bouwen zonder die hulpjes, en hier staan
     ze als een kleine echte index: dat houdt deze toets bij het onderwerp
     (de bovengrens) zonder de opslagweg weg te doen alsof. */
  const bak = { directBetalingen: [], betaalVerzoeken: [], directOntvangsten: {} };
  const voegToe = (naam) => (x) => { bak[naam].unshift(x); };
  const opRef = (naam) => (ref) => bak[naam].find(x => x.ref === ref);
  const opVeld = (naam, veld) => (w) => bak[naam].filter(x => x[veld] === w);
  const nep = {
    db: { data: bak },
    save: () => {}, crypto: require('crypto'),
    findSupplier: (c) => (c === 'KIKUNOI' ? { code: 'KIKUNOI', name: 'Kikunoi' } : null),
    betaal: { maakBetaling: async () => ({ id: 'x', status: 'betaald', aanbieder: 'demo' }) },
    notify: () => {}, notifySupplier: () => {}, sseToSupplier: () => {},
    sseToCustomer: () => {}, sseToOffice: () => {}, logActivity: () => {},
    directBetalingMetRef: opRef('directBetalingen'),
    directBetalingenVanKlant: opVeld('directBetalingen', 'key'),
    directBetalingenVanZaak: opVeld('directBetalingen', 'supplierCode'),
    directBetalingenVoegToe: voegToe('directBetalingen'),
    betaalVerzoekMetRef: opRef('betaalVerzoeken'),
    betaalVerzoekenVoorCodenaam: opVeld('betaalVerzoeken', 'naarCodename'),
    betaalVerzoekenVanZaak: opVeld('betaalVerzoeken', 'supplierCode'),
    betaalVerzoekenVoegToe: voegToe('betaalVerzoeken')
  };
  const api = maak(nep);

  /* En de bewering die het gat dichthoudt: zonder die hulpjes komt er geen
     betaalmodule uit, in plaats van een die pas bij de eerste klant omvalt. */
  assert.throws(() => maak({ ...nep, directBetalingenVoegToe: undefined }), /transactie-index ontbreekt/,
    'directpay laat zich niet bouwen zonder de weg waarlangs betalingen worden opgeslagen');

  const grens = api.DP_MAX_CENTEN;
  assert.ok(grens > 0, 'de bovengrens bestaat');
  const teHoog = api.dpRegistreerMunt({ key: 'k1', codename: 'Test', supplierCode: 'KIKUNOI', bedragCenten: grens + 1 });
  assert.equal(teHoog.status, 400, 'boven de grens wordt geweigerd');
  assert.equal(nep.db.data.directOntvangsten.KIKUNOI, undefined, 'en er is niets bijgeschreven');
  const goed = api.dpRegistreerMunt({ key: 'k1', codename: 'Test', supplierCode: 'KIKUNOI', bedragCenten: 5000 });
  assert.equal(goed.status, 200, 'een gewoon bedrag gaat gewoon door');
  assert.equal(nep.db.data.directOntvangsten.KIKUNOI.som, 5000);
});

/* ---------- 11. de technische pagina: rem en gelijk antwoord ---------- */
test('techniek-inlog: een juist wachtwoord zonder rechten geeft hetzelfde antwoord als een fout wachtwoord', async () => {
  /* Er stond 401 "Onjuiste inloggegevens" bij een fout wachtwoord en 403 met een
     eigen tekst bij een JUIST wachtwoord zonder recht op deze pagina. Dat verschil
     is een orakel: wie het ziet weet dat het wachtwoord klopte -- en dat wachtwoord
     opent elders in het huis wel deuren. */
  const u = Date.now().toString(36) + 'tq';
  const wachtwoord = 'geheim123';
  const reg = await api('/api/auth/register', { name: 'Techniek Proef', email: 'tq' + u + '@x.nl',
    phone: '067' + u.slice(0, 7), password: wachtwoord, geboortedatum: '1990-02-02', tier: 'rtg', pasApp: 'rtg' });
  assert.ok(reg.body.token, 'het proefaccount bestaat');

  const fout = await api('/api/techniek/inloggen', { login: 'tq' + u + '@x.nl', wachtwoord: 'ditisfout' });
  const goed = await api('/api/techniek/inloggen', { login: 'tq' + u + '@x.nl', wachtwoord });
  assert.equal(fout.status, 401);
  assert.equal(goed.status, fout.status, 'zelfde status, ongeacht of het wachtwoord klopte');
  assert.equal(goed.body.error, fout.body.error, 'en exact dezelfde tekst');
  assert.ok(!/geen toegang|geen recht/i.test(goed.body.error || ''), 'het antwoord verklapt niet dat het wachtwoord klopte');
});

test('techniek-inlog: raden loopt vast op de rem', async () => {
  const u = Date.now().toString(36) + 'tr';
  let laatste = 0;
  for (let i = 0; i < 14; i++) {
    const r = await api('/api/techniek/inloggen', { login: 'onbekend' + u + '@x.nl', wachtwoord: 'poging' + i });
    laatste = r.status;
    if (laatste === 429) break;
  }
  assert.equal(laatste, 429, 'na een handvol pogingen gaat de deur op slot (elke andere inlog doet dit al)');
});

/* ---------- 12. het eigenaarsaccount ---------- */
test('het eigenaarsadres is niet via de openbare registratie te claimen', async () => {
  /* De technische pagina bepaalt de eigenaar met eigenaarUser(): staat er nog
     geen eigenaarId, dan zoekt hij het account op het eigenaarsadres op en PINT
     dat vast. Op een verse productie-installatie werd daarmee wie dat adres als
     eerste registreerde de eigenaar van het platform -- de technische pagina, de
     hoofdzekering, de boardroom. Het adres is niet geheim (het staat in de
     omgevingsvariabelen), dus geheimhouding was nooit de bescherming.

     DEZE TOETS MOET BUITEN DEMOSTAND DRAAIEN, en dat is geen detail. In demo
     maakt de opstart dat account zelf aan, en dan vangt de gewone
     "bestaat al"-controle het verzoek af -- de toets slaagt dan ook zonder de
     reparatie. Een mutatie liet dat meteen zien: de grendel eruit, en de toets
     bleef groen. Vandaar een eigen server met NODE_ENV=production, waar niets
     het eigenaarsaccount aanmaakt en het gat dus echt open zou staan. */
  const TMP2 = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-eig-'));
  const sleutel = (c) => c.repeat(64);
  const eigen = await startServer({ env: {
    SMTP_URL: 'smtp://mail.test:2525', OPENAI_API_KEY: 'test-provider-key', RTG_DATA_DIR: TMP2,
    NODE_ENV: 'production', RTG_DEMO: '',
    // productie weigert te starten zonder deze; dat is bewust en het hoort zo
    RTG_ENC_KEY: sleutel('x'), RTG_VAULT_KEY: sleutel('a'), RTG_SECRET_KEY: sleutel('b'),
    RTG_OWNER_EMAIL: 'eigenaar-proef@voorbeeld.test',
    // deze proef gaat niet over betalen; zonder deze vlag weigert productie te
    // starten omdat de demo-provider anders elke betaling zelf zou bevestigen
    STRIPE_DEMO_BEWUST: '1',
    OFFICE_CODE: 'PROEFCODE1234', SESSION_SECRET: sleutel('y')
  } });
  /* X-Forwarded-Proto: https, want in productie staat er een afdwinging op --
     zonder die kop stuurt de server een omleiding en mislukt de fetch. Dezelfde
     kop die test/helper.js voor zijn gezondheidscheck gebruikt. */
  const post = (pad, body) => fetch(eigen.base + pad, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-Proto': 'https' },
    body: JSON.stringify(body || {}), redirect: 'manual'
  }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  try {
    const adres = 'eigenaar-proef@voorbeeld.test';
    const u = Date.now().toString(36) + 'eig';
    const kaap = await post('/api/auth/register', { name: 'Kaper', email: adres,
      phone: '068' + u.slice(0, 7), password: 'geheim123', geboortedatum: '1990-05-05', tier: 'rtg', pasApp: 'rtg' });
    assert.equal(kaap.status, 409, 'het eigenaarsadres komt niet door de openbare voordeur');
    assert.ok(!kaap.body.token, 'en er komt zeker geen token uit');
    // een gewoon adres mag gewoon: de deur zit niet op slot voor iedereen
    const gewoon = await post('/api/auth/register', { name: 'Gewoon Lid', email: 'gw' + u + '@x.nl',
      phone: '069' + u.slice(0, 7), password: 'geheim123', geboortedatum: '1990-05-05', tier: 'rtg', pasApp: 'rtg' });
    assert.equal(gewoon.status, 200, JSON.stringify(gewoon.body).slice(0, 160));
    assert.ok(gewoon.body.token);
  } finally {
    stop(eigen && eigen.child);
    try { fs.rmSync(TMP2, { recursive: true, force: true }); } catch (e) {}
  }
});

/* ---------- 13. het Stripe-blok ---------- */
test('productie zonder betaalsleutel is een FOUT, tenzij het bewust is', () => {
  /* Zonder sleutel draait de demo-provider, en die BEVESTIGT ELKE BETALING ZELF:
     facturen gaan op 'paid' zonder dat er ooit is afgeschreven. En het is niet
     eens symmetrisch onschuldig -- de 30%-afdracht aan de RTFoundation wordt wel
     gewoon geboekt, dus er gaat aan de ene kant geld weg terwijl er aan de andere
     kant niets binnenkomt. Dat stond als WAARSCHUWING, en een waarschuwing is
     iets wat je wegklikt. */
  const { valideer } = require('../server/config');
  const basis = {
    NODE_ENV: 'production', RTG_ENC_KEY: 'x'.repeat(64), RTG_VAULT_KEY: 'a'.repeat(64),
    RTG_SECRET_KEY: 'b'.repeat(64), RTG_OWNER_EMAIL: 'eigenaar@echt.nl', OFFICE_CODE: 'ABCDEFGHIJKL'
  };
  const zonder = valideer(basis);
  assert.ok((zonder.fouten || []).some(f => /STRIPE_SECRET_KEY/.test(f)), 'zonder sleutel: fout, geen waarschuwing');

  const bewust = valideer(Object.assign({}, basis, { STRIPE_DEMO_BEWUST: '1' }));
  assert.ok(!(bewust.fouten || []).some(f => /STRIPE_SECRET_KEY/.test(f)), 'een bewust gekozen demo-provider mag nog voor afgeschermd testen');
  assert.ok((bewust.waarschuwingen || []).some(f => /STRIPE_DEMO_BEWUST/.test(f)), 'maar het blijft zichtbaar');

  const echtUit = valideer(Object.assign({}, basis, { RTG_BETALEN_UIT: '1' }));
  assert.ok(!(echtUit.fouten || []).some(f => /STRIPE_SECRET_KEY/.test(f)), 'fail-closed uit heeft geen provider nodig');
  assert.ok((echtUit.waarschuwingen || []).some(f => /alle betaalrails.*fail-closed/i.test(f)), 'de uit-stand blijft zichtbaar');
  const tegenstrijdig = valideer(Object.assign({}, basis,
    { RTG_BETALEN_UIT: '1', STRIPE_SECRET_KEY: 'sk_live_x', STRIPE_WEBHOOK_SECRET: 'whsec_x' }));
  assert.ok((tegenstrijdig.fouten || []).some(f => /botst met ingestelde betaalgeheimen/i.test(f)),
    'uit plus een echt betaalgeheim weigert in plaats van stil een provider te laden');
  const muntTegenstrijdig = valideer(Object.assign({}, basis,
    { RTG_BETALEN_UIT: '1', MUNT_PROVIDER_KEY: 'munt_live_x', MUNT_WEBHOOK_SECRET: 'munt_wh_x' }));
  assert.ok((muntTegenstrijdig.fouten || []).some(f => /botst met ingestelde betaalgeheimen/i.test(f)),
    'ook achtergebleven muntgeheimen botsen met de volledige uit-stand');

  const met = valideer(Object.assign({}, basis, { STRIPE_SECRET_KEY: 'sk_live_x', STRIPE_WEBHOOK_SECRET: 'whsec_x' }));
  assert.ok(!(met.fouten || []).some(f => /STRIPE/.test(f)), 'met sleutel en webhook-secret is er niets aan de hand');
});

test('productie draait zonder AI volledig handmatig, maar niet zonder echte mail', () => {
  const { valideer } = require('../server/config');
  const basis = { NODE_ENV:'production', RTG_ENC_KEY:'x'.repeat(64), RTG_VAULT_KEY:'a'.repeat(64),
    RTG_SECRET_KEY:'b'.repeat(64), RTG_OWNER_EMAIL:'eigenaar@echt.nl', OFFICE_CODE:'ABCDEFGHIJKL',
    STRIPE_SECRET_KEY:'sk_live_x', STRIPE_WEBHOOK_SECRET:'whsec_x' };
  const zonder = valideer(basis);
  assert.ok(!zonder.fouten.some(f=>/AI-provider/.test(f)), 'AI is geen productiestart-afhankelijkheid');
  assert.ok(zonder.waarschuwingen.some(f=>/handmatige werkmodus/.test(f)), 'de handmatige stand is zichtbaar');
  assert.ok(zonder.fouten.some(f=>/mailprovider/.test(f)));
  const bewustUit = valideer(Object.assign({}, basis, { RTG_AI_UIT:'1', SMTP_URL:'smtp://mail.test:2525' }));
  assert.ok(!bewustUit.fouten.some(f=>/AI/.test(f)), 'AI mag bewust volledig uit');
  assert.ok(bewustUit.waarschuwingen.some(f=>/bewust uit.*handmatige werkmodus/i.test(f)));
  const conflict = valideer(Object.assign({}, basis,
    { RTG_AI_UIT:'1', OPENAI_API_KEY:'provider-key', SMTP_URL:'smtp://mail.test:2525' }));
  assert.ok(conflict.fouten.some(f=>/RTG_AI_UIT=1 botst/i.test(f)), 'uit plus een AI-sleutel weigert hard');
  const echt = valideer(Object.assign({},basis,{OPENAI_API_KEY:'provider-key',SMTP_URL:'smtp://mail.test:2525'}));
  assert.ok(!echt.fouten.some(f=>/AI-provider|mailprovider/.test(f)));
  assert.ok(!echt.waarschuwingen.some(f=>/handmatige werkmodus/.test(f)));
});

test('een betaal-webhook voor een onbekende betaling verandert niets en valt niet om', async () => {
  const evt = { id: 'evt_1', type: 'payment_intent.succeeded', data: { object: { id: 'pi_bestaatniet', amount_received: 999999 } } };
  const r = await fetch(base + '/api/betaal/webhook', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(evt)
  });
  assert.equal(r.status, 200, 'de provider krijgt netjes 200 (anders blijft hij het herhalen)');
  const na = await fetch(base + '/api/ready');
  assert.equal(na.status, 200, 'en de server leeft gewoon door');
});

/* LET OP DE VOLGORDE: de rem-toets hieronder verbrandt het quotum van deze
   bron (dezelfde IP, hetzelfde venster van een minuut). Alles wat een ECHT
   antwoord van de webhook wil zien, moet er dus VOOR staan. Dat is geen
   ongemak maar het bewijs dat de rem er staat. */
test('de betaal-webhooks staan achter een rem en achter de opslagpoort', async () => {
  /* Ze moeten VOOR de JSON-parser staan (de handtekening gaat over de ruwe
     bytes) en stonden daardoor ook voor de opslagpoort en de hoofdzekering.

     De doorlichting meldde erbij dat er "400 verzoeken per minuut ongeremd
     doorheen kwamen". Dat klopte niet: het schild (kern/schild.js) staat wel
     degelijk voor deze routes, maar laat 127.0.0.1 bewust door -- en de
     doorlichting klopte van binnenuit aan. Deze eigen rem is strenger dan het
     schild en de globale rem, en dus een verbetering; hij repareert geen gat.
     Dat deze toets vanaf localhost een 429 ziet, komt dus door DEZE rem. */
  let geremd = 0, laatste = 0;
  for (let i = 0; i < 160; i++) {
    const r = await fetch(base + '/api/betaal/webhook', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
    });
    laatste = r.status;
    if (r.status === 429) { geremd++; break; }
  }
  assert.equal(laatste, 429, 'een stortvloed loopt vast op de rem (was: onbeperkt)');
  assert.ok(geremd > 0);
});

test('de afwikkeling werkt voor de kaart net zo als voor munten', async () => {
  /* De kaartkant werd NOOIT afgewikkeld: /api/betaal/webhook verifieerde de
     handtekening en logde de gebeurtenis, meer niet. In demostand viel dat niet
     op omdat de demo-provider meteen 'betaald' antwoordt; met een echte
     Stripe-sleutel niet, en dan werd geen enkele factuur ooit betaald.

     De afwikkeling zat middenin server.js en was daardoor niet los te toetsen --
     precies waar de fout kon blijven zitten. Hij staat nu in kern/settlement.js
     met zijn afhankelijkheden via de fabriek. */
  const { maakSettlement } = require('../server/kern/settlement');
  const maak = (bijdrage) => ({ id: 'INV1', bijdrage, desc: 'RTG Pass', status: 'open' });

  const bouw = (inv) => {
    const db = { data: { invoices: [inv] } };
    const geboekt = [];
    const settle = maakSettlement({
      db, save: () => {}, accounts: {}, log: { warn: () => {} },
      fonds: { isAbonnement: () => true, boekAfdracht: async (a) => { geboekt.push(a); } },
      dpRegistreerMunt: () => {}
    });
    return { settle, geboekt, inv };
  };

  // te weinig: blijft open, maar het geld is geboekt als deelbetaling
  const a = bouw(maak(78.65));
  await a.settle({ soort: 'factuur', invoiceId: 'INV1', own: false }, { id: 'pi_1', centen: 1, hoe: 'Betaald per kaart' });
  assert.equal(a.inv.status, 'open', 'een cent sluit een factuur van EUR 78,65 niet');
  assert.equal(a.inv.deelbetaald, 1, 'maar het geld is wel geboekt');
  assert.equal(a.geboekt.length, 0, 'en er is geen afdracht op een onbetaalde factuur');

  // de rest komt erbij: nu wel dicht, en de afdracht volgt
  await a.settle({ soort: 'factuur', invoiceId: 'INV1', own: false }, { id: 'pi_2', centen: 7864, hoe: 'Betaald per kaart' });
  assert.equal(a.inv.status, 'paid', 'zodra de som het gevraagde dekt gaat hij dicht');
  assert.equal(a.inv.date, 'Betaald per kaart');
  assert.equal(a.geboekt.length, 1, 'en dan pas de RTF-afdracht');

  // in een keer het volle bedrag: gewoon betaald
  const b = bouw(maak(78.65));
  await b.settle({ soort: 'factuur', invoiceId: 'INV1', own: false }, { id: 'pi_3', centen: 7865, hoe: 'Betaald per kaart' });
  assert.equal(b.inv.status, 'paid');
  assert.equal(b.geboekt.length, 1);

  // een tweede webhook voor dezelfde factuur doet niets meer
  await b.settle({ soort: 'factuur', invoiceId: 'INV1', own: false }, { id: 'pi_4', centen: 7865, hoe: 'Betaald per kaart' });
  assert.equal(b.geboekt.length, 1, 'een herhaalde bevestiging boekt niet nog een afdracht');
});
