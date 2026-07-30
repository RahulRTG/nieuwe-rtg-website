/* DE PAPIEREN: Rahul vraagt het AVG-papierwerk uit in plaats van een
   [VUL IN]-lijst achter te laten die niemand invult.

   Waar deze tests op letten, in volgorde van belang:

   1. RAHUL VERZINT NOOIT. Er mag geen enkel pad zijn waarlangs een antwoord in
      het register belandt zonder dat een mens het heeft ingetypt. Een verzonnen
      KvK-nummer of een verzonnen telefoonnummer van de jurist is erger dan een
      leeg veld: een leeg veld ziet iedereen, een verzonnen nummer gelooft
      iedereen -- tot je het belt, midden in een datalek.
   2. Het document liegt niet over zijn eigen volledigheid.
   3. Parkeren mag ("weet ik nu niet") maar telt gewoon als open.
   4. Alleen de eigenaar. Hier staan privénummers en het KvK-nummer.

   Draai los: node --experimental-sqlite --test test/papieren.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

// de module leest zijn opslagpad bij het laden; daarom eerst een verse map
const EIGEN = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-pap-'));
process.env.RTG_DATA_DIR = EIGEN;
const papieren = require('../server/papieren');

const { startServer, stop } = require('./helper');

test.after(() => { try { fs.rmSync(EIGEN, { recursive: true, force: true }); } catch (e) {} });

test('1. op een verse installatie is er niets ingevuld -- en het document geeft dat toe', () => {
  assert.equal(papieren.klaar(), false, 'niets beantwoord = niet klaar');
  assert.equal(papieren.overzicht().open, papieren.VRAGEN.length, 'alles staat open');

  const d = papieren.document('verwerkingsregister');
  assert.ok(d.gaten > 0, 'het register toont zijn eigen gaten');
  assert.match(d.tekst, /Rahul heeft dit nog niet uitgevraagd/,
    'een leeg veld is zichtbaar leeg, niet stilletjes weggelaten');
  // en er staat nergens een verzonnen KvK-nummer of telefoonnummer
  assert.doesNotMatch(d.tekst, /KvK\s*\d/, 'geen verzonnen KvK-nummer in het register');
  assert.doesNotMatch(papieren.document('datalek').tekst, /06[-\s]?\d{8}/, 'geen verzonnen telefoonnummer in het draaiboek');
});

test('2. de eerste vraag komt in Rahuls woorden, met erbij waarom hij het vraagt', () => {
  const v = papieren.volgende();
  assert.ok(v && v.vraag, 'er is een vraag');
  assert.ok(v.waarom && v.waarom.length > 40, 'en een uitleg waarom, geen kaal label');
  assert.equal(v.totaal, papieren.VRAGEN.length);
  assert.equal(v.open, papieren.VRAGEN.length);
  // elke vraag hoort een waarom te hebben; anders wordt het alsnog een invullijst
  for (const q of papieren.VRAGEN) {
    assert.ok(q.waarom && q.waarom.length > 40, q.id + ' mist een fatsoenlijke uitleg');
    assert.ok(q.veld && q.groep, q.id + ' mist veld of groep');
  }
});

test('3. een antwoord van een mens landt letterlijk in het document', () => {
  const r = papieren.antwoord('verantwoordelijke', 'Voorbeeld Reizen B.V., KvK 87654321, Teststraat 2, Rotterdam', { door: 'Tester' });
  assert.ok(r.ok, r.fout);
  const d = papieren.document('verwerkingsregister');
  assert.match(d.tekst, /Voorbeeld Reizen B\.V\., KvK 87654321/, 'exact wat er is gezegd, niet geherschreven');
  const rij = papieren.overzicht().regels.find(x => x.id === 'verantwoordelijke');
  assert.equal(rij.status, 'ingevuld');
  assert.equal(rij.door, 'Tester', 'wie het zei staat erbij');
  assert.ok(rij.at, 'en wanneer');
  // "laatst bijgewerkt" is een feit dat het systeem zelf weet, geen vraag
  assert.match(d.tekst, /\*\*Laatst bijgewerkt:\*\* \d{4}-\d{2}-\d{2}/);
});

test('4. parkeren mag, maar telt gewoon als open -- de keuring gaat er niet overheen', () => {
  const voor = papieren.overzicht().open;
  const r = papieren.antwoord('privacycontact', '', { parkeer: true, door: 'Tester' });
  assert.ok(r.ok && r.geparkeerd, r.fout);
  assert.equal(papieren.overzicht().open, voor, 'geparkeerd telt nog steeds als open');
  assert.equal(papieren.overzicht().regels.find(x => x.id === 'privacycontact').status, 'geparkeerd');
  assert.match(papieren.document('verwerkingsregister').tekst, /nog niet bekend/,
    'het document zegt eerlijk dat dit nog niet bekend is');
  // en Rahul komt er ook echt op terug
  const open = papieren.openVragen().map(v => v.id);
  assert.ok(open.includes('privacycontact'), 'de vraag blijft in de lijst staan');
});

test('5. "geen idee" wordt geparkeerd, niet als feit vastgelegd', () => {
  const r = papieren.antwoord('fg', 'geen idee', { door: 'Tester' });
  assert.ok(r.ok && r.geparkeerd, 'een schouderophalen is geen antwoord');
  assert.equal(papieren.overzicht().regels.find(x => x.id === 'fg').waarde, null,
    'er staat geen "geen idee" als feit in het register');
  assert.doesNotMatch(papieren.document('verwerkingsregister').tekst, /geen idee/i);
});

test('6. onzin wordt geweigerd in plaats van aangevuld', () => {
  assert.ok(papieren.antwoord('bestaatniet', 'iets').fout, 'onbekende vraag');
  assert.ok(papieren.antwoord('rolJurist', 'ja').fout, 'te kort voor een naam + nummer');
  assert.ok(papieren.antwoord('vwoHosting', 'ja').fout, 'een kaal ja is geen dossier');
  assert.ok(papieren.antwoord('vwoHosting', 'Ja, met Hostpartij B.V. sinds maart').ok, 'ja mét toelichting wel');
  // niets van dit alles heeft stiekem iets ingevuld
  assert.equal(papieren.overzicht().regels.find(x => x.id === 'rolJurist').status, 'open');
});

test('7. alles beantwoord = een document zonder gaten', () => {
  for (const v of papieren.openVragen())
    papieren.antwoord(v.id, 'Ingevuld door de test: ' + v.veld, { door: 'Tester' });
  assert.equal(papieren.klaar(), true);
  for (const naam of Object.keys(papieren.DOCUMENTEN)) {
    const d = papieren.document(naam);
    assert.equal(d.gaten, 0, naam + ' heeft geen open plekken meer');
    assert.doesNotMatch(d.tekst, /\{\{\w+\}\}/, naam + ' heeft geen merktekens meer over');
  }
});

test('8. de opslag staat naast de documenten, niet in de database', () => {
  const bestand = path.join(EIGEN, 'papieren.json');
  assert.ok(fs.existsSync(bestand), 'een eigen bestand: leesbaar zonder draaiende server');
  // tijdens een datalek is de database precies het ding dat je niet vertrouwt
  const mode = fs.statSync(bestand).mode & 0o777;
  assert.equal(mode & 0o077, 0, 'alleen de eigenaar van het proces mag erbij (0600)');
  assert.ok(JSON.parse(fs.readFileSync(bestand, 'utf8')).antwoorden.verantwoordelijke.waarde);
});

test('9. alleen de eigenaar: het papierwerk zit achter de eigenaarspoort', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-paprt-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const zonder = await fetch(base + '/api/techniek/papieren');
    assert.ok(zonder.status === 401 || zonder.status === 403, 'zonder inlog niets');

    const tech = await (await fetch(base + '/api/techniek/inloggen', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: 'roellie.i@gmail.com', wachtwoord: 'Imran' })
    })).json();
    assert.ok(tech.token, 'de eigenaar komt binnen');
    const kop = { Authorization: 'Bearer ' + tech.token };

    const stand = await (await fetch(base + '/api/techniek/papieren', { headers: kop })).json();
    assert.equal(stand.open, papieren.VRAGEN.length, 'op een verse server staat alles open');
    assert.ok(stand.volgende && stand.volgende.waarom, 'Rahul heeft meteen een vraag klaar');

    const na = await (await fetch(base + '/api/techniek/papieren/antwoord', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...kop },
      body: JSON.stringify({ id: 'rolBeslisser', waarde: 'Testpersoon, 06-00000000, ook buiten kantooruren' })
    })).json();
    assert.equal(na.open, papieren.VRAGEN.length - 1, 'een antwoord minder open');
    assert.notEqual(na.volgende.id, 'rolBeslisser', 'en Rahul gaat door naar de volgende');

    const doc = await (await fetch(base + '/api/techniek/papieren/document?naam=datalek', { headers: kop })).json();
    assert.match(doc.tekst, /Testpersoon, 06-00000000/, 'het draaiboek is bijgewerkt');
    assert.ok(doc.gaten > 0, 'en meldt eerlijk hoeveel er nog openstaat');
  } finally {
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
