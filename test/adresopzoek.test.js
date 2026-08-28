/* ============================================================================
   DE ADRESOPZOEKER -- postcode en huisnummer erin, de rest eruit.

   WAT HIER BEWEZEN WORDT, EN WAAROM JUIST DAT

   1. ER GAAN TWEE DINGEN DE DEUR UIT EN NIET MEER. De uitgaande URL wordt op
      een plek gebouwd, en deze toets leest hem letterlijk na: postcode,
      huisnummer, en geen naam, e-mailadres, lidnummer of codenaam. Dat is de
      hele reden dat deze vraag naar een derde partij mag.

   2. EN ER KOMT NIET MEER TERUG DAN AFGESPROKEN. Het antwoord draagt alleen de
      velden uit NAAR_BUITEN. Dat is geen netheid: `uitCache` ging eerder wel mee,
      en daarmee kon lid B aftasten of lid A een concreet adres had opgezocht --
      in een huis dat op codenamen draait is dat een lek. Toets 8, 15 en 17
      leggen de lijst vast, in de module en in een echt draaiende server.

   3. DE BRON IS FUZZY EN LIEGT DUS VRIENDELIJK. De free-ingang van PDOK geeft
      ALTIJD zijn beste treffer. Met echte aanroepen nagemeten op 2026-08-05:
      "9999ZZ 1" (bestaat niet) gaf "1 juli-weg 1G-01, Maastricht" en "2611HB
      250" gaf huisnummer 169 op diezelfde postcode. Die twee antwoorden staan
      hieronder als vaste opnamen in de toets, want dit is precies het geval
      waarin de opzoeker met veel zelfvertrouwen het adres van iemand anders
      invult.

   4. FALEN IS EEN ANTWOORD, MAAR GEEN STILTE. Geen net, een 500, een postcode
      die niet bestaat, de opzoeker uitgezet: allemaal gevonden:false met een
      reden, nooit een uitzondering. En elke storing gaat luid de deur uit naar
      de fout-aggregatie (toets 13), want een opzoeker die stilletjes stuk is,
      laat elk lid weer met de hand typen zonder dat iemand het merkt.

   5. DE BELOFTEN UIT DE MODULEKOP ZIJN TOETSEN, GEEN TEKST (LAT.md regel 6).
      "Een korte tijdgrens en geen herhaling" staat in toets 11 als gelijkheid op
      de opties die de client krijgt -- met herhaling aan zou het bronbudget van
      zestig stilletjes honderdtachtig worden. "Een storing bewaren we niet"
      staat in toets 12 als een tweede, geslaagde vraag na een 500.

   HET NET WORDT HIER NIET OPGEGAAN. De pure kant draait op een nagebootste
   client, de routetoets op een nagebootste PDOK op 127.0.0.1 (dezelfde
   werkwijze als test/stripe-eigen.test.js). Een toets die van het internet
   afhangt is geen toets maar een weerbericht.

   Draai los: node --test test/adresopzoek.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const { maakAdresopzoek } = require('../server/kern/adresopzoek');
const { normaliseerPostcode, normaliseerHuisnummer, bouwVraag, leesAntwoord, NAAR_BUITEN } =
  require('../server/kern/adresopzoek/vertaling');

/* Twee ECHTE PDOK-antwoorden, ingekort tot de velden die wij lezen. Ze komen
   van een echte aanroep, niet uit mijn hoofd. */
const DAM = { response: { numFound: 371898, docs: [{
  straatnaam: 'Dam', woonplaatsnaam: 'Amsterdam', postcode: '1012JS', huisnummer: 1,
  huis_nlt: '1', weergavenaam: 'Dam 1, 1012JS Amsterdam' }] } };
// "9999ZZ 1" -- bestaat niet, en toch komt er een adres terug. Zonder postcode.
const MAASTRICHT = { response: { numFound: 371866, docs: [{
  straatnaam: '1 juli-weg', woonplaatsnaam: 'Maastricht', huisnummer: 1,
  huis_nlt: '1G-01', weergavenaam: '1 juli-weg 1G-01, Maastricht' }] } };
// "2611HB 250" -- die postcode bestaat, dat huisnummer niet; PDOK geeft 169.
const DELFT_ANDER = { response: { numFound: 3678, docs: [{
  straatnaam: 'Oude Delft', woonplaatsnaam: 'Delft', postcode: '2611HB', huisnummer: 169,
  huis_nlt: '169A', weergavenaam: 'Oude Delft 169A, 2611HB Delft' }] } };

/* Een nagebootste http-client met de vorm van server/lib/http: hij onthoudt elke
   AANROEP (niet alleen de URL, ook de opties) en geeft terug wat de toets hem
   opdraagt. */
function nepClient(antwoorden) {
  const urls = [], aanroepen = [];
  const rij = [].concat(antwoorden);
  return {
    urls, aanroepen,
    async vraag(opties) {
      urls.push(opties.url); aanroepen.push(opties);
      const a = rij.length > 1 ? rij.shift() : rij[0];
      if (a instanceof Error) throw a;
      return { status: a.status || 200, headers: {}, tekst: a.tekst != null ? a.tekst : JSON.stringify(a.json) };
    }
  };
}
// een melder die onthoudt in plaats van te loggen: zo is stilte zichtbaar
function nepMelder() {
  const gemeld = [];
  const fn = (e, ctx) => gemeld.push({ bericht: e && e.message, ctx });
  fn.gemeld = gemeld;
  return fn;
}
const opzoeker = (antwoorden, env) => maakAdresopzoek({ http: nepClient(antwoorden), env: env || {}, meld: nepMelder() });

/* ---------------------------------------------------------------- de pure kant */

test('1. de postcode wordt genormaliseerd, en wat er niet op lijkt is buitenland', () => {
  for (const ruw of ['1012JS', '1012 js', '1012-JS', ' 1012 Js ']) {
    const r = normaliseerPostcode(ruw);
    assert.equal(r.ok, true, ruw + ' hoort een geldige postcode te zijn');
    assert.equal(r.postcode, '1012JS', ruw + ' hoort 1012JS te worden');
  }
  // een buitenlandse postcode is geen tikfout: die bron kennen we gewoon niet
  for (const ruw of ['W1A 1AA', '75008', 'B-1000', '0123AB']) {
    assert.deepEqual(normaliseerPostcode(ruw), { ok: false, reden: 'buitenland' }, ruw);
  }
  // niets ingevuld is iets anders dan buitenland, en verdient een andere zin
  for (const ruw of ['', '   ', null, undefined]) {
    assert.deepEqual(normaliseerPostcode(ruw), { ok: false, reden: 'onvolledig' }, String(ruw));
  }
});

test('2. het huisnummer valt uiteen in een getal en een toevoeging', () => {
  assert.deepEqual(normaliseerHuisnummer('12'), { ok: true, nummer: 12, toevoeging: '', tekst: '12' });
  assert.deepEqual(normaliseerHuisnummer('12A'), { ok: true, nummer: 12, toevoeging: 'A', tekst: '12 A' });
  assert.deepEqual(normaliseerHuisnummer(' 12 bis '), { ok: true, nummer: 12, toevoeging: 'BIS', tekst: '12 BIS' });
  assert.deepEqual(normaliseerHuisnummer(169), { ok: true, nummer: 169, toevoeging: '', tekst: '169' });
  for (const ruw of ['', 'huisje', '0', null]) {
    assert.deepEqual(normaliseerHuisnummer(ruw), { ok: false, reden: 'onvolledig' }, String(ruw));
  }
});

test('3. er gaan TWEE dingen de deur uit: postcode en huisnummer, en niets anders', () => {
  const url = bouwVraag(null, '1012JS', '1 A');
  assert.match(url, /^https:\/\/api\.pdok\.nl\/bzk\/locatieserver\/search\/v3_1\/free\?/, url);
  assert.equal(url, 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/free'
    + '?q=1012JS%201%20A&fq=type%3Aadres&rows=1', 'de vraag staat er voluit, zodat je hem kunt nalezen');
  /* De echte bewering: alles wat de vraag draagt is de postcode en het
     huisnummer. Wie hier ooit een lidnummer of een codenaam bij zet om "de
     opzoeking te kunnen thuisbrengen", laat deze toets zakken. */
  const rest = url.replace(/^[^?]*\?/, '').split('&').map(p => p.split('=')[0]).sort();
  assert.deepEqual(rest, ['fq', 'q', 'rows'], 'niet meer parameters dan deze drie');
  assert.equal(decodeURIComponent(url.split('q=')[1].split('&')[0]), '1012JS 1 A');
});

test('4. het PDOK-antwoord wordt vertaald naar straat, woonplaats en land', () => {
  assert.deepEqual(leesAntwoord(DAM, { postcode: '1012JS', nummer: 1 }),
    { gevonden: true, straat: 'Dam', woonplaats: 'Amsterdam', land: 'NL', postcode: '1012JS', huisnummer: 1 });
});

test('5. een fuzzy treffer op een ANDER adres telt niet als gevonden', () => {
  // de twee echte gevallen uit de kop van dit bestand
  assert.deepEqual(leesAntwoord(MAASTRICHT, { postcode: '9999ZZ', nummer: 1 }),
    { gevonden: false, reden: 'onbekend' }, 'een treffer zonder postcode is geen antwoord op onze vraag');
  assert.deepEqual(leesAntwoord(DELFT_ANDER, { postcode: '2611HB', nummer: 250 }),
    { gevonden: false, reden: 'onbekend' }, 'huisnummer 169 is geen antwoord op de vraag naar 250');
  /* Een treffer ZONDER straat is iets anders dan een onbekend adres: dan
     antwoordde de bron wel, maar niet in de vorm waar wij op rekenen. Dat is een
     defect bij ons, en het draagt daarom het interne merkteken bronVreemd. */
  const leeg = { response: { docs: [{ straatnaam: '', woonplaatsnaam: 'Amsterdam', postcode: '1012JS', huisnummer: 1 }] } };
  assert.deepEqual(leesAntwoord(leeg, { postcode: '1012JS', nummer: 1 }),
    { gevonden: false, reden: 'onbekend', bronVreemd: true });
  // en helemaal geen treffers: dat adres bestaat gewoon niet
  assert.deepEqual(leesAntwoord({ response: { docs: [] } }, { postcode: '1012JS', nummer: 1 }), { gevonden: false, reden: 'onbekend' });
  assert.deepEqual(leesAntwoord(null, { postcode: '1012JS', nummer: 1 }), { gevonden: false, reden: 'onbekend' });
});

/* -------------------------------------------------- de opzoeker als geheel */

test('6. een gevonden adres komt terug, en de tweede keer zonder de lijn op te gaan', async () => {
  const client = nepClient([{ json: DAM }]);
  const o = maakAdresopzoek({ http: client, env: {}, meld: nepMelder() });
  const een = await o.zoek({ postcode: '1012 js', huisnummer: '1' });
  assert.equal(een.gevonden, true, JSON.stringify(een));
  assert.equal(een.straat, 'Dam');
  assert.equal(een.woonplaats, 'Amsterdam');
  assert.equal(een.land, 'NL');
  assert.equal(client.urls.length, 1, 'een keer over de lijn');

  const twee = await o.zoek({ postcode: '1012JS', huisnummer: '1' });
  assert.equal(twee.gevonden, true);
  assert.equal(twee.straat, 'Dam');
  assert.equal(client.urls.length, 1, 'en er ging GEEN tweede vraag naar buiten: de cache ving hem op');
  /* De cache mag niet te merken zijn AAN HET ANTWOORD. Hij is gedeeld tussen alle
     leden van dit proces, dus elk verschil tussen "vers opgehaald" en "stond er
     al" vertelt lid B iets over wat lid A heeft opgezocht. */
  assert.deepEqual(twee, een, 'het tweede antwoord is letterlijk gelijk aan het eerste');
});

test('7. faalt de opzoeking, dan is dat een antwoord en geen fout', async () => {
  // een 500 van PDOK
  const vijfhonderd = await opzoeker([{ status: 500, tekst: 'kapot' }]).zoek({ postcode: '1012JS', huisnummer: '1' });
  assert.deepEqual({ g: vijfhonderd.gevonden, r: vijfhonderd.reden }, { g: false, r: 'onbereikbaar' });
  assert.ok(vijfhonderd.tekst.length > 10, 'er staat een zin bij die een mens iets zegt');

  // geen internet: de client gooit
  const stuk = await opzoeker([Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' })])
    .zoek({ postcode: '1012JS', huisnummer: '1' });
  assert.deepEqual({ g: stuk.gevonden, r: stuk.reden }, { g: false, r: 'onbereikbaar' });

  // een tijdgrens ziet er voor ons hetzelfde uit
  const traag = await opzoeker([Object.assign(new Error('HTTP: tijd verstreken'), { code: 'ETIMEDOUT' })])
    .zoek({ postcode: '1012JS', huisnummer: '1' });
  assert.equal(traag.reden, 'onbereikbaar');

  // onleesbare JSON mag de app ook niet omgooien
  const brij = await opzoeker([{ status: 200, tekst: '<html>oeps' }]).zoek({ postcode: '1012JS', huisnummer: '1' });
  assert.equal(brij.reden, 'onbereikbaar');

  // een postcode die niet bestaat: de fuzzy treffer wordt geweigerd
  const nep = await opzoeker([{ json: MAASTRICHT }]).zoek({ postcode: '9999ZZ', huisnummer: '1' });
  assert.deepEqual({ g: nep.gevonden, r: nep.reden }, { g: false, r: 'onbekend' });
  assert.equal(nep.straat, undefined, 'nooit een lege straat als gevonden');
});

test('8. het antwoord draagt niet meer dan de afgesproken velden', async () => {
  const client = nepClient([{ json: DAM }]);
  const o = maakAdresopzoek({ http: client, env: {}, meld: nepMelder() });
  const een = await o.zoek({ postcode: '1012JS', huisnummer: '1' });
  assert.deepEqual(Object.keys(een).sort(),
    ['gevonden', 'huisnummer', 'land', 'postcode', 'straat', 'woonplaats'], JSON.stringify(een));
  const twee = await o.zoek({ postcode: '1012JS', huisnummer: '1' });   // uit de cache
  assert.equal(twee.uitCache, undefined, 'de cache verklapt zichzelf niet aan de client');
  for (const sleutel of Object.keys(twee)) {
    assert.ok(NAAR_BUITEN.includes(sleutel), sleutel + ' staat niet op de lijst NAAR_BUITEN');
  }
  // en ook een mislukking zegt niet meer dan reden + zin
  const mis = await opzoeker([{ status: 500, tekst: 'x' }]).zoek({ postcode: '1012JS', huisnummer: '1' });
  assert.deepEqual(Object.keys(mis).sort(), ['gevonden', 'reden', 'tekst']);
  // een vreemde bron levert een INTERN merkteken op, en dat blijft binnen
  const vreemd = await opzoeker([{ json: { response: { docs: [{ woonplaatsnaam: 'Amsterdam', postcode: '1012JS', huisnummer: 1 }] } } }])
    .zoek({ postcode: '1012JS', huisnummer: '1' });
  assert.equal(vreemd.bronVreemd, undefined, 'bronVreemd is voor ons, niet voor de client');
});

test('9. buitenland en onvolledig gaan de deur niet eens uit', async () => {
  const client = nepClient([{ json: DAM }]);
  const o = maakAdresopzoek({ http: client, env: {}, meld: nepMelder() });
  const buiten = await o.zoek({ postcode: 'W1A 1AA', huisnummer: '10' });
  assert.deepEqual({ g: buiten.gevonden, r: buiten.reden }, { g: false, r: 'buitenland' });
  assert.match(buiten.tekst, /Nederlandse/, 'en hij zegt netjes waarom');
  const half = await o.zoek({ postcode: '1012JS', huisnummer: '' });
  assert.equal(half.reden, 'onvolledig');
  assert.equal(client.urls.length, 0, 'geen van beide kostte een vraag aan PDOK');
});

test('10. RTG_ADRESOPZOEK=uit: de app gedraagt zich alsof de opzoeker niets weet', async () => {
  const client = nepClient([{ json: DAM }]);
  const o = maakAdresopzoek({ http: client, env: { RTG_ADRESOPZOEK: 'uit' }, meld: nepMelder() });
  const r = await o.zoek({ postcode: '1012JS', huisnummer: '1' });
  assert.deepEqual({ g: r.gevonden, r: r.reden }, { g: false, r: 'uit' });
  assert.equal(client.urls.length, 0, 'uit is uit: er gaat niets naar buiten');
});

test('11. een korte tijdgrens en GEEN herhaling, letterlijk nagelezen', async () => {
  /* Dit is geen cosmetica. De rem hieronder (toets 16) telt AANROEPEN en geen
     HTTP-pogingen, dus met maxRetries 3 wordt "hoogstens zestig vragen per
     minuut naar de bron" stilletjes honderdtachtig -- en blijft die toets groen.
     Daarom staat de belofte uit de modulekop hier als gelijkheid. */
  const client = nepClient([{ json: DAM }]);
  const o = maakAdresopzoek({ http: client, env: {}, meld: nepMelder() });
  await o.zoek({ postcode: '1012JS', huisnummer: '1' });
  assert.equal(client.aanroepen.length, 1);
  const opt = client.aanroepen[0];
  assert.equal(opt.maxRetries, 0, 'geen herhaling: een tweede poging kost seconden en levert bij een storing niets op');
  assert.equal(opt.timeout, 2000, 'een korte tijdgrens: hier staat een typend mens tegenover');
  assert.equal(opt.method, 'GET');
});

test('12. een storing wordt NIET bewaard; een gevonden adres en een onbekend adres wel', async () => {
  // eerst een 500, daarna hetzelfde adres met een geldig antwoord
  const client = nepClient([{ status: 500, tekst: 'kapot' }, { json: DAM }]);
  const o = maakAdresopzoek({ http: client, env: {}, meld: nepMelder() });
  const stuk = await o.zoek({ postcode: '1012JS', huisnummer: '1' });
  assert.equal(stuk.reden, 'onbereikbaar');
  const nogmaals = await o.zoek({ postcode: '1012JS', huisnummer: '1' });
  assert.equal(nogmaals.gevonden, true, 'een minuut zonder net plakt geen dag lang: ' + JSON.stringify(nogmaals));
  assert.equal(client.urls.length, 2, 'de tweede vraag ging dus ECHT over de lijn');

  // ter tegenstelling: een adres dat niet bestaat wordt wel even onthouden
  const client2 = nepClient([{ json: { response: { docs: [] } } }]);
  const o2 = maakAdresopzoek({ http: client2, env: {}, meld: nepMelder() });
  await o2.zoek({ postcode: '1012JS', huisnummer: '9' });
  await o2.zoek({ postcode: '1012JS', huisnummer: '9' });
  assert.equal(client2.urls.length, 1, 'een typefout hoeft de bron niet twee keer te kosten');
});

test('13. een storing gaat LUID de deur uit, niet stil naar niemand', async () => {
  /* Het faalscenario dat dit afdekt: PDOK hernoemt een veld, leesAntwoord() geeft
     voortaan altijd gevonden:false, elk lid typt zijn adres weer met de hand, en
     niets meldt dat de functie dood is (LAT.md regel 5). */
  const m1 = nepMelder();
  const o1 = maakAdresopzoek({ http: nepClient([Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' })]), env: {}, meld: m1 });
  await o1.zoek({ postcode: '1012JS', huisnummer: '1' });
  assert.equal(m1.gemeld.length, 1, 'geen net is een melding, geen stilte');
  assert.match(m1.gemeld[0].bericht, /onbereikbaar/i, m1.gemeld[0].bericht);
  assert.equal(m1.gemeld[0].ctx.bron, 'adresopzoek', 'met een bron erbij, zodat het techniekbord het kan groeperen');
  assert.equal(o1.tellingen().gemeld, 1);

  const m2 = nepMelder();
  const o2 = maakAdresopzoek({ http: nepClient([{ status: 503, tekst: 'onderhoud' }]), env: {}, meld: m2 });
  await o2.zoek({ postcode: '1012JS', huisnummer: '1' });
  assert.equal(m2.gemeld.length, 1, 'een 503 van de bron ook');
  assert.match(m2.gemeld[0].bericht, /503/);

  // de bron antwoordt, maar zonder de velden waar wij op rekenen: dat is ONS defect
  const m3 = nepMelder();
  const o3 = maakAdresopzoek({ http: nepClient([{ json: { response: { docs: [{ woonplaatsnaam: 'Amsterdam', postcode: '1012JS', huisnummer: 1 }] } } }]), env: {}, meld: m3 });
  const r3 = await o3.zoek({ postcode: '1012JS', huisnummer: '1' });
  assert.equal(r3.gevonden, false);
  assert.equal(m3.gemeld.length, 1, 'een bron die van vorm verandert hoort te piepen: ' + JSON.stringify(m3.gemeld));
  assert.match(m3.gemeld[0].bericht, /straat|woonplaats/i);

  // en een adres dat gewoon niet bestaat is GEEN storing: dat zou het bord vervuilen
  const m4 = nepMelder();
  const o4 = maakAdresopzoek({ http: nepClient([{ json: { response: { docs: [] } } }]), env: {}, meld: m4 });
  await o4.zoek({ postcode: '1012JS', huisnummer: '9' });
  assert.deepEqual(m4.gemeld, [], 'een tikfout van een lid is geen storing');
  assert.deepEqual(o4.tellingen(), { gevonden: 0, onbekend: 1, onbereikbaar: 0, gemeld: 0 });
});

test('16. de rem hangt aan de BRON, niet aan de aanvrager', async () => {
  /* Elke vraag is een ander adres, dus de cache helpt hier niet: dit meet
     precies wat er naar PDOK gaat. Na het budget van een minuut is het antwoord
     "druk" en blijft de lijn stil, hoeveel verschillende leden er ook vragen. */
  const client = nepClient([{ json: { response: { docs: [] } } }]);
  const o = maakAdresopzoek({ http: client, env: {}, meld: nepMelder() });
  let druk = 0;
  for (let n = 1; n <= 70; n++) {
    const r = await o.zoek({ postcode: '1012JS', huisnummer: String(n) });
    if (r.reden === 'druk') druk++;
  }
  assert.equal(client.urls.length, 60, 'hoogstens zestig vragen per minuut naar de bron');
  assert.equal(druk, 10, 'de tien daarboven kregen een net antwoord in plaats van een vraag');
});

/* ------------------------------------------------------------- de route */

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-adres-'));
let srv, base, nepPdok, gezien = [], lid;

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
async function nieuwLid(naam) {
  const u = String(Date.now()).slice(-8) + Math.floor(Math.random() * 900 + 100);
  const reg = await api('/api/auth/register', {
    name: naam, email: naam.replace(/\W/g, '').toLowerCase() + u + '@x.nl', phone: '06' + u.slice(0, 8),
    password: 'geheim123', geboortedatum: '1990-01-01', geslacht: 'v', tier: 'rtg', pasApp: 'rtg'
  });
  assert.ok(reg.body.token, naam + ' is ingeschreven: ' + JSON.stringify(reg.body).slice(0, 140));
  return reg.body.token;
}

test.before(async () => {
  /* De nagebootste PDOK. Hij antwoordt alleen op de Dam en onthoudt elke vraag,
     zodat de toets kan nalezen wat er werkelijk over de lijn ging. */
  nepPdok = http.createServer((req, res) => {
    gezien.push(req.url);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(DAM));
  });
  await new Promise(r => nepPdok.listen(0, '127.0.0.1', r));
  const basis = 'http://127.0.0.1:' + nepPdok.address().port + '/locatieserver';
  srv = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '', RTG_ADRESOPZOEK_BASIS: basis } });
  base = srv.base;
  lid = await nieuwLid('Adres Lid');
});
test.after(() => {
  stop(srv && srv.child);
  try { nepPdok.close(); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('14. POST /api/adres/zoek staat achter de leden-poort', async () => {
  const zonder = await api('/api/adres/zoek', { postcode: '1012JS', huisnummer: '1' });
  assert.equal(zonder.status, 401, 'zonder token komt er niets uit: ' + JSON.stringify(zonder.body).slice(0, 140));
  assert.equal(gezien.length, 0, 'en er ging ook niets naar de bron');
});

test('15. POST /api/adres/zoek vult straat, woonplaats en land aan -- en niets anders', async () => {
  gezien = [];
  const r = await api('/api/adres/zoek', { postcode: '1012 js', huisnummer: '1' }, lid);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
  assert.deepEqual({ straat: r.body.straat, woonplaats: r.body.woonplaats, land: r.body.land },
    { straat: 'Dam', woonplaats: 'Amsterdam', land: 'NL' });
  assert.equal(gezien.length, 1, 'een vraag naar de bron');
  /* Wat er over de lijn ging, letterlijk en volledig nagelezen: de postcode, het
     huisnummer, en geen naam, e-mailadres of token. Deze regel staat er als
     GELIJKHEID en niet als match: een toets die alleen kijkt of het goede erin
     staat, ziet niet wat er nog meer bij is gezet. */
  assert.equal(gezien[0], '/locatieserver?q=1012JS%201&fq=type%3Aadres&rows=1',
    'de vraag draagt precies twee gegevens: ' + gezien[0]);
  const q = decodeURIComponent(gezien[0]);
  for (const gevoelig of ['Adres Lid', '@x.nl', 'Bearer', lid.slice(0, 12)]) {
    assert.equal(q.includes(gevoelig), false, 'dit hoort niet in de vraag te staan: ' + gevoelig);
  }
  // en terug komt niet meer dan afgesproken (toets 8, nu in een echte server)
  assert.deepEqual(Object.keys(r.body).sort(),
    ['gevonden', 'huisnummer', 'land', 'postcode', 'straat', 'woonplaats'], JSON.stringify(r.body));
});

test('17. de cache van de server verklapt niets over een ANDER lid', async () => {
  /* Het lek dat hier dicht moet blijven: de cache is per proces en dus gedeeld.
     Zou het antwoord ook maar EEN veld dragen dat verschilt tussen "vers
     opgehaald" en "stond er al", dan kan lid B aftasten welke adressen lid A
     heeft opgezocht -- in een huis dat op codenamen draait is dat gedrag van een
     ander lid, geen kadasterdata. */
  const lidB = await nieuwLid('Bea Buur');
  gezien = [];
  const a = await api('/api/adres/zoek', { postcode: '1012JS', huisnummer: '1' }, lid);
  const b = await api('/api/adres/zoek', { postcode: '1012JS', huisnummer: '1' }, lidB);
  assert.equal(gezien.length, 0, 'de cache ving ze allebei op (lid A vroeg het in toets 15 al)');
  assert.deepEqual(b.body, a.body, 'lid B krijgt letterlijk hetzelfde als lid A: ' + JSON.stringify(b.body));
  assert.equal(b.body.uitCache, undefined, 'en niets dat zegt dat het uit de cache kwam');
});

test('18. de rem telt per LID, niet per IP', async () => {
  /* Beide leden bellen vanaf 127.0.0.1. Telt de rem op het IP, dan sleept lid A
     lid B mee de 429 in -- achter een kantoor-NAT is dat precies wat er gebeurt.
     Een ander adres per poging, zodat de cache de rem niet omzeilt. */
  const lidC = await nieuwLid('Cor Collega');
  let remA = 0, laatsteA = null;
  for (let n = 0; n < 30; n++) {
    laatsteA = await api('/api/adres/zoek', { postcode: '1012JS', huisnummer: String(1000 + n) }, lid);
    if (laatsteA.status === 429) remA++;
  }
  assert.ok(remA > 0, 'de rem sloeg aan binnen dertig pogingen');
  assert.equal(laatsteA.status, 429, 'en hij blijft dicht voor lid A: ' + JSON.stringify(laatsteA.body).slice(0, 140));
  assert.equal(laatsteA.body.gevonden, false, 'ook de rem antwoordt in de taal van de opzoeker');
  const c = await api('/api/adres/zoek', { postcode: '1012JS', huisnummer: '1' }, lidC);
  assert.equal(c.status, 200, 'de collega vanaf hetzelfde IP komt er gewoon door: ' + JSON.stringify(c.body).slice(0, 140));
});

test('19. RTG_ADRESOPZOEK=uit werkt ook ECHT in een draaiende server', async () => {
  /* Toets 10 bewijst de schakelaar in de module. Dat is niet hetzelfde als de
     schakelaar in de app: de route bouwt zijn eigen opzoeker, en wie die ooit
     een eigen env meegeeft zet de knop stil uit zonder dat er iets van omvalt.
     Daarom staat hier een tweede server, met de vlag zoals een beheerder hem
     zet. */
  const uitTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-adres-uit-'));
  const basis = 'http://127.0.0.1:' + nepPdok.address().port + '/locatieserver';
  const uitSrv = await startServer({ env: {
    RTG_DATA_DIR: uitTmp, SMTP_URL: '', RTG_ADRESOPZOEK_BASIS: basis, RTG_ADRESOPZOEK: 'uit' } });
  const oudeBase = base;
  try {
    base = uitSrv.base;
    const uitLid = await nieuwLid('Uit Lid');
    gezien = [];
    const r = await api('/api/adres/zoek', { postcode: '1012JS', huisnummer: '1' }, uitLid);
    assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
    assert.equal(r.body.gevonden, false, 'de opzoeker weet niets meer: ' + JSON.stringify(r.body));
    assert.equal(r.body.reden, 'uit');
    assert.equal(gezien.length, 0, 'en er ging niets naar de bron');
  } finally {
    base = oudeBase;
    stop(uitSrv && uitSrv.child);
    try { fs.rmSync(uitTmp, { recursive: true, force: true }); } catch (e) { /* al weg */ }
  }
});
