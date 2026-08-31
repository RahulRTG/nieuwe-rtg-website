/* DE INTELLIGENTIEROUTER (server/kern/ai/router.js, EXECUTIE.md blok 8).

   De huisregel is: kan het met een regel, dan een regel; pas als er taal,
   dubbelzinnigheid of redenering nodig is, komt een model. AI is de laatste
   passende techniek, niet de eerste.

   VANDAAG STAAT DIE VOLGORDE OMGEKEERD in kern/ai.js: is er een sleutel, dan
   antwoordt het model altijd, en het regelantwoord vangt alleen een storing op.
   Deze router draait daarom in de SCHADUW -- hij meet welke techniek erbij zou
   horen en beslist niets. Dat is een besluit van de eigenaar en geen halfheid:
   de volgorde omdraaien betekent dat een matig regelantwoord een goed
   modelantwoord kan verdringen, en dat merkt niemand omdat er gewoon een
   antwoord komt.

   DRIE EISEN, en de derde is de scherpste:
     1 hij BESLIST NIETS -- geen modelaanroep, geen weg naar een effect;
     2 elke motor waar hij naar wijst BESTAAT, en zijn ingang laadt echt;
     3 een techniek die hier NIET bestaat wordt met de reden genoemd en nooit
       stilzwijgend overgeslagen -- dat is de fout van de cap `rooms`, die een
       document noemde en die nergens bestond. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const router = require('../server/kern/ai/router');

const WORTEL = path.join(__dirname, '..');
const RUW = fs.readFileSync(path.join(WORTEL, 'server/kern/ai/router.js'), 'utf8');
const BRON = RUW.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

test('1. HIJ BESLIST NIETS: geen modelaanroep en geen weg naar een effect', () => {
  for (const verboden of [/messages\.create/, /\bfetch\s*\(/, /anthropic/i, /child_process/])
    assert.ok(!verboden.test(BRON), 'router.js bevat ' + verboden + ' -- dan beslist hij in plaats van te meten');
});

test('2. ELKE MOTOR BESTAAT: het bestand laadt en de ingang zit erin', () => {
  for (const m of router.MOTOREN) {
    const p = path.join(WORTEL, 'server', m.bestand);
    assert.ok(fs.existsSync(p), 'motor wijst naar een bestand dat niet bestaat: ' + m.bestand);
    const mod = require(p);
    if (m.ingang) assert.equal(typeof mod[m.ingang], 'function',
      m.bestand + ' heeft geen ingang ' + m.ingang + ' -- de router wijst naar een naam die er niet is');
    assert.ok(m.wat && m.wat.length > 15, m.bestand + ' legt niet uit wat hij doet');
    assert.ok(router.TECHNIEKEN.includes(m.techniek), m.bestand + ' draagt een onbekende techniek: ' + m.techniek);
  }
});

test('3. EEN ONTBREKENDE TECHNIEK WORDT GENOEMD, met de reden', () => {
  assert.ok(router.ONTBREEKT.length > 0,
    'nul ontbrekende technieken zou betekenen dat dit huis een constraint solver heeft; die is er niet');
  for (const o of router.ONTBREEKT) {
    assert.ok(router.TECHNIEKEN.includes(o.techniek), 'onbekende techniek in ONTBREEKT: ' + o.techniek);
    assert.ok(o.reden && o.reden.length > 40, o.techniek + ' ontbreekt zonder uitgeschreven reden');
    assert.equal(router.MOTOREN.filter(m => m.techniek === o.techniek).length, 0,
      o.techniek + ' staat in ONTBREEKT terwijl er wel een motor voor is');
  }
});

test('4. een vraag voor een ontbrekende techniek valt terug op het model MET de reden', () => {
  const r = router.kies('maak volgende week een beter rooster');
  assert.equal(r.techniek, 'ai', 'de router wijst naar een optimizer die niet bestaat');
  assert.equal(r.gevraagd, 'optimalisatie');
  assert.match(r.reden, /bestaat hier niet|constraint solver/i);
  assert.equal(r.goedkoperMogelijk, false);
});

test('5. de goedkopere technieken worden herkend en wijzen naar hun motor', () => {
  const gevallen = [['wat kost de RTG Pass', 'regels'], ['hoeveel btw moet ik afdragen', 'algoritme'],
    ['wanneer ga ik weer op reis', 'voorspelling']];
  for (const [vraag, verwacht] of gevallen) {
    const r = router.kies(vraag);
    assert.equal(r.techniek, verwacht, '"' + vraag + '" werd ' + r.techniek + ' in plaats van ' + verwacht);
    assert.ok(r.motor, verwacht + ' zonder motor');
    assert.ok(router.MOTOREN.some(m => m.bestand === r.motor), 'de motor staat niet in het register');
  }
});

test('6. een vraag die taal vraagt, gaat naar het model -- en dat is geen gebrek', () => {
  const r = router.kies('schrijf een korte tekst over de zee voor mijn website');
  assert.equal(r.techniek, 'ai');
  assert.match(r.reden, /taal of redenering/i);
});

test('7. ELKE UITSLAG draagt een techniek en een reden, ook bij rare invoer', () => {
  for (const v of ['', null, undefined, 42, {}, 'x'.repeat(5000)]) {
    const r = router.kies(v);
    assert.ok(router.TECHNIEKEN.includes(r.techniek), 'onbekende techniek bij ' + JSON.stringify(v));
    assert.ok(r.reden && r.reden.length > 20, 'uitslag zonder reden bij ' + JSON.stringify(v));
  }
});

test('8. de volgorde is de regel: het goedkoopste spoor wint van het duurdere', () => {
  assert.deepEqual(router.TECHNIEKEN, ['regels', 'algoritme', 'optimalisatie', 'voorspelling', 'ai']);
  /* Een zin met een regel-spoor EN een voorspel-spoor hoort bij de regel uit te
     komen: eerder in de lijst is goedkoper en zekerder. */
  const r = router.kies('wat kost de pas, en wanneer ga ik weer op reis');
  assert.equal(r.techniek, 'regels');
});

test('9. de stand telt en zegt erbij wat hij NIET is', () => {
  const voor = router.stand().totaal;
  router.schaduw('wat kost de RTG Pass');
  const na = router.stand();
  assert.equal(na.totaal, voor + 1, 'de teller loopt niet');
  assert.match(na.grens, /BESLIST NIETS/);
  assert.match(na.grens, /herstart/, 'de uitslag verzwijgt dat de tellers in dit proces leven');
});

test('10. de chat draagt de keuze mee, zodat achteraf narekenbaar is waarom er een model kwam', () => {
  const bron = fs.readFileSync(path.join(WORTEL, 'server/kern/ai.js'), 'utf8');
  assert.match(bron, /router\.schaduw\(/, 'kern/ai.js raadpleegt de router niet');
  assert.match(bron, /techniek: 'ai'/, 'het modelantwoord draagt zijn techniek niet');
  assert.match(bron, /techniek: 'regels'/, 'het regelantwoord draagt zijn techniek niet');
});
