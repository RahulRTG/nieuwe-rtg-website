/* saveDuurzaam() -- de zware primitive, en de poort die hem schaars houdt.

   WAT HIER OP HET SPEL STAAT, en het is niet de techniek. Deze functie schrijft
   synchroon met een fsync eronder en keert pas terug als de opslag het heeft
   bevestigd. Dat kost latentie. De fout die zoiets altijd maakt is niet dat hij
   niet werkt, maar dat hij POPULAIR wordt: iemand leest hem als "de veilige
   save", zet hem onder een profielwijziging, en het prestatieprofiel van het
   platform is veranderd zonder dat er ooit een beslissing over is genomen.

   Dus twee soorten toets. Dat hij bevestigt wat hij belooft, en dat de poort
   die hem schaars houdt ook werkelijk dichtgaat.

   HIJ IS NOG NERGENS AANGESLOTEN. De geldcommit eraan hangen is stap 2 van de
   volgorde in GELDLAT.md, en die hoort pas na een gemeten prestatievergelijking.
   Deze toets bewijst dus de primitive, niet de geldketen.

   Draai los: node --experimental-sqlite --test test/saveduurzaam.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const WORTEL = path.join(__dirname, '..');
const inProces = (env, code) => execFileSync(process.execPath, ['--experimental-sqlite', '-e', code],
  { encoding: 'utf8', env: { ...process.env, ...env }, cwd: WORTEL }).trim().split('\n').pop();
const verseMap = () => fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-sd-'));

/* ---------- de primitive ---------- */

test('een duurzame schrijfactie wordt BEVESTIGD, met de stand erbij', () => {
  const uit = JSON.parse(inProces({ RTG_DATA_DIR: verseMap() },
    "const db=require('./server/db');(async()=>{await db.load();" +
    "db.db.data.proef={t:1};console.log(JSON.stringify(db.saveDuurzaam()))})()"));
  assert.equal(uit.duurzaam, true);
  assert.equal(typeof uit.stand, 'number');
  assert.equal(uit.reden, null);
});

test('hij haalt de write-behind NIET in: de stand is al opgelopen bij terugkeer', () => {
  /* Dit is het hele verschil met save(). Die plant een schrijfactie en keert
     meteen terug -- op dat moment staat de teller nog stil, en precies daarop
     liep de eerste reparatiepoging van de geldroute vast. */
  const uit = JSON.parse(inProces({ RTG_DATA_DIR: verseMap() },
    "const db=require('./server/db');(async()=>{await db.load();" +
    "db.db.data.a={t:1};const voorGewoon=db.persistentieStand();db.save();" +
    "const naGewoon=db.persistentieStand();" +
    "db.db.data.b={t:2};const voorZwaar=db.persistentieStand();db.saveDuurzaam();" +
    "const naZwaar=db.persistentieStand();" +
    "console.log(JSON.stringify({gewoon:naGewoon>voorGewoon, zwaar:naZwaar>voorZwaar}))})()"));
  assert.equal(uit.zwaar, true, 'saveDuurzaam hoort bij terugkeer al te zijn weggeschreven');
});

test('onder schrijf-verloren bevestigt hij NIET, en zegt waarom', () => {
  /* De opslag liegt: save() doet niets. Dan hoort deze functie geen duurzaamheid
     te beloven -- dat is de enige reden dat hij een uitkomst teruggeeft in plaats
     van niets. */
  const uit = JSON.parse(inProces({ RTG_DATA_DIR: verseMap(), RTG_VERRAAD: 'schrijf-verloren' },
    "const db=require('./server/db');(async()=>{await db.load();" +
    "db.db.data.proef={t:1};console.log(JSON.stringify(db.saveDuurzaam()))})()"));
  assert.equal(uit.duurzaam, false);
  assert.match(uit.reden, /bevestigde de schrijfactie niet|liep niet op|kan duurzaamheid niet bevestigen/);
});

test('op een opslag die niet kan tellen is duurzaam FALSE en niet stilzwijgend true', () => {
  const uit = JSON.parse(inProces({ RTG_DATA_DIR: verseMap(), RTG_STORE: 'geheugen' },
    "const db=require('./server/db');(async()=>{await db.load();" +
    "db.db.data.proef={t:1};console.log(JSON.stringify(db.saveDuurzaam()))})()"));
  assert.equal(uit.duurzaam, false);
  assert.equal(uit.stand, null);
  assert.match(uit.reden, /kan duurzaamheid niet bevestigen/);
});

/* ---------- de poort die hem schaars houdt ---------- */

test('de huisregels kennen een regel die saveDuurzaam bewaakt', () => {
  const bron = fs.readFileSync(path.join(WORTEL, 'scripts', 'check.js'), 'utf8');
  assert.match(bron, /47\)\s*saveDuurzaam/,
    'zonder poort is "alleen waar het moet" een afspraak en geen regel');
  assert.match(bron, /TOEGESTAAN/);
});

/* WAT HIER NOG NIET AUTOMATISCH IS, en dat hoort er te staan.

   Dat de poort ook werkelijk DICHTGAAT is met de hand nagetrokken: een bestand
   scripts/__smokkel-saveduurzaam.js met een aanroep erin laat `npm run check`
   zakken met exitcode 1 en de melding

     saveDuurzaam() staat op een plek die er niet op de lijst staat:
     scripts/__smokkel-saveduurzaam.js

   Een toets die dat vanzelf doet, moet check.js in een subproces draaien en zijn
   uitvoer nalezen; die kreeg de uitvoer in deze omgeving niet betrouwbaar te
   pakken en stond daardoor rood zonder dat de poort iets mankeerde. Een rode
   toets die niets aanwijst is erger dan geen toets, en een groene die niets
   meet nog erger. Dus staat het hier als handmatig nagetrokken -- met het
   commando erbij, zodat de volgende het in tien seconden herhaalt:

     printf 'module.exports=(db)=>db.saveDuurzaam();' > scripts/__smokkel-saveduurzaam.js
     node scripts/check.js ; echo "exit=$?" ; rm scripts/__smokkel-saveduurzaam.js

   Dit is precies het geval waarvoor TOEZICHT.md de bewijssoort apart noemt:
   `gate closure  HANDMATIG NAGETROKKEN` en niet stilzwijgend PROVEN. */

/* ---------- sterf-na-commit: het gemeenste moment ----------

   De schrijfactie is duurzaam en de aanroeper heeft nog niets gehoord. Dat is
   het venster waarin de klant niet weet dat het gelukt is en het opnieuw
   probeert -- en waar durability en idempotentie samenkomen (zie GELDLAT.md).

   Deze twee toetsen bewijzen het INJECTIEPUNT, niet de geldketen. Dat de
   herhaling daarna exact één economische mutatie oplevert, is scenario 3 en
   staat nog open: de geldcommit hangt nog niet aan saveDuurzaam. */

test('sterf-na-commit doodt het proces NA de duurzame schrijfactie', () => {
  const map = verseMap();
  let gestorven = false;
  try {
    execFileSync(process.execPath, ['--experimental-sqlite', '-e',
      "const db=require('./server/db');(async()=>{await db.load();" +
      "db.db.data.overleefdit={t:1};db.saveDuurzaam();" +
      "console.log('DIT MAG NIET GEBEUREN')})()"],
      { encoding: 'utf8', cwd: WORTEL,
        env: { ...process.env, RTG_DATA_DIR: map, RTG_VERRAAD: 'sterf-na-commit' } });
  } catch (e) { gestorven = true; }
  assert.equal(gestorven, true, 'het proces hoort niet meer terug te keren uit saveDuurzaam');

  /* EN DIT IS DE HELFT DIE ERTOE DOET: het proces is dood, maar de schrijfactie
     was al duurzaam. Zou de data weg zijn, dan bootste dit verraad een crash
     VOOR de commit na, en dan gaat scenario 3 over iets anders. */
  const terug = inProces({ RTG_DATA_DIR: map },
    "const db=require('./server/db');(async()=>{await db.load();" +
    "console.log(JSON.stringify(!!(db.db.data.overleefdit)))})()");
  assert.equal(terug, 'true', 'de duurzame schrijfactie hoort de crash te overleven');
});

test('zonder dat verraad keert saveDuurzaam gewoon terug', () => {
  const uit = inProces({ RTG_DATA_DIR: verseMap() },
    "const db=require('./server/db');(async()=>{await db.load();" +
    "db.db.data.p={t:1};db.saveDuurzaam();console.log('teruggekeerd')})()");
  assert.equal(uit, 'teruggekeerd');
});

/* ---------- de duurzame bundel ----------

   bijeen({ duurzaam: true }) maakt van de gebundelde commit -- boeking én
   idem-sleutel samen -- een duurzame. Dat is de vorm die de geldketen nodig
   heeft: één bundel, één duurzame commit, geen moment waarop de een vaststaat
   en de ander niet.

   DE GELDLAAG IS ER NOG NIET OP AANGESLOTEN, en dat is geen vergeetachtigheid.
   De bedrading is geprobeerd en de geldtoetsen bleven groen, maar de ketenronde
   liet zien dat de uitkomst NIET veranderde: onder `schrijf-verloren` kwam er
   nog steeds een 200 uit. Waarom de worp uit de bundel de route niet bereikt,
   is niet nagetrokken -- en een geldpad bedraden waarvan je niet kunt aantonen
   dat het iets doet, is de valse zekerheid waar deze hele reeks over gaat.
   Dus: de bundel is bewezen, de aansluiting staat open. Zie GELDLAT.md. */

test('een duurzame bundel gooit als de commit niet bevestigd kon worden', () => {
  /* Zonder deze worp meldt saveDuurzaam netjes dat het misging en gaat de
     aanroeper toch verder -- precies de valse bevestiging die de ketenronde
     vond. */
  let gegooid = null;
  try {
    inProces({ RTG_DATA_DIR: verseMap(), RTG_VERRAAD: 'schrijf-verloren' },
      "const db=require('./server/db');(async()=>{await db.load();" +
      "await db.bijeen(async()=>{db.db.data.p={t:1};db.save()},{duurzaam:true});" +
      "console.log('TERUGGEKEERD')})()");
  } catch (e) { gegooid = String(e.stderr || e.message); }
  assert.ok(gegooid, 'een onbevestigde duurzame bundel hoort te gooien');
  assert.match(gegooid, /niet vastgelegd/);
});

test('een gewone bundel gooit NIET onder datzelfde verraad', () => {
  /* De duurzame stand is een keuze per bundel en geen nieuw platformgedrag.
     Zou dit ook gooien, dan was save() stilletjes streng geworden. */
  const uit = inProces({ RTG_DATA_DIR: verseMap(), RTG_VERRAAD: 'schrijf-verloren' },
    "const db=require('./server/db');(async()=>{await db.load();" +
    "await db.bijeen(async()=>{db.db.data.p={t:1};db.save()});" +
    "console.log('teruggekeerd')})()");
  assert.equal(uit, 'teruggekeerd');
});

test('een duurzame bundel komt gewoon door zonder verraad', () => {
  const uit = inProces({ RTG_DATA_DIR: verseMap() },
    "const db=require('./server/db');(async()=>{await db.load();" +
    "await db.bijeen(async()=>{db.db.data.p={t:1};db.save()},{duurzaam:true});" +
    "console.log('teruggekeerd')})()");
  assert.equal(uit, 'teruggekeerd');
});

test('bevestigbaar en duurzaam zijn twee verschillende dingen', () => {
  /* Een opslag die niet kan tellen mag geen transactie laten mislukken -- dat
     brak eerder vier geldtoetsen -- maar mag evenmin doorgaan voor bewijs. */
  const uit = JSON.parse(inProces({ RTG_DATA_DIR: verseMap(), RTG_STORE: 'geheugen' },
    "const db=require('./server/db');(async()=>{await db.load();" +
    "db.db.data.p={t:1};console.log(JSON.stringify(db.saveDuurzaam()))})()"));
  assert.equal(uit.bevestigbaar, false);
  assert.equal(uit.duurzaam, false);
});
