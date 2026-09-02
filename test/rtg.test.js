/* HET GEREEDSCHAP -- rtg new, check, dev en sdk.

   De belofte van dit gereedschap is niet "het draait" maar iets scherpers:
   **het bouwt niets na**. De poort die `rtg check` draait is de poort van de
   server, de brug die `rtg dev` draait is de brug van de server, en de CSP en de
   brugklant komen uit dezelfde module als de cel. Zodra daar een kopie naast
   komt, lopen ze een keer uiteen -- en dan is de fout die een uitgever te zien
   krijgt "werkt lokaal, geblokkeerd in de cel".

   Deze toets houdt dat vast, plus de twee dingen die het gereedschap zelf
   belooft:

     - `rtg check` geeft DRIE uitslagen en noemt de virusscan niet-uitgevoerd
       in plaats van hem stil over te slaan of er een afkeuring van te maken;
     - `rtg dev` weigert een capability die niet bestaat met dezelfde tekst als
       productie -- nee, plus waarom, plus de veilige route.

   En één regressie die deze toets bij het schrijven al heeft gevangen: het
   sjabloon van `rtg new` kwam zijn eigen `rtg check` niet door, omdat er
   `fetch()` in een COMMENTAARregel stond en de poort regels leest zonder
   commentaar af te strijken.

   Draai los: node --test test/rtg.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const rtg = require('../scripts/rtg');
const sdk = require('../scripts/rtg-sdk');

const WORTEL = path.join(__dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-cli-'));

/* De uitvoer opvangen, want wat dit gereedschap ZEGT is het halve product. */
function vang(fn) {
  const regels = [];
  const oudLog = console.log, oudFout = console.error;
  console.log = (...a) => regels.push(a.join(' '));
  console.error = (...a) => regels.push(a.join(' '));
  let uit;
  try { uit = fn(); } finally { console.log = oudLog; console.error = oudFout; }
  return { uit, tekst: regels.join('\n').replace(/\x1b\[[0-9;]*m/g, '') };
}

function verseApp(naam) {
  const map = path.join(TMP, naam);
  const r = vang(() => rtg.opdrachtNew([map]));
  assert.equal(r.uit, 0, r.tekst);
  return map;
}

test('1 - rtg new maakt een app die zijn EIGEN rtg check doorkomt', () => {
  /* Dit is de toets die het sjabloon eerlijk houdt. Een `rtg new` die iets
     aflevert wat de poort meteen tegenhoudt, leert een ontwikkelaar op zijn
     eerste minuut dat het gereedschap niet klopt. */
  const map = verseApp('eerste');
  for (const f of ['manifest.json', 'index.html', 'app.js', 'app.css']) {
    assert.ok(fs.existsSync(path.join(map, f)), f + ' hoort in het sjabloon te zitten');
  }
  const r = vang(() => rtg.opdrachtCheck([map]));
  assert.equal(r.uit, 0, 'het sjabloon hoort de poort door te komen:\n' + r.tekst);
  assert.match(r.tekst, /vorm\s+in orde/);
});

test('2 - rtg check geeft DRIE uitslagen en verzint geen goedkeuring', () => {
  const map = verseApp('drie');
  const r = vang(() => rtg.opdrachtCheck([map]));
  assert.match(r.tekst, /vorm\s+in orde/);
  assert.match(r.tekst, /virusscan\s+niet uitgevoerd/, 'de scan draait hier niet, en dat hoort er te staan');
  assert.match(r.tekst, /keuring\s+niet vast te stellen/, 'een mens van RTG keurt, niet dit gereedschap');
  assert.doesNotMatch(r.tekst, /goedgekeurd|approved/i, 'de machinepoort keurt nooit goed (APPSTORE.md grens 2)');
});

test('3 - rtg check wijst blokkades aan met bestand EN regelnummer', () => {
  const map = verseApp('blokkade');
  fs.writeFileSync(path.join(map, 'app.js'), 'const x = 1;\nfetch("https://elders.nl");\n');
  const r = vang(() => rtg.opdrachtCheck([map]));
  assert.equal(r.uit, 1, 'een bundel met een netwerkaanroep hoort te blokkeren');
  assert.match(r.tekst, /app\.js:2/, 'met het regelnummer, anders is het een zoekopdracht');
  assert.match(r.tekst, /RTG\.roep\(\)/, 'en met de weg die WEL werkt');
  assert.match(r.tekst, /vorm\s+blokkeert/);
});

test('4 - rtg check zegt wat het NIET heeft meegenomen', () => {
  /* Stil overslaan is hier het gevaarlijkst: dan keurt de poort iets goed wat
     niet is wat de ontwikkelaar voor zich ziet. */
  const map = verseApp('overslaan');
  fs.mkdirSync(path.join(map, 'node_modules'), { recursive: true });
  fs.writeFileSync(path.join(map, 'node_modules', 'x.js'), 'x');
  fs.writeFileSync(path.join(map, 'notities.md'), '# hoi');
  const r = vang(() => rtg.opdrachtCheck([map]));
  assert.match(r.tekst, /overgeslagen/);
  assert.match(r.tekst, /node_modules/);
  assert.match(r.tekst, /notities\.md/);
  assert.match(r.tekst, /NIET in wat hier is gekeurd/);
});

test('5 - een kapot manifest komt terug met het VELD erbij', () => {
  const map = verseApp('manifest');
  const m = JSON.parse(fs.readFileSync(path.join(map, 'manifest.json'), 'utf8'));
  m.categorie = 'verzonnen';
  m.hotelkamer = 'A12';
  fs.writeFileSync(path.join(map, 'manifest.json'), JSON.stringify(m));
  const r = vang(() => rtg.opdrachtCheck([map]));
  assert.equal(r.uit, 1);
  assert.match(r.tekst, /categorie/);
  assert.match(r.tekst, /hotelkamer/, 'een onbekend veld wordt geweigerd, niet genegeerd');
});

test('6 - het gereedschap draait de ECHTE poort en bouwt hem niet na', () => {
  /* De toets die de hele belofte draagt. Zou de CLI zijn eigen verbodenlijst of
     eigen budget krijgen, dan keurt hij iets anders dan de server. */
  const bron = fs.readFileSync(path.join(WORTEL, 'scripts/rtg.js'), 'utf8');
  assert.match(bron, /require\(path\.join\(WORTEL, 'server\/kern\/appstore\/keuring'\)\)/);
  assert.match(bron, /require\(path\.join\(WORTEL, 'server\/kern\/appstore\/bundel'\)\)/);
  assert.match(bron, /require\(path\.join\(WORTEL, 'server\/kern\/appstore\/manifest'\)\)/);
  assert.ok(!/VERBODEN_JS\s*=/.test(bron), 'de CLI hoort geen eigen verbodenlijst te hebben');
  assert.ok(!/BUDGET\s*=\s*\{/.test(bron), 'en geen eigen budget');

  const dev = fs.readFileSync(path.join(WORTEL, 'scripts/rtg-dev.js'), 'utf8');
  assert.match(dev, /require\(path\.join\(WORTEL, 'server\/kern\/appstore\/brug'\)\)/, 'rtg dev draait de echte brug');
  assert.match(dev, /require\(path\.join\(WORTEL, 'server\/kern\/appstore\/brugklant'\)\)/, 'en zet de echte CSP en brugklant');
  /* Op `default-src` en niet op `connect-src`: dat laatste NOEMT rtg-dev in zijn
     opstartregel ("de echte CSP: connect-src 'none'"), en dat is precies wat een
     ontwikkelaar hoort te lezen. Een CSP DEFINIEREN begint met default-src, en
     dat hoort hier niet te staan. */
  assert.ok(!/default-src/.test(dev), 'rtg dev hoort geen eigen CSP te schrijven');
  assert.ok(!/GRENS\s*=\s*\{/.test(dev), 'en geen eigen grenzen');
});

test('7 - de SDK wordt uit de code gegenereerd, niet uit een lijst', () => {
  const b = sdk.bron();
  /* GEEN VAST AANTAL MEER -- de kop bij toets 5 van test/mutatie.test.js legt
     uit waarom (de arenalaag bracht er drie mee, en het getal was het enige dat
     zakte). Wat deze toets werkelijk bewijst staat in de lus eronder: elke
     methode die de brug kent, staat MET zijn mutatieklasse in de typings.

     De echte eis hier is dat de SDK dezelfde methodes kent als de brug zelf.
     Dat is een vergelijking tussen twee lezers en niet met een getal, en die
     kan niet verouderen: komt er een methode bij die de SDK niet oppikt, dan
     zakt hij nog steeds. */
  const { maakBrug } = require('../server/kern/appstore/brug');
  const staat = { opslag: {}, bakjes: {} };
  const brug = maakBrug({ S: () => staat, save() {}, boek() {},
    nu: () => new Date().toISOString(), eigen: (o, k) => o[k] });
  assert.deepEqual(b.methodes.map(m => m.naam).sort(), [...brug.METHODES].sort(),
    'de SDK hoort exact de methodes van de brug te kennen, niet een eigen lijst');
  assert.ok(b.methodes.length >= 6, 'en het horen er meerdere te zijn');
  const dts = sdk.typings(b);
  for (const m of b.methodes) {
    assert.ok(dts.includes("roep(methode: '" + m.naam + "'"), m.naam + ' hoort in de typings te staan');
    assert.ok(dts.includes('mutatie: ' + m.mutatie), 'met zijn mutatieklasse erbij');
  }
  // de grenzen komen uit de brug en zijn niet overgetypt
  assert.ok(dts.includes('opslagSleutels: ' + b.GRENS.opslagSleutels));
  assert.ok(dts.includes('roepenPerMinuut: ' + b.GRENS.roepenPerMinuut));
});

test('8 - elke methode heeft een vorm, en er staat er geen te veel', () => {
  /* De argument- en antwoordvorm is het enige stuk dat niet uit de code te lezen
     valt. Precies daarom moet iets bewaken dat die lijst niet achterloopt: een
     zevende methode zonder vorm zou stilletjes `unknown` opleveren. */
  const namen = sdk.bron().methodes.map(m => m.naam).sort();
  assert.deepEqual(Object.keys(sdk.VORMEN).sort(), namen,
    'scripts/rtg-sdk.js VORMEN loopt uit de pas met de methodes van de brug');
});

test('9 - de documentatie draagt "bewust niet beschikbaar" met redenen', () => {
  const md = sdk.documentatie(sdk.bron());
  assert.match(md, /## Bewust niet beschikbaar/);
  const { NIET_GEBOUWD } = require('../server/kern/appstore/machtigingen');
  for (const wat of Object.keys(NIET_GEBOUWD)) {
    assert.ok(md.includes('**' + wat + '**'), wat + ' hoort in de documentatie te staan mét de reden');
  }
  assert.match(md, /Codes die er \(nog\) niet zijn/);
  // en de mutatieklasse staat per methode in de tabel, want dat is wat een taakloper leest
  assert.match(md, /\| `bericht\.zet` \| `bericht\.klaarzetten` \| `nietHerhaalbaar` \|/);
});

test('10 - de hulp noemt alleen opdrachten die bestaan', () => {
  const r = vang(() => rtg.hoofd([]));
  assert.equal(r.uit, 0);
  for (const o of ['new', 'check', 'dev', 'sdk']) assert.match(r.tekst, new RegExp('rtg ' + o));
  assert.match(r.tekst, /heeft een inlog nodig/, 'dat dit gereedschap geen inlog vraagt, hoort in de hulp te staan');
  assert.match(r.tekst, /uitgeversbureau/, 'en waar inzenden dan wel gebeurt');
  const onbekend = vang(() => rtg.hoofd(['verzin']));
  assert.equal(onbekend.uit, 2);
  assert.match(onbekend.tekst, /is geen opdracht/);
});

test('11 - de derde uitslag zit in de POORT en niet alleen in de uitvoer', () => {
  /* Deze stond er eerst niet, en een mutatie liet dat zien: de let-op-bevinding
     stil weghalen brak geen enkele toets, omdat alleen de REGEL die de CLI print
     werd nagerekend. De poort is de plek waar het antwoord vandaan komt, dus
     daar hoort het te worden vastgelegd -- elke andere lezer van keur() krijgt
     die bevinding ook. */
  const { keur } = require('../server/kern/appstore/keuring');
  const bundel = [{ pad: 'index.html', buf: Buffer.from('<html><head></head><body>hoi</body></html>') }];
  const manifest = { start: 'index.html', icoon: null };

  // op de server: een ontbrekende controle is GEEN stilzwijgend ja
  const server = keur({ bestanden: bundel, manifest, antivirus: null });
  assert.equal(server.door, false, 'zonder scanner gaat de poort op de server dicht');
  assert.equal(server.scan, 'niet-uitgevoerd');

  // in de CLI: de vorm wordt beoordeeld, de scan heet niet-uitgevoerd, en dat staat erbij
  const lokaal = keur({ bestanden: bundel, manifest, antivirus: null, eisScan: false });
  assert.equal(lokaal.door, true, 'de vorm van deze bundel houdt de poort niet tegen');
  assert.equal(lokaal.scan, 'niet-uitgevoerd', 'en de scan is een eersteklas uitslag, geen stilte');
  const melding = lokaal.bevindingen.find(b => /virusscan/.test(b.wat));
  assert.ok(melding, 'de niet-uitgevoerde scan hoort als bevinding in de uitslag te staan');
  assert.equal(melding.ernst, 'let-op', 'als let-op en niet als blokkade: het is geen fout van de inzending');
  assert.match(melding.hoe, /server van RTG/, 'met waar hij dan wel draait');

  // en mét scanner blijft alles zoals het was
  const AV = { scan: () => ({ verdict: 'schoon', redenen: [] }), definities: () => [] };
  const met = keur({ bestanden: bundel, manifest, antivirus: AV, eisScan: false });
  assert.equal(met.scan, 'uitgevoerd');
  assert.ok(!met.bevindingen.some(b => /virusscan is hier niet/.test(b.wat)));
});

test.after(() => { fs.rmSync(TMP, { recursive: true, force: true }); });
