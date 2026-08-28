/* DE REISUITNODIGING (kern/reisuitnodiging.js): een klaargezette reis en een link.

   DRIE SCHAKELS: het kantoor zet een reis klaar voor iemand die nog geen lid is,
   die persoon wordt lid en neemt hem over, en hij nodigt daarna zijn reisgenoot
   uit. Wat hier bewezen moet worden is niet dat een link werkt, maar dat de vier
   dingen die eromheen zijn afgesproken ook echt in de code staan:

   1. ER WORDT GEEN PROFIEL AANGEMAAKT van iemand die geen lid is. De
      klaargezette reis bevat de reis en niet de persoon; geen naam, geen
      e-mailadres, geen telefoonnummer -- ook niet als de aanvrager ze meestuurt.
   2. EEN NIET-OPGEEISTE LINK LEKT NIETS. Wie hem doorstuurt geeft geen
      boekingsnummers, titels of datums per onderdeel weg.
   3. EEN REISGENOOT WORDT MET ZIJN IDENTITEIT GECONTROLEERD, want hij komt in
      de reisgegevens van iemand anders. Wie zijn EIGEN reis van het reisbureau
      overneemt, hoeft dat niet.
   4. EEN LINK GEEFT NOOIT EEN PAS, en werkt maar een keer.

   Draai los: node --experimental-sqlite --test test/reisuitnodiging.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, keurLidGoed } = require('./helper');

const dag = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
let srv, base, kantoor, klant, genoot;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-uitnodiging-'));
const post = (pad, body, token, idem) => fetch(base + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json',
    ...(token ? { Authorization: 'Bearer ' + token } : {}),
    ...(idem ? { 'Idempotency-Key': idem } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const nieuwLid = async (naam) => {
  const u = naam + Date.now().toString().slice(-6);
  const r = await post('/api/auth/register', { name: naam, email: u + '@x.nl', phone: '06' + u.replace(/\D/g, '').slice(-8),
    password: 'geheim123', geboortedatum: '1990-01-01' });
  /* DOOR DE KEURING, want aanmelden alleen is geen geverifieerde identiteit meer.
     idGeverifieerd() (server/server.js) nam aan dat elke pas-houder geballoteerd
     was; sinds die aanname is vervangen door een vraag aan de keuring, valt een
     vers aangemeld lid op /uitnodiging/eisop af op de IDENTITEITSCONTROLE in
     plaats van erdoorheen te komen. Toets 4 zou dan groen zijn op de verkeerde
     grond -- of, zoals hier, rood terwijl er niets stuk is.

     keurLidGoed() loopt de echte weg (bewijs insturen, kantoor keurt goed) en
     staat in ./helper.js, zodat deze stappen op een plek staan; vijf andere
     toetsbestanden gebruiken hem al. */
  if (r.body.token) await keurLidGoed(base, r.body.token, r.body.state.user.codename, '1990-01-01');
  return r.body.token;
};

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const login = await post('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' });
  kantoor = login.body.token;
  assert.ok(kantoor, 'het kantoor logt in');
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

let LINK = null, CODE = null;

test('1. het kantoor leest voor en zet een reis klaar -- zonder iets over de klant te bewaren', async () => {
  // voorlezen bewaart niets; het is puur regelwerk
  const lees = await post('/api/office/reisbureau/lees', {
    tekst: 'Casa Ibiza, check-in ' + dag(40) + ', check-out ' + dag(45) + '. Booking reference: QQ1234'
  }, kantoor);
  assert.equal(lees.status, 200);
  assert.equal(lees.body.gelezen.velden.bestemming.waarde, 'Ibiza');

  /* De aanvraag stuurt met opzet OOK persoonsgegevens mee. Die horen nergens
     terecht te komen: een klaargezette reis gaat over de reis. */
  const zet = await post('/api/office/reisbureau/klaarzetten', {
    naam: 'Jan de Vries', email: 'jan@voorbeeld.nl', telefoon: '0612345678',
    onderdelen: [
      { soort: 'verblijf', titel: 'Casa Ibiza', bestemming: 'Ibiza', van: dag(40), tot: dag(45), kenmerk: 'QQ1234', herkomst: 'document' },
      { soort: 'vlucht', titel: 'RT418', bestemming: 'Ibiza', van: dag(40), herkomst: 'document' }
    ]
  }, kantoor);
  assert.equal(zet.status, 200);
  assert.ok(zet.body.link.includes('/apps/reisuitnodiging.html?code='), 'er komt een link terug');
  LINK = zet.body.link; CODE = LINK.split('code=')[1];
  assert.equal(CODE.length, 32, 'de code is 128 bits en dus niet te raden');

  const bewaard = JSON.stringify(zet.body.uitnodiging);
  assert.ok(!bewaard.includes('Jan de Vries'), 'de naam van de klant wordt niet bewaard');
  assert.ok(!bewaard.includes('jan@voorbeeld.nl'), 'zijn e-mailadres ook niet');
  assert.ok(!bewaard.includes('0612345678'), 'en zijn telefoonnummer ook niet');
});

test('2. een niet-opgeeiste link laat zien dat het over jou gaat, en verder niets', async () => {
  const open = await post('/api/reis/uitnodiging/open', { code: CODE }, null);
  assert.equal(open.status, 200, 'openen kan zonder account -- dat is de hele opzet');
  const u = open.body.uitnodiging;
  assert.equal(u.bestemming, 'Ibiza');
  assert.equal(u.aantal, 2);
  assert.deepEqual(u.soorten, { verblijf: 1, vlucht: 1 }, 'hoeveel en van welke soort mag');
  assert.equal(u.van, 'het RTG-reisbureau');
  assert.equal(u.open, true);
  assert.equal(u.idNodig, false, 'uw eigen reis overnemen vraagt geen identiteitscontrole');

  /* De PERIODE hoort er wel bij te staan -- daaraan herkent iemand dat het over
     zijn reis gaat. Wat er niet in mag staan is het onderdeel zelf: geen
     titels, geen kenmerken, geen aparte datums. */
  assert.deepEqual(u.venster, { van: dag(40), tot: dag(45) }, 'de periode mag, en is nodig om te herkennen');
  assert.ok(!('onderdelen' in u), 'de onderdelen zelf gaan niet mee');
  const alles = JSON.stringify(open.body);
  assert.ok(!alles.includes('QQ1234'), 'het boekingsnummer lekt niet');
  assert.ok(!alles.includes('Casa Ibiza'), 'de titels lekken niet');
  assert.ok(!alles.includes('RT418'), 'het vluchtnummer ook niet');

  // een verzonnen code levert niets op
  assert.equal((await post('/api/reis/uitnodiging/open', { code: 'a'.repeat(32) }, null)).status, 404);
});

test('3. wie de link opent kan lid worden en de reis overnemen', async () => {
  klant = await nieuwLid('Klant');
  assert.ok(klant, 'de ontvanger maakt gewoon een account aan');
  const leeg = await post('/api/reis/reizen', {}, klant);
  assert.deepEqual(leeg.body.reizen, [], 'die begint met een lege reiswereld');

  const eis = await post('/api/reis/uitnodiging/eisop', { code: CODE }, klant);
  assert.equal(eis.status, 200);
  assert.equal(eis.body.overgenomen, 2);

  const na = await post('/api/reis/reizen', {}, klant);
  assert.equal(na.body.reizen.length, 1, 'de klaargezette reis staat nu bij hem');
  const reis = na.body.reizen[0];
  assert.equal(reis.bestemming, 'Ibiza');
  assert.equal(reis.telling.onderdelen, 2);
  assert.deepEqual(reis.herkomsten, ['document'], 'de herkomst van het onderdeel blijft staan, niet die van het transport');

  /* EN EEN LINK WERKT MAAR EEN KEER -- maar dan moet het wel een tweede POGING
     zijn en geen dubbeltik. Opeisen staat in lib/idemsleutels-werelden.js als
     `zelfdeVerzoek`: twee woordelijk gelijke verzoeken binnen seconden zijn een
     dubbelklik, en dan hoort de tweede het eerste antwoord terug te krijgen in
     plaats van een fout. Precies wat die laag moet doen. Een bewuste tweede
     poging draagt daarom een eigen Idempotency-Key, zoals een echte client. */
  assert.equal((await post('/api/reis/uitnodiging/eisop', { code: CODE }, klant,
    'tweede-poging-eisop')).status, 409);
  const dicht = await post('/api/reis/uitnodiging/open', { code: CODE }, null);
  assert.equal(dicht.body.uitnodiging.open, false);
  assert.match(dicht.body.uitnodiging.reden, /al gebruikt/i);
});

test('4. een reisgenoot wordt met zijn identiteit gecontroleerd', async () => {
  const mijn = await post('/api/reis/reizen', {}, klant);
  const onderdelen = mijn.body.reizen[0].onderdelen.map(o => ({
    soort: o.soort, titel: o.titel, bestemming: o.bestemming, van: o.van, tot: o.tot, kenmerk: o.kenmerk
  }));
  const uit = await post('/api/reis/uitnodiging/nodig-uit', { onderdelen }, klant);
  assert.equal(uit.status, 200);
  const code2 = uit.body.link.split('code=')[1];

  const beeld = await post('/api/reis/uitnodiging/open', { code: code2 }, null);
  assert.equal(beeld.body.uitnodiging.idNodig, true, 'hier is de identiteitscontrole wel nodig');
  assert.notEqual(beeld.body.uitnodiging.van, 'het RTG-reisbureau');
  assert.ok(!JSON.stringify(beeld.body).includes('Klant'), 'de uitnodiger staat er op codenaam, niet op naam');

  /* Een gratis account is nog geen geverifieerde identiteit. Hij mag dus wel
     lid zijn, maar niet zomaar in de reis van een ander. */
  const gast = (await post('/api/login', { tier: 'guest' })).body.token;
  const geweigerd = await post('/api/reis/uitnodiging/eisop', { code: code2 }, gast);
  assert.equal(geweigerd.status, 403);
  assert.match(geweigerd.body.error, /identiteitscontrole/i);
  assert.deepEqual((await post('/api/reis/reizen', {}, gast)).body.reizen, [],
    'en er is niets bij hem terechtgekomen');

  // een geballoteerd pas-lid is wel geverifieerd
  genoot = await nieuwLid('Genoot');
  const goed = await post('/api/reis/uitnodiging/eisop', { code: code2 }, genoot);
  assert.equal(goed.status, 200);
  const reis = (await post('/api/reis/reizen', {}, genoot)).body.reizen[0];
  assert.equal(reis.bestemming, 'Ibiza');
  assert.deepEqual(reis.herkomsten, ['gedeeld'],
    'voor de reisgenoot is de bron een ander lid -- hij boekte dat hotel niet zelf');
  assert.ok(reis.onderdelen.every(o => !o.bewijs), 'en er gaan geen bewijsstukken van een ander mee');
});

test('5. je eigen uitnodiging is voor iemand anders, en intrekken kan tot hij gebruikt is', async () => {
  const mijn = await post('/api/reis/reizen', {}, klant);
  const onderdelen = [{ soort: 'verblijf', titel: 'Casa Ibiza', bestemming: 'Ibiza', van: dag(40), tot: dag(45) }];
  const uit = await post('/api/reis/uitnodiging/nodig-uit', { onderdelen }, klant);
  const code3 = uit.body.link.split('code=')[1];
  assert.equal((await post('/api/reis/uitnodiging/eisop', { code: code3 }, klant)).status, 409,
    'jezelf uitnodigen slaat nergens op');

  const lijst = await post('/api/reis/uitnodiging/mijn', {}, klant);
  assert.ok(lijst.body.uitnodigingen.length >= 2, 'zijn eigen uitnodigingen staan bij hem');
  const nog = lijst.body.uitnodigingen.find(x => x.link.includes(code3));
  assert.equal((await post('/api/reis/uitnodiging/weg', { id: nog.id }, klant)).status, 200);
  assert.equal((await post('/api/reis/uitnodiging/eisop', { code: code3 }, genoot)).status, 409,
    'een ingetrokken uitnodiging doet niets meer');
  // en die van een ander kun je niet intrekken
  assert.equal((await post('/api/reis/uitnodiging/weg', { id: nog.id }, genoot)).status, 404);
});

test('6. zonder onderdelen geen uitnodiging, en het kantoor houdt zijn eigen lijst', async () => {
  assert.equal((await post('/api/reis/uitnodiging/nodig-uit', { onderdelen: [] }, klant)).status, 400);
  assert.equal((await post('/api/office/reisbureau/klaarzetten', { onderdelen: [{ soort: 'verblijf' }] }, kantoor)).status, 400,
    'een onderdeel zonder naam en datum telt niet mee');
  // de kantoorlijst is van HET kantoor en niet van een medewerker
  const lijst = await post('/api/office/reisbureau/uitnodigingen', {}, kantoor);
  assert.ok(lijst.body.uitnodigingen.some(x => x.link.includes(CODE)), 'de klaargezette reis staat in de kantoorlijst');
  // en de deur zit dicht zonder kantoorinlog
  assert.equal((await post('/api/office/reisbureau/klaarzetten', { onderdelen: [] }, klant)).status, 401);
  assert.equal((await post('/api/reis/uitnodiging/eisop', { code: CODE }, null)).status, 401);
});

test('7. het kantoor trekt een klaargezette reis in, en de link is daarna dood', async () => {
  /* De dekkingspoort van de CI vond dit endpoint als het enige dat de hele
     suite nooit aanraakte -- het intrekken was alleen langs de LEDENroute
     getoetst (toets 5), nooit langs de kantoorbalie. Dit is de kantoorkant:
     een klaargezette reis waarvan de klant afziet, moet de medewerker kunnen
     intrekken voordat de link ergens blijft slingeren. */
  const zet = await post('/api/office/reisbureau/klaarzetten', {
    onderdelen: [{ soort: 'verblijf', titel: 'Casa Ibiza', bestemming: 'Ibiza', van: dag(50), tot: dag(53) }]
  }, kantoor);
  assert.equal(zet.status, 200);
  const code = zet.body.link.split('code=')[1];
  const id = zet.body.uitnodiging.id;

  // zonder kantoorinlog is er niets in te trekken -- ook niet door een lid
  assert.equal((await post('/api/office/reisbureau/uitnodiging-weg', { id }, klant)).status, 401);

  const weg = await post('/api/office/reisbureau/uitnodiging-weg', { id }, kantoor);
  assert.equal(weg.status, 200);
  const beeld = await post('/api/reis/uitnodiging/open', { code }, null);
  assert.equal(beeld.body.uitnodiging.open, false, 'de link is dood');
  assert.match(beeld.body.uitnodiging.reden, /ingetrokken/i);
  assert.equal((await post('/api/reis/uitnodiging/eisop', { code }, genoot)).status, 409,
    'en opeisen kan niet meer');
  // een verzonnen id trekt niets in, en zegt dat eerlijk
  assert.equal((await post('/api/office/reisbureau/uitnodiging-weg', { id: 'U-bestaatniet' }, kantoor)).status, 404);
  // en de ingetrokken reis staat in de kantoorlijst als ingetrokken
  const lijst = await post('/api/office/reisbureau/uitnodigingen', {}, kantoor);
  assert.equal(lijst.body.uitnodigingen.find(x => x.id === id).ingetrokken, true);
});
