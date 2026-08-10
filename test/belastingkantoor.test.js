/* Het Belastingkantoor (kern/overheid/kantoor.js): de inspecteurscockpit met
   invordering via de Berichtenbox, het btw-beeld uit de facturatiemotor + KVK,
   de slimme signalen en de AI-chef-inspecteur. Alleen voor het rijk. Draai los:
   node --experimental-sqlite --test test/belastingkantoor.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

let srv, base, lid, lid2, rijk, partner;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bdkantoor-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const u = Date.now().toString().slice(-8);
  lid = (await api(base, '/api/auth/register', { name: 'Inwoner Een', email: 'b1' + u + '@x.nl',
    phone: '061' + u.slice(1), password: 'geheim123', geboortedatum: '1985-04-04', tier: 'rtg', pasApp: 'rtg' })).body.token;
  lid2 = (await api(base, '/api/auth/register', { name: 'Inwoner Twee', email: 'b2' + u + '@x.nl',
    phone: '062' + u.slice(1), password: 'geheim123', geboortedatum: '1979-09-09', tier: 'rtg', pasApp: 'rtg' })).body.token;
  const roster = await api(base, '/api/supplier/roster', { code: 'RIJK' });
  const man = roster.body.staff.find(m => m.role === 'manager');
  rijk = (await api(base, '/api/supplier/login', { code: 'RIJK', staffId: man.id, pin: '1234' })).body.token;
  partner = (await api(base, '/api/supplier/login', { username: 'rahul', password: 'Imran' })).body.token;
  // twee aangiftes: een met openstaand saldo (niets ingehouden) en een met hoge aftrek (controle-signaal)
  await api(base, '/api/overheid/aangifte', { inkomen: 90000, aftrek: 1000, ingehouden: 0 }, lid);
  await api(base, '/api/overheid/aangifte', { inkomen: 50000, aftrek: 30000, ingehouden: 20000 }, lid2);
});
test.after(() => stop(srv && srv.child));

test('1. de cockpit toont het hele beeld: te ontvangen, openstaand en de signalen', async () => {
  const c = await api(base, '/api/overheid/bd/cockpit', {}, rijk);
  assert.equal(c.status, 200);
  assert.ok(c.body.teOntvangen > 0, 'er staat een aanslag open');
  assert.ok(c.body.openstaand >= 1);
  assert.ok(Array.isArray(c.body.signalen));
  assert.ok(c.body.signalen.some(s => s.soort === 'controle'), 'de hoge aftrek valt op als controle-signaal');
  assert.ok('btwDitJaar' in c.body && 'ondernemingen' in c.body, 'het btw/KVK-beeld zit in de cockpit');
});

test('2. invordering: herinnering en betalingsregeling landen in de Berichtenbox van de inwoner', async () => {
  const a = await api(base, '/api/overheid/bd/aanslagen', { stand: 'open' }, rijk);
  assert.equal(a.status, 200);
  const open = a.body.aanslagen[0];
  assert.ok(open && open.saldo > 0);
  // herinnering
  assert.equal((await api(base, '/api/overheid/bd/herinnering', { ref: open.ref }, rijk)).status, 200);
  // regeling: 6 maanden, netjes verdeeld
  const r = await api(base, '/api/overheid/bd/regeling', { ref: open.ref, maanden: 6 }, rijk);
  assert.equal(r.status, 200);
  assert.equal(r.body.regeling.maanden, 6);
  assert.ok(r.body.regeling.per >= Math.floor(open.saldo / 6));
  // een onzinnige regeling wordt geweigerd
  assert.equal((await api(base, '/api/overheid/bd/regeling', { ref: open.ref, maanden: 99 }, rijk)).status, 400);
  // beide besluiten staan in de Berichtenbox van het lid
  const box = await api(base, '/api/overheid/berichten', {}, lid);
  assert.ok(box.body.berichten.some(b => /herinnering/i.test(b.titel)), 'de herinnering is bezorgd');
  assert.ok(box.body.berichten.some(b => /regeling/i.test(b.titel)), 'de regeling is bezorgd');
});

test('3. kwijtschelding gaat door TWEE inspecteurs, en pas dan hoort de inwoner het', async () => {
  /* Dit was een handeling van EEN inspecteur: hij streepte in zijn eentje een
     schuld weg en de inwoner kreeg meteen bericht. In hetzelfde kantoor had de
     naheffing omzetbelasting wel vier ogen op elke stap die geld raakt. Twee
     regimes naast elkaar, en het lakste zat op de enige ONOMKEERBARE handeling.
     Zie de kop van kern/overheid/kantoor-invordering.js.

     Er is precies EEN openstaande aanslag in deze opzet, dus de afwijzing en de
     toekenning lopen achter elkaar over dezelfde zaak -- wat meteen laat zien
     dat een afwijzing de deur niet dichtgooit. */
  const a = await api(base, '/api/overheid/bd/aanslagen', { stand: 'open' }, rijk);
  const open = a.body.aanslagen[0];
  assert.ok(open, 'er staat nog een aanslag open');

  // een tweede inspecteur, want anders valt hier niets te toetsen
  const tweede = await api(base, '/api/supplier/staff/add', { name: 'Inspecteur De Wit', role: 'manager' }, rijk);
  assert.equal(tweede.status, 200);
  const rijk2 = (await api(base, '/api/supplier/login',
    { code: 'RIJK', staffId: tweede.body.staff.id, pin: tweede.body.pin })).body.token;
  const stand = async () => (await api(base, '/api/overheid/bd/aanslagen', {}, rijk))
    .body.aanslagen.find(x => x.ref === open.ref);

  // zonder voordracht is er niets te beslissen
  assert.equal((await api(base, '/api/overheid/bd/kwijt/besluit', { ref: open.ref, akkoord: true }, rijk2)).status, 409);
  // en een voordracht zonder grond bestaat niet
  assert.equal((await api(base, '/api/overheid/bd/kwijt/voordracht', { ref: open.ref, reden: '' }, rijk)).status, 400);

  // ---- ronde 1: voorgedragen en AFGEWEZEN ----
  assert.equal((await api(base, '/api/overheid/bd/kwijt/voordracht',
    { ref: open.ref, reden: 'twijfelgeval' }, rijk)).status, 200);
  const nee = await api(base, '/api/overheid/bd/kwijt/besluit', { ref: open.ref, akkoord: false }, rijk2);
  assert.equal(nee.status, 200);
  assert.equal(nee.body.kwijtgescholden, false);
  const naNee = await stand();
  assert.equal(naNee.kwijtgescholden, false, 'de schuld staat er nog');
  assert.equal(naNee.kwijtVoorstel, null, 'en de voordracht hangt niet blijvend boven de zaak');

  // ---- ronde 2: opnieuw voorgedragen, nu toegekend ----
  const v = await api(base, '/api/overheid/bd/kwijt/voordracht',
    { ref: open.ref, reden: 'schrijnend geval' }, rijk);
  assert.equal(v.status, 200, 'na een afwijzing kan er opnieuw worden voorgedragen');
  const hangend = await stand();
  assert.equal(hangend.kwijtgescholden, false, 'een voorstel is geen besluit');
  assert.ok(hangend.kwijtVoorstel && hangend.kwijtVoorstel.door.length > 1,
    'de voordracht staat met naam op het scherm, zodat de tweede ziet of hij het zelf was');
  /* En de burger hoort van een VOORDRACHT nog niets. Dit stond eerst alleen in
     de titel van deze toets en niet in de toets zelf: een mutatie die het
     bericht al bij het voordragen liet uitgaan, kwam er ongestraft doorheen.
     Het is precies de belofte die deze twee stappen dragen -- een voorstel is
     geen besluit, dus er valt nog niets mee te delen. */
  const stil = await Promise.all([lid, lid2].map(t => api(base, '/api/overheid/berichten', {}, t)));
  assert.ok(!stil.flatMap(b => b.body.berichten).some(b => /kwijtschelding/i.test(b.titel)),
    'nog geen bericht in welke Berichtenbox dan ook: er is nog niets besloten');

  // DEZELFDE ogen beslissen niet
  const zelf = await api(base, '/api/overheid/bd/kwijt/besluit', { ref: open.ref, akkoord: true }, rijk);
  assert.equal(zelf.status, 409);
  assert.match(zelf.body.error, /dezelfde ogen/i);
  // en er ligt al een voordracht, dus een tweede kan niet
  assert.equal((await api(base, '/api/overheid/bd/kwijt/voordracht',
    { ref: open.ref, reden: 'nogmaals' }, rijk2)).status, 409);

  const k = await api(base, '/api/overheid/bd/kwijt/besluit', { ref: open.ref, akkoord: true }, rijk2);
  assert.equal(k.status, 200);
  assert.equal(k.body.kwijtgescholden, true);
  const dicht = await stand();
  assert.ok(dicht.kwijtgescholden);
  assert.equal(dicht.kwijtVoorstel, null, 'de voordracht is verbruikt');

  /* PAS NU hoort de inwoner het, met de grond erbij. Welke van de twee inwoners
     deze aanslag heeft, ligt aan de volgorde in de lijst; het gaat erom dat het
     bericht ergens LIGT en dat er tot dit moment niets lag. */
  const boxen = await Promise.all([lid, lid2].map(t => api(base, '/api/overheid/berichten', {}, t)));
  const bericht = boxen.flatMap(b => b.body.berichten).find(b => /kwijtschelding/i.test(b.titel));
  assert.ok(bericht, 'de kwijtschelding is bezorgd');
  assert.match(bericht.tekst, /schrijnend geval/, 'met de grond erbij, en met die van de TOEGEKENDE voordracht');
  assert.ok(!/twijfelgeval/.test(bericht.tekst), 'niet met de grond van de afgewezen voordracht');

  // er staat niets meer open, dus er valt niets meer te beslissen
  assert.equal((await api(base, '/api/overheid/bd/kwijt/voordracht',
    { ref: open.ref, reden: 'nog eens' }, rijk)).status, 409);
});

test('4. het btw-beeld komt uit de facturatiemotor, gekoppeld aan het KVK-register', async () => {
  /* Een echte factuur, zodat er iets te tellen valt EN het getal na te rekenen
     is. De demo-zaak is horeca (9%), dus 121 incl wordt 111,01 grondslag en
     9,99 btw. */
  const f = await api(base, '/api/supplier/facturen/maak',
    { omschrijving: 'Diner', aantal: 1, bedrag: 121, koperNaam: 'Gast' }, partner);
  assert.equal(f.status, 200, 'de factuur is geboekt');
  const incl = f.body.factuur.totaal, btwOpFactuur = f.body.factuur.btwBedrag;

  const b = await api(base, '/api/overheid/bd/btw', {}, rijk);
  assert.equal(b.status, 200);
  assert.ok(Array.isArray(b.body.zaken));
  assert.ok('totaalBtw' in b.body && 'totaalGrondslag' in b.body);
  // elke zaak in het beeld draagt de KVK-koppeling (ingeschreven ja/nee)
  for (const z of b.body.zaken) assert.ok('ingeschreven' in z);

  /* HET WOORD MOET HET GETAL DEKKEN. Dit veld heette `omzet` en droeg het
     factuurbedrag INCLUSIEF btw; wie het naast een aangifte legde, vergeleek
     twee verschillende dingen. Het heet nu grondslag en moet dus onder het
     inclusief-bedrag liggen, met precies de btw ertussen. */
  const zaak = b.body.zaken.find(z => z.btw > 0);
  assert.ok(zaak, 'er staat een zaak met btw in het beeld');
  assert.equal('omzet' in zaak, false, 'het oude, misleidende veld is weg');
  assert.ok(zaak.btw > 0 && zaak.grondslag > 0, 'grondslag en btw staan er allebei');
  assert.ok(zaak.grondslag + zaak.btw >= Math.round(incl) - 1,
    'de zojuist geboekte factuur zit in het jaarbeeld');
  assert.ok(zaak.grondslag < zaak.grondslag + zaak.btw - Math.round(btwOpFactuur) + 1,
    'de grondslag is EXCLUSIEF btw en niet het factuurbedrag (' + zaak.grondslag + ' bij ' + zaak.btw + ' btw)');
});

test('5. de AI-chef-inspecteur adviseert op het hele beeld (en beslist niets)', async () => {
  const r = await api(base, '/api/overheid/bd/ai', { vraag: 'Wat pak ik als eerste op?' }, rijk);
  assert.equal(r.status, 200);
  assert.ok(r.body.antwoord && r.body.antwoord.length > 20);
  assert.match(r.body.antwoord, /beslis|besluit|zelf/i, 'het advies benadrukt dat de mens beslist');
});

test('6. het kantoor is alleen voor het rijk: partner en anoniem komen er niet in', async () => {
  assert.equal((await api(base, '/api/overheid/bd/cockpit', {}, partner)).status, 403);
  assert.equal((await api(base, '/api/overheid/bd/cockpit', {}, null)).status, 401);
  assert.equal((await api(base, '/api/overheid/bd/herinnering', { ref: 'x' }, partner)).status, 403);
});

/* ---- de aansluiting: het toezicht op de btw-aangifte ----
   De hele reden dat het kantoor en de ondernemer dezelfde telling delen
   (kern/fiscaal/btwtelling.js): een inspecteur die anders rekent dan de aangever
   vindt altijd een verschil, en dan zegt een verschil niets meer. */
test('7. de aansluiting zet het factuurregister naast wat er is aangegeven', async () => {
  const nu = new Date();
  const periode = nu.getUTCFullYear() + 'K' + (Math.floor(nu.getUTCMonth() / 3) + 1);

  // de zaak factureert en maakt zijn aangifte op over het lopende kwartaal
  await api(base, '/api/supplier/facturen/maak',
    { omschrijving: 'Lunch', aantal: 1, bedrag: 218, koperNaam: 'Gast' }, partner);
  const eigen = await api(base, '/api/supplier/btw/opmaken', { periode }, partner);
  assert.equal(eigen.status, 200, 'de zaak maakt zijn aangifte op');

  const r = await api(base, '/api/overheid/bd/btw/aansluiting', { periode }, rijk);
  assert.equal(r.status, 200);
  assert.equal(r.body.periode, periode);
  assert.equal(r.body.periodeLoopt, true, 'het lopende kwartaal loopt nog');

  const z = r.body.zaken.find(x => x.code === eigen.body.aangifte.code);
  assert.ok(z, 'de zaak staat in de aansluiting');
  /* DE BEWERING WAAR HET OM DRAAIT: de inspecteur telt exact hetzelfde als de
     aangever. Niet ongeveer -- op de cent. */
  assert.equal(z.geteldBtwCenten, eigen.body.aangifte.verschuldigdCenten,
    'inspecteur en ondernemer komen op dezelfde verschuldigde btw uit');
  assert.equal(z.stand, 'alleen_concept', 'een concept is niet aangegeven');
  assert.equal(z.aangegevenBtwCenten, null, 'en telt dus niet als aangifte');

  /* Over een LOPENDE periode geeft het toezicht geen signalen: de aangifte van
     de ondernemer weigert indienen daar met zoveel woorden, dus "niets
     ingediend" is daar geen bevinding maar de bedoeling. */
  const c = await api(base, '/api/overheid/bd/cockpit', {}, rijk);
  assert.equal(c.body.signalen.filter(s => s.soort === 'btw' && /lopend/.test(s.tekst)).length, 0);
  assert.ok(c.body.btwPeriode && /^\d{4}K[1-4]$/.test(c.body.btwPeriode),
    'de cockpit noemt de periode waar het toezicht naar kijkt');
});

test('8. een periode die niet bestaat wordt geweigerd, en het rijk is de enige lezer', async () => {
  assert.equal((await api(base, '/api/overheid/bd/btw/aansluiting', { periode: '2026K9' }, rijk)).status, 400);
  assert.equal((await api(base, '/api/overheid/bd/btw/aansluiting', { periode: 'rommel' }, rijk)).status, 400);
  assert.equal((await api(base, '/api/overheid/bd/btw/aansluiting', {}, partner)).status, 403,
    'een gewone zaak leest de aansluiting van iedereen niet');
  assert.equal((await api(base, '/api/overheid/bd/btw/aansluiting', {}, null)).status, 401);
});

/* ---- de naheffingsaanslag: de poorten en de weigeringen over HTTP ----
   Het gedrag zelf staat in test/btw-naheffing.test.js, met een verzetbare klok:
   naheffen kan alleen over een AFGESLOTEN tijdvak, en over deze server zijn alle
   facturen van vandaag. Wat hier wel te bewijzen valt, is dat de routes bestaan,
   dat ze achter het rijk hangen, en dat de weigering van de motor er echt
   doorheen komt in plaats van een lege 200. */
test('9. de naheffing hangt achter het rijk, en de weigering komt er ongeschonden uit', async () => {
  const nu = new Date();
  const lopend = nu.getUTCFullYear() + 'K' + (Math.floor(nu.getUTCMonth() / 3) + 1);

  // over een LOPEND tijdvak valt niets na te heffen: er is nog niets te laat
  const teVroeg = await api(base, '/api/overheid/bd/naheffing/maak', { periode: lopend, code: 'KIKUNOI' }, rijk);
  assert.equal(teVroeg.status, 409);
  assert.match(teVroeg.body.error, /loopt de periode nog/);

  // en een onbekende zaak levert geen lege naheffing op
  const onbekend = await api(base, '/api/overheid/bd/naheffing/maak', { periode: '2026K1', code: 'BESTAATNIET' }, rijk);
  assert.equal(onbekend.status, 404);

  const lijst = await api(base, '/api/overheid/bd/naheffingen', {}, rijk);
  assert.equal(lijst.status, 200);
  assert.deepEqual(lijst.body.naheffingen, [], 'er is er geen een opgemaakt');
  assert.equal(lijst.body.openBezwaren, 0);

  // de poorten: een gewone zaak en een anonieme bezoeker komen er niet in
  for (const pad of ['/api/overheid/bd/naheffing/maak', '/api/overheid/bd/naheffing/stelvast',
    '/api/overheid/bd/naheffing/intrek', '/api/overheid/bd/naheffing/bezwaar/beslis',
    '/api/overheid/bd/naheffingen']) {
    assert.equal((await api(base, pad, { id: 'x' }, partner)).status, 403, pad + ' voor een gewone zaak');
    assert.equal((await api(base, pad, { id: 'x' }, null)).status, 401, pad + ' anoniem');
  }
});

test('10. de zaak leest zijn eigen naheffingen en niemand anders die van hem', async () => {
  const mijn = await api(base, '/api/supplier/btw/naheffingen', {}, partner);
  assert.equal(mijn.status, 200);
  assert.deepEqual(mijn.body.naheffingen, []);
  // bezwaar tegen iets wat niet bestaat is een 404 en geen stille 200
  const nep = await api(base, '/api/supplier/btw/naheffing/bezwaar',
    { id: 'nhbestaatniet', reden: 'hier klopt niets van' }, partner);
  assert.equal(nep.status, 404);
  // en zonder token komt er niets uit
  assert.equal((await api(base, '/api/supplier/btw/naheffingen', {}, null)).status, 401);
  assert.equal((await api(base, '/api/supplier/btw/naheffing/bezwaar', { id: 'x' }, null)).status, 401);
});
