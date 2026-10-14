/* HET JOURNAAL OP SCHIJF ONDER DRUK (server/kern/journaalbestand.js, met
   ./journaalrotatie.js en ./journaallezen.js eronder).

   Het append-only journaal is waar het doorgeefjournaal terugkijkt: wat er
   binnenkwam en wat er de deur uitging. test/journaalbestand.test.js legt de
   gewone weg vast. Dit bestand doet wat een stroomstoring, een volle schijf, een
   verkeerde sleutel of iemand met schrijfrechten op de map doet, en kijkt of het
   journaal dat OVERLEEFT zonder te liegen.

   Wat hier niet mag sneuvelen:
   1. een afgekapte, verminkte of met een andere sleutel geschreven regel wordt
      overgeslagen en GETELD -- nooit stil weggelaten en nooit een worp die het
      hele journaal onleesbaar maakt;
   2. een gemanipuleerde cijfertekst (een bit omgezet) wordt door de
      authenticatie geweigerd en niet als regel gelezen;
   3. een schrijffout (onschrijfbare map, onserialiseerbare regel) wordt
      GEMELD, een keer, en zet het journaal daarna dicht: noteerRegel zegt dan
      `false` in plaats van te doen alsof het bewaard is; het verzoek breekt niet;
   4. de asynchrone spoeling schrijft alles, ook wat er tijdens het schrijven
      bijkwam, en een volle stapel spoelt meteen;
   5. rotatie overschrijft nooit een bestaand bestand, ook niet bij een klok die
      terugloopt, en houdt de schijf begrensd;
   6. het standaardjournaal en spoelAlle() schrijven bij het afsluiten weg wat
      er nog in de stapel stond.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - in noteerRegel() `if (stuk) return false;` weggehaald
     -> "3. een onschrijfbare map meldt EEN keer en zet het journaal dicht" en
        "3c. de asynchrone weg" ZAKKEN (RAAK)
   - in spoel() `if (stapel.length) spoel();` (na het schrijven) weggehaald
     -> "4. een volle stapel spoelt meteen ..." en "3c. de asynchrone weg"
        ZAKKEN (RAAK): de tweede ronde bleef liggen tot er iets nieuws kwam
   - in journaallezen.uitBestand de catch `telOvergeslagen()` weggehaald
     -> "1. een verkeerde sleutel", "2. een omgezette bit" en "2b. een regel die
        geen JSON is" ZAKKEN (RAAK)

   Draai: node --test test/journaalbestand-weerbaar.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { wachtOpWaarde } = require('./helper');

const mappen = [];
function verseMap() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-journaal-weerbaar-'));
  mappen.push(d);
  return d;
}
test.after(() => { for (const d of mappen) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) {} } });

/* De kluis leest RTG_ENC_KEY bij het laden. Een journaal met een bepaalde
   sleutel vraagt dus een verse journaalgroep uit de cache, net als in
   test/journaalbestand.test.js toets 6. */
function versGroep() {
  for (const k of Object.keys(require.cache))
    if (/server[\/\\](kluis|kern[\/\\]journaal)/.test(k)) delete require.cache[k];
}
function metSleutel(sleutel, werk) {
  const oud = process.env.RTG_ENC_KEY;
  if (sleutel == null) delete process.env.RTG_ENC_KEY; else process.env.RTG_ENC_KEY = sleutel;
  versGroep();
  try { return werk(require('../server/kern/journaalbestand.js')); }
  finally { if (oud === undefined) delete process.env.RTG_ENC_KEY; else process.env.RTG_ENC_KEY = oud; versGroep(); }
}
const mod = () => require('../server/kern/journaalbestand.js');
const regel = (i) => ({ t: '2026-10-14T00:00:00.000Z', richting: 'in', wat: '/api/x' + i, nr: i, mislukt: false });

/* console.warn opvangen: de melding IS het signaal, dus die wordt geteld. */
function vangWaarschuwingen(t) {
  const gemeld = [];
  t.mock.method(console, 'warn', (...a) => { gemeld.push(a.join(' ')); });
  return gemeld;
}

test('1. een verkeerde sleutel: elke regel wordt overgeslagen en geteld, niets wordt verzonnen', () => {
  const map = verseMap();
  metSleutel('a'.repeat(64), (m) => {
    const b = m.maakJournaalbestand({ dir: map });
    b.noteerRegel(regel(1)); b.noteerRegel(regel(2));
    assert.equal(b.spoelNu(), 2);
  });
  /* Een wachtzin in plaats van 64 hextekens: de kluis maakt er zelf een sleutel van, maar het is een ANDERE. */
  metSleutel('een heel andere wachtzin', (m) => {
    const b = m.maakJournaalbestand({ dir: map });
    assert.deepEqual(b.lees(10), [], 'met een andere sleutel is er niets te lezen');
    assert.equal(b.stand().overgeslagen, 2, 'en dat is geteld: twee regels die er wel staan maar niet te lezen zijn');
  });
  metSleutel(null, (m) => {
    const b = m.maakJournaalbestand({ dir: map });
    assert.deepEqual(b.lees(10), [], 'zonder sleutel wordt cijfertekst niet als tekst teruggegeven');
    assert.equal(b.stand().overgeslagen, 2);
  });
  metSleutel('a'.repeat(64), (m) => {
    assert.deepEqual(m.maakJournaalbestand({ dir: map }).lees(10).map(r => r.nr), [1, 2], 'met de goede sleutel is alles er nog');
  });
});

test('2. een omgezette bit in de cijfertekst: de authenticatie weigert, de andere regels blijven leesbaar', () => {
  const map = verseMap();
  metSleutel('c'.repeat(64), (m) => {
    const b = m.maakJournaalbestand({ dir: map });
    for (let i = 1; i <= 3; i++) b.noteerRegel(regel(i));
    b.spoelNu();
    const bestand = path.join(map, 'huidig.log');
    const regels = fs.readFileSync(bestand, 'utf8').split('\n');
    const kop = 'RTGENC1:';
    const ruw = Buffer.from(regels[1].slice(kop.length), 'base64');
    ruw[ruw.length - 1] ^= 1;                     // een bit in de versleutelde inhoud
    regels[1] = kop + ruw.toString('base64');
    fs.writeFileSync(bestand, regels.join('\n'));
    const lezer = m.maakJournaalbestand({ dir: map });
    assert.deepEqual(lezer.lees(10).map(r => r.nr), [1, 3], 'de geknoeide regel komt er niet uit -- ook niet als onzin');
    assert.equal(lezer.stand().overgeslagen, 1);
  });
});

test('2b. een regel die geen JSON is, of een ingevoegde leesbare regel tussen cijfertekst', () => {
  const map = verseMap();
  const b = mod().maakJournaalbestand({ dir: map });
  b.noteerRegel(regel(1)); b.spoelNu();
  fs.appendFileSync(path.join(map, 'huidig.log'), 'geen json\n\n{"nr":2}\n');
  const lezer = mod().maakJournaalbestand({ dir: map });
  assert.deepEqual(lezer.lees(10).map(r => r.nr), [1, 2], 'lege regels zijn geen regels; gave regels komen eruit');
  assert.equal(lezer.stand().overgeslagen, 1, 'alleen de onleesbare telt als overgeslagen');
});

test('3. een onschrijfbare map meldt EEN keer en zet het journaal dicht', (t) => {
  const gemeld = vangWaarschuwingen(t);
  const b = mod().maakJournaalbestand({ dir: '/dev/null/onmogelijk' });
  assert.equal(b.noteerRegel(regel(1)), true, 'voor de eerste fout neemt hij de regel aan');
  assert.equal(b.spoelNu(), 0, 'er is niets geschreven, en dat zegt hij ook');
  assert.equal(gemeld.length, 1);
  assert.match(gemeld[0], /wegschrijven mislukt/);
  assert.ok(b.stand().stuk, 'de stand draagt de reden');
  assert.equal(b.noteerRegel(regel(2)), false, 'daarna zegt hij nee in plaats van te doen alsof hij bewaart');
  assert.equal(b.stand().wachtend, 0, 'en er stapelt zich niets op in het geheugen');
  assert.equal(b.stand().geschreven, 0);
  b.spoelNu();
  assert.equal(gemeld.length, 1, 'een kapot journaal meldt een keer, niet bij elke regel');
});

test('3b. een regel die niet te serialiseren is, wordt gemeld en niet half weggeschreven', (t) => {
  const gemeld = vangWaarschuwingen(t);
  const map = verseMap();
  const b = mod().maakJournaalbestand({ dir: map });
  b.noteerRegel(regel(1));
  b.noteerRegel({ wat: 'kapot', groot: 10n });            // BigInt: JSON.stringify gooit
  assert.equal(b.spoelNu(), 0);
  assert.equal(fs.existsSync(path.join(map, 'huidig.log')), false, 'ook de gave regel uit dezelfde stapel staat niet half op schijf');
  assert.match(b.stand().stuk, /BigInt/);
  assert.equal(gemeld.length, 1);
});

test('3c. de asynchrone weg: een serialiseerfout en een schrijffout worden gemeld en laten niets hangen', async (t) => {
  const gemeld = vangWaarschuwingen(t);
  const a = mod().maakJournaalbestand({ dir: verseMap(), stapelMax: 1 });
  a.noteerRegel({ x: 1n });
  await wachtOpWaarde(() => a.stand().stuk, { wat: 'de serialiseerfout op de asynchrone weg' });
  assert.equal(a.stand().wachtend, 0);
  assert.equal(a.noteerRegel(regel(1)), false);

  /* Drie regels achter elkaar: de eerste start een schrijfactie, de andere twee
     komen binnen terwijl die nog loopt en gaan in de volgende ronde -- die ook
     faalt. Gemeld wordt er toch maar een keer. */
  const b = mod().maakJournaalbestand({ dir: '/dev/null/onmogelijk', stapelMax: 1 });
  b.noteerRegel(regel(1)); b.noteerRegel(regel(2)); b.noteerRegel(regel(3));
  await wachtOpWaarde(() => b.stand().stuk && b.stand().wachtend === 0, { wat: 'de schrijffout op de asynchrone weg' });
  assert.match(b.stand().stuk, /ENOTDIR|EEXIST|ENOENT/);
  assert.equal(b.stand().geschreven, 0, 'een mislukte schrijfactie telt niet als geschreven');
  assert.equal(gemeld.length, 2, 'elk journaal meldt zijn eigen fout, een keer');
});

test('4. een volle stapel spoelt meteen, en wat er tijdens het schrijven bijkomt volgt in een tweede ronde', async () => {
  const map = verseMap();
  const b = mod().maakJournaalbestand({ dir: map, stapelMax: 2, vensterMs: 60000 });
  b.noteerRegel(regel(1));
  assert.equal(b.stand().wachtend, 1, 'onder de grens wacht hij op het venster');
  b.noteerRegel(regel(2));                          // grens: spoel nu
  b.noteerRegel(regel(3));                          // komt binnen terwijl er geschreven wordt
  await wachtOpWaarde(() => b.stand().geschreven === 3, { wat: 'alle drie de regels op schijf' });
  assert.equal(b.stand().wachtend, 0);
  assert.deepEqual(mod().maakJournaalbestand({ dir: map }).lees(10).map(r => r.nr), [1, 2, 3], 'in volgorde, niets dubbel');
});

test('4b. de timer spoelt na het venster, en een tweede regel zet geen tweede timer', async () => {
  const map = verseMap();
  const b = mod().maakJournaalbestand({ dir: map, vensterMs: 5 });
  b.noteerRegel(regel(1)); b.noteerRegel(regel(2));
  assert.deepEqual(b.lees(10).map(r => r.nr), [1, 2], 'wat nog in de stapel staat is al te lezen');
  await wachtOpWaarde(() => b.stand().geschreven === 2, { wat: 'de timer heeft gespoeld' });
  assert.equal(fs.readFileSync(path.join(map, 'huidig.log'), 'utf8').trim().split('\n').length, 2, 'een schrijfactie, twee regels');
  assert.equal(b.spoelNu(), 0, 'een lege stapel spoelen is niets');
});

test('5. rotatie met een klok die terugloopt overschrijft nooit een bestaand bestand', () => {
  const map = verseMap();
  let tijd = 1700000000000;
  const b = mod().maakJournaalbestand({ dir: map, maxBytes: 10, maxBestanden: 10, nu: () => tijd });
  for (let i = 1; i <= 4; i++) {
    b.noteerRegel(regel(i)); b.spoelNu();
    tijd -= 1000;                                    // de klok loopt terug
  }
  const namen = fs.readdirSync(map).filter(n => n !== 'huidig.log').sort();
  assert.equal(namen.length, 4, 'vier rotaties, vier bestanden');
  assert.ok(namen.every(n => /^\d{13}\.log$/.test(n)));
  assert.deepEqual(mod().maakJournaalbestand({ dir: map }).lees(10).map(r => r.nr), [1, 2, 3, 4],
    'niets overschreven en de volgorde klopt nog, ook al liep de klok terug');
});

test('5b. een bestand dat er al staat onder de verse naam wordt overgeslagen, niet overschreven', () => {
  const map = verseMap();
  const tijd = 1700000000000;
  fs.writeFileSync(path.join(map, tijd + '.log'), JSON.stringify({ nr: 'oud' }) + '\n');
  const b = mod().maakJournaalbestand({ dir: map, maxBytes: 10, maxBestanden: 10, nu: () => tijd });
  b.noteerRegel(regel(1)); b.spoelNu();
  assert.equal(fs.readFileSync(path.join(map, tijd + '.log'), 'utf8').trim(), '{"nr":"oud"}', 'het bestaande bestand is ongemoeid');
  assert.ok(fs.existsSync(path.join(map, (tijd + 1) + '.log')), 'het nieuwe kreeg de volgende naam');
});

test('5c. de schijf blijft begrensd, en lezen stopt zodra er genoeg is', () => {
  const map = verseMap();
  let tijd = 1700000000000;
  const b = mod().maakJournaalbestand({ dir: map, maxBytes: 10, maxBestanden: 2, nu: () => tijd++ });
  for (let i = 1; i <= 6; i++) { b.noteerRegel(regel(i)); b.spoelNu(); }
  assert.equal(fs.readdirSync(map).filter(n => n !== 'huidig.log').length, 2, 'nooit meer dan de afgesproken bestanden');
  const lezer = mod().maakJournaalbestand({ dir: map });
  assert.deepEqual(lezer.lees(1).map(r => r.nr), [6], 'de nieuwste');
  assert.deepEqual(lezer.lees(0).map(r => r.nr), [5, 6], 'een onzinnige grens valt terug op de standaard, en het oudste is weg');
  assert.equal(b.maxBytes, 10); assert.equal(b.maxBestanden, 2);
});

test('5d. een rotatie die niet kan hernoemen wordt gemeld; het actieve bestand blijft staan', (t) => {
  const gemeld = vangWaarschuwingen(t);
  const map = verseMap();
  const b = mod().maakJournaalbestand({ dir: map, maxBytes: 10, nu: () => 1700000000000 });
  t.mock.method(fs, 'renameSync', () => { throw new Error('EACCES: hernoemen geweigerd'); });
  b.noteerRegel(regel(1));
  assert.equal(b.spoelNu(), 1, 'de regel is geschreven');
  assert.match(b.stand().stuk, /hernoemen geweigerd/, 'en de mislukte rotatie is gemeld');
  assert.equal(gemeld.length, 1);
  assert.deepEqual(mod().maakJournaalbestand({ dir: map }).lees(10).map(r => r.nr), [1]);
});

test('5d2. een rotatie die een oud bestand niet kan opruimen, of een fout zonder melding, laat het journaal niet vallen', (t) => {
  const gemeld = vangWaarschuwingen(t);
  const map = verseMap();
  let tijd = 1700000000000;
  const b = mod().maakJournaalbestand({ dir: map, maxBytes: 10, maxBestanden: 1, nu: () => tijd++ });
  const unlink = t.mock.method(fs, 'unlinkSync', () => { throw new Error('EBUSY'); });
  for (let i = 1; i <= 3; i++) { b.noteerRegel(regel(i)); assert.equal(b.spoelNu(), 1); }
  assert.ok(unlink.mock.callCount() >= 1, 'opruimen is geprobeerd');
  assert.equal(b.stand().stuk, null, 'een bestand dat niet weg kan is geen schrijffout: het journaal blijft open');
  unlink.mock.restore();
  /* Een rotatie die iets anders dan een Error gooit, wordt toch leesbaar gemeld. */
  t.mock.method(fs, 'renameSync', () => { throw 'geen Error-object'; });   // eslint-disable-line no-throw-literal
  b.noteerRegel(regel(4)); b.spoelNu();
  assert.equal(b.stand().stuk, 'geen Error-object');
  assert.equal(gemeld.length, 1);
});

test('5d3. lezen uit een map die (nog) niet bestaat geeft niets, en telt nul', () => {
  const b = mod().maakJournaalbestand({ dir: path.join(verseMap(), 'nooit-aangemaakt') });
  assert.deepEqual(b.lees(10), []);
  assert.equal(b.aantal(), 0);
  assert.equal(b.stand().overgeslagen, 0, 'een ontbrekend bestand is geen verminkte regel');
});

test('5e. de telling wordt kort vastgehouden en daarna opnieuw gerekend', () => {
  const map = verseMap();
  let tijd = 1700000000000;
  const b = mod().maakJournaalbestand({ dir: map, nu: () => tijd });
  assert.equal(b.aantal(), 0, 'een lege map telt nul');
  b.noteerRegel(regel(1)); b.spoelNu();
  assert.equal(b.aantal(), 0, 'binnen tien seconden geldt de vastgehouden telling');
  tijd += 10001;
  assert.equal(b.aantal(), 1, 'daarna wordt er opnieuw geteld');
});

test('5f. binnen het cachevenster tellen de nog niet gespoelde regels wel mee', () => {
  /* De gecachte tak telde `stapel.length` -- de lengte van de FUNCTIE (nul) en
     niet die van de stapel. Een regel die nog in het geheugen stond, viel dan
     tien seconden lang uit de telling. */
  let tijd = 1700000000000;
  const b = mod().maakJournaalbestand({ dir: verseMap(), nu: () => tijd });
  assert.equal(b.aantal(), 0, 'de telling wordt vastgehouden');
  b.noteerRegel(regel(1));
  b.noteerRegel(regel(2));
  assert.equal(b.aantal(), 2, 'twee regels in de stapel tellen mee, ook binnen het venster');
  b.spoelNu();
  tijd += 10001;
  assert.equal(b.aantal(), 2, 'en na het spoelen telt het bestand ze, niet dubbel');
});

test('6. het standaardjournaal schrijft in de datamap, en spoelAlle() schrijft bij het afsluiten weg', (t) => {
  /* De datamap komt uit de opslaglaag (server/db). Die hele laag laden voor een
     pad is hier niet nodig: een kale module met alleen DATA_DIR op de plek van
     server/db/index.js is precies wat standaard() leest. */
  const map = verseMap();
  const dbPad = require.resolve('../server/db');
  const oud = require.cache[dbPad];
  require.cache[dbPad] = { id: dbPad, filename: dbPad, loaded: true, exports: { DATA_DIR: map } };
  t.after(() => { if (oud) require.cache[dbPad] = oud; else delete require.cache[dbPad]; });
  const m = mod();
  const b = m.standaard();
  b.noteerRegel(regel(1)); b.noteerRegel(regel(2));
  assert.equal(m.spoelAlle(), 2, 'alles wat in de stapel stond is geschreven');
  assert.equal(b.stand().wachtend, 0);
  assert.equal(b.stand().map, path.join(map, 'journaal'));
  assert.equal(fs.statSync(path.join(map, 'journaal')).mode & 0o777, 0o700, 'de journaalmap is besloten');
  assert.deepEqual(m.maakJournaalbestand({ dir: path.join(map, 'journaal') }).lees(10).map(r => r.nr), [1, 2]);
  assert.equal(m.spoelAlle(), 0, 'een tweede keer is er niets meer');
});
