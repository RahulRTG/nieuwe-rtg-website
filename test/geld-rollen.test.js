/* KOMT LID B BIJ HET GELD VAN LID A?

   De perimetertoets (test/perimeter-risico.test.js) bewijst dat niemand ZONDER
   identiteit door deze deuren komt. Dat is de ondergrens, en het is niet de
   vraag die telt zodra er echt geld staat. De vraag die telt is: houdt de deur
   ook stand voor iemand die WEL is ingelogd, maar niet de eigenaar is?

   Dat is een andere vraag met een ander antwoord, en de vorm waarin hij fout
   gaat is berucht genoeg om een naam te hebben (IDOR). Kijk naar de routes in
   server/routes/bank.js en je ziet precies die vorm: de IBAN of het pas-id komt
   uit de BODY -- die kiest de aanvrager zelf -- en de codenaam komt uit de
   SESSIE. Elke plek waar die twee niet tegen elkaar worden gehouden is een
   rekening die de verkeerde kan legen.

   WAT DEZE TOETS DOET. Twee echte leden, allebei ingelogd, allebei met een eigen
   bankrekening en een eigen pas. Daarna probeert B stelselmatig alles wat er met
   A's IBAN en A's pas te doen valt: bevriezen, limiet zetten, geld eraf halen,
   krediet aanvragen, een pas bijmaken, een incasso instellen, een bulkbetaling
   doen. Elk van die pogingen hoort te worden geweigerd.

   EN DAARNA -- en dit is het deel dat de toets echt maakt -- wordt A's stand
   opnieuw opgehaald en vergeleken met de stand van voor de aanval. "B kreeg een
   404" is namelijk niet hetzelfde als "er is niets gebeurd": een route kan
   netjes een fout teruggeven en ondertussen toch iets hebben aangeraakt. Alleen
   de vergelijking voor en na sluit dat uit.

   ZONDER OPZET IS DEZE TOETS LEEG. Als de bank niet live staat, of A heeft geen
   rekening, of B is niet echt ingelogd, dan wordt alles geweigerd om een reden
   die niets met eigendom te maken heeft en zegt groen niets (LAT.md regel 9).
   Daarom bewijst test.before eerst dat de opzet ECHT staat, en doet toets 1 de
   tegenproef: A mag zijn eigen pas wel bevriezen. Zakt die, dan is de rest
   waardeloos en dat merk je meteen.

   Draai los: node --experimental-sqlite --test test/geld-rollen.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, office, A = {}, B = {};
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-geldrollen-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

async function maakLid(merk) {
  const u = (Date.now() + Math.floor(Math.random() * 1e6)).toString().slice(-9);
  const r = await api('/api/auth/register', {
    name: 'Rollen ' + merk, email: 'rol' + merk + u + '@voorbeeld.test', phone: '06' + u,
    password: 'geheim12345', geboortedatum: '1990-03-03', geslacht: 'v',
    tier: 'business', pasApp: 'business'
  });
  assert.ok(r.body.token, merk + ' moet een sessie krijgen: ' + JSON.stringify(r.body).slice(0, 120));
  return { token: r.body.token };
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'RTG-OFFICE' } });
  base = srv.base;

  /* De leden-bank staat dicht tot de boardroom hem live zet. Zonder deze stap
     geeft ELK bank-endpoint 403 "nog niet live", en dan meet deze toets de
     openingstijden in plaats van het eigendomsrecht. */
  office = (await api('/api/office/login', { code: 'RTG-OFFICE' })).body.token;
  assert.ok(office, 'het kantoor moet kunnen inloggen');
  const live = await api('/api/office/bank/leden', { aan: true }, office);
  assert.equal(live.status, 200, 'de leden-bank moet live gezet kunnen worden: ' + JSON.stringify(live.body).slice(0, 120));

  A = await maakLid('A');
  B = await maakLid('B');

  // allebei akkoord: dat opent meteen de eerste betaalrekening
  for (const [naam, lid] of [['A', A], ['B', B]]) {
    const ak = await api('/api/bank/akkoord', {}, lid.token);
    assert.equal(ak.status, 200, naam + ' moet akkoord kunnen geven: ' + JSON.stringify(ak.body).slice(0, 140));
    const ov = await api('/api/bank/overzicht', {}, lid.token);
    const rek = (ov.body.rekeningen || [])[0];
    assert.ok(rek && rek.iban, naam + ' moet een IBAN hebben na akkoord: ' + JSON.stringify(ov.body).slice(0, 200));
    lid.iban = rek.iban;
  }
  assert.notEqual(A.iban, B.iban, 'A en B hebben verschillende rekeningen -- anders toetst dit niets');

  // A geeft zichzelf een pas
  const pas = await api('/api/bank/pas/uitgeven', { iban: A.iban, soort: 'debit', naam: 'Pas van A' }, A.token);
  assert.equal(pas.status, 200, 'A moet een pas kunnen uitgeven: ' + JSON.stringify(pas.body).slice(0, 160));
  A.pas = (pas.body.pas && pas.body.pas.id) || pas.body.id;
  assert.ok(A.pas, 'A heeft een pas-id: ' + JSON.stringify(pas.body).slice(0, 160));
});

test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

/* De stand van A, zoals A hem zelf ziet. Dit is de maat waarmee we na afloop
   vergelijken; hij komt via A's eigen sessie, want dat is de enige weg die de
   waarheid over A's rekening geeft. */
async function standVanA() {
  const ov = await api('/api/bank/overzicht', {}, A.token);
  const passen = await api('/api/bank/passen', {}, A.token);
  const krediet = await api('/api/bank/krediet', {}, A.token);
  const terug = await api('/api/bank/terugkerend', {}, A.token);
  return JSON.stringify({
    rekeningen: ov.body.rekeningen, passen: passen.body.passen,
    kredieten: krediet.body.kredieten || krediet.body, terugkerend: terug.body.terugkerend || terug.body
  });
}

test('1. TEGENPROEF: A mag zijn eigen pas wel bevriezen (anders bewijst de rest niets)', async () => {
  const aan = await api('/api/bank/pas/bevries', { id: A.pas, aan: true }, A.token);
  assert.equal(aan.status, 200, 'de eigenaar komt er gewoon in: ' + JSON.stringify(aan.body).slice(0, 140));
  const lijst = await api('/api/bank/passen', {}, A.token);
  const p = (lijst.body.passen || []).find(x => x.id === A.pas);
  assert.ok(p, 'de pas staat in A zijn lijst');
  assert.equal(p.bevroren, true, 'en hij is nu echt bevroren -- de actie DOET iets');
  // terugdraaien, zodat de aanvalstoetsen op een schone stand beginnen
  const uit = await api('/api/bank/pas/bevries', { id: A.pas, aan: false }, A.token);
  assert.equal(uit.status, 200);
});

test('2. B komt met zijn eigen geldige sessie nergens bij A binnen', async () => {
  const voor = await standVanA();

  /* Elke ingang die een IBAN of een pas-id uit de BODY aanneemt. Dat is precies
     de lijst waar een IDOR zich verstopt: de aanvrager kiest het voorwerp, de
     server moet de eigenaar erbij houden.

     DE VERWACHTE STATUS STAAT ERBIJ EN IS NIET "IETS BOVEN DE 400". Dat is
     dezelfde reden als bij test/perimeter-risico.test.js: een toets die alleen
     "niet 2xx" eist blijft groen nadat iemand een route hernoemt, en bewaakt dan
     niets meer. Bovendien is 404 hier de JUISTE status en 403 niet: "bestaat
     niet" verraadt niet dat de rekening van een ander wel bestaat, en 403 zou
     dat wel doen. Verschuift dit naar 403, dan is dat een echte verandering en
     hoort die op te vallen. */
  const pogingen = [
    [404, '/api/bank/rekening', { iban: A.iban }],
    [404, '/api/bank/afschrift', { iban: A.iban }],
    [404, '/api/bank/bevries', { iban: A.iban, aan: true }],
    [404, '/api/bank/naar-wallet', { iban: A.iban, centen: 100 }],
    /* WALLET NAAR BANK IS VOOR IEDEREEN DICHT, en daarom staat hier 409 en geen
       404. RTG Pay is een gesloten circuit (TOKEN.md: WALLET_SALDO is een
       besluit, geen vergunning): saldo besteedt u binnen RTG en het gaat niet
       naar een bankrekening -- van uzelf niet en van een ander al helemaal
       niet. De route weigert dus vóór hij naar de eigenaar kijkt.

       Dat verzwakt de eigendomsgrens niet, het maakt hem overbodig op deze ene
       ingang, en de stand van A hieronder bewijst nog steeds dat er niets is
       gebeurd. Gaat de bank-uitgang ooit open (TOKEN.md par. 7, besluit een),
       dan hoort hier weer 404 te staan en zakt deze regel -- precies de
       bedoeling. */
    [409, '/api/bank/van-wallet', { iban: A.iban, centen: 100 }],
    [404, '/api/bank/storten', { iban: A.iban, centen: 5000, route: 'ideal' }],
    [404, '/api/bank/overboek', { vanIban: A.iban, naarIban: B.iban, centen: 5000, oms: 'kaping' }],
    [404, '/api/bank/sepa', { iban: A.iban, centen: 5000, naarIban: 'NL00RTGB0000000000', begunstigde: 'B', oms: 'x' }],
    [404, '/api/bank/spaardoel', { iban: A.iban, euro: 999 }],
    [404, '/api/bank/pas/uitgeven', { iban: A.iban, soort: 'debit', naam: 'Pas van B op A' }],
    [404, '/api/bank/pas/bevries', { id: A.pas, aan: true }],
    [404, '/api/bank/pas/limiet', { id: A.pas, euro: 9999 }],
    [404, '/api/bank/pas/betaal', { id: A.pas, centen: 5000, oms: 'kaping' }],
    [404, '/api/bank/pas/sluit', { id: A.pas }],
    [404, '/api/bank/terugkerend/zet', { vanIban: A.iban, naarIban: B.iban, centen: 5000, interval: 'maand', oms: 'kaping' }],
    [404, '/api/bank/bulk', { vanIban: A.iban, posten: [{ iban: B.iban, centen: 5000, oms: 'kaping' }], oms: 'kaping' }],
    [404, '/api/bank/salaris', { vanIban: A.iban, posten: [{ iban: B.iban, centen: 5000, oms: 'kaping' }], oms: 'kaping' }]
  ];

  const afwijkend = [];
  for (const [verwacht, pad, body] of pogingen) {
    const r = await api(pad, body, B.token);
    if (r.status !== verwacht) afwijkend.push(pad + ': verwacht ' + verwacht + ', kreeg ' + r.status + ' ' + JSON.stringify(r.body).slice(0, 70));
  }
  assert.deepEqual(afwijkend, [], 'de eigendomsgrens is verschoven');

  /* EN DE STAND VAN A IS ONGEWIJZIGD. Een nette foutmelding is geen bewijs dat
     er niets is gebeurd -- alleen dit is dat. Een route kan best 404 antwoorden
     en onderweg al iets hebben aangeraakt. */
  assert.equal(await standVanA(), voor, 'A zijn rekeningen, passen, kredieten of incassos zijn veranderd door B');
});

test('2b. krediet is dicht om een VERGUNNING en niet om eigendom -- dat is niet hetzelfde', async () => {
  /* Deze staat apart, en dat is met opzet. /api/bank/krediet/aanvraag weigert B
     ook, maar met 503 en de reden "hiervoor is een vergunning nodig die nog niet
     is vastgelegd" (functieschakelaar dom-bank-krediet). Die weigering komt VOOR
     de eigendomscontrole en zegt dus niets over de eigendomscontrole.

     Hem stilzwijgend in de lijst hierboven laten meelopen zou de gevaarlijkste
     soort groen opleveren: een endpoint dat als "bewezen dicht voor een ander
     lid" telt terwijl het alleen maar helemaal uit staat. Zodra de vergunning er
     is en de schakelaar omgaat, zakt DEZE toets -- en dat is precies het moment
     waarop iemand /api/bank/krediet/aanvraag naar de lijst hierboven moet
     verhuizen en de eigendomsgrens er echt moet bewijzen.

     Voor de volledigheid: de kern doet de controle wel (server/kern/bank/krediet.js
     regel 18 vergelijkt m.codenaam met de codenaam uit de sessie). Alleen komt
     het verzoek daar vandaag niet. Gelezen is geen bewezen. */
  const r = await api('/api/bank/krediet/aanvraag', { iban: A.iban, euro: 10000, looptijdMnd: 12 }, B.token);
  assert.equal(r.status, 503, 'krediet hoort dicht te staan achter de vergunningsschakelaar');
  assert.match(String(r.body.error || ''), /vergunning/, 'en met die reden erbij');
  assert.equal(r.body.functie, 'dom-bank-krediet', 'de schakelaar die hem dichthoudt staat er met naam bij');
});

test('3. B ziet A ook niet staan in zijn eigen overzichten', async () => {
  /* De andere helft van hetzelfde: niet alleen niet MOGEN aanraken, maar ook
     niet ZIEN. Een lijst die per ongeluk alles teruggeeft in plaats van het
     eigen bezit lekt saldi zonder dat er iets gemuteerd wordt. */
  const ov = await api('/api/bank/overzicht', {}, B.token);
  const ibans = (ov.body.rekeningen || []).map(r => r.iban);
  assert.ok(ibans.includes(B.iban), 'B ziet zijn eigen rekening');
  assert.ok(!ibans.includes(A.iban), 'B ziet de rekening van A NIET in zijn overzicht');

  const passen = await api('/api/bank/passen', {}, B.token);
  const ids = (passen.body.passen || []).map(p => p.id);
  assert.ok(!ids.includes(A.pas), 'B ziet de pas van A niet in zijn passenlijst');
});

test('4. een verzonnen IBAN of pas-id levert geen informatie op', async () => {
  /* Wie geen geldig doelwit heeft, gaat raden. Het antwoord op een verzonnen
     IBAN hoort niet te verschillen van het antwoord op een BESTAANDE rekening
     van iemand anders -- anders is de foutmelding zelf een orakel dat vertelt
     welke rekeningen bestaan. */
  const verzonnen = 'NL99RTGB9999999999';
  const opAndermans = await api('/api/bank/rekening', { iban: A.iban }, B.token);
  const opVerzonnen = await api('/api/bank/rekening', { iban: verzonnen }, B.token);
  assert.equal(opAndermans.status, opVerzonnen.status,
    'bestaand-maar-niet-van-jou en bestaat-niet horen hetzelfde te antwoorden, anders lekt de status het bestaan');

  const opAndermansPas = await api('/api/bank/pas/bevries', { id: A.pas, aan: true }, B.token);
  const opVerzonnenPas = await api('/api/bank/pas/bevries', { id: 'PASVERZONNEN', aan: true }, B.token);
  assert.equal(opAndermansPas.status, opVerzonnenPas.status, 'zelfde voor passen');
});
