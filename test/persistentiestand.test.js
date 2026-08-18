/* DE PERSISTENTIESTAND (server/db/persistentieStand) -- het enige getal waarmee
   een aanroeper kan vaststellen dat zijn schrijfactie de SCHIJF heeft gehaald.

   WAAROM DIT ER LOS STAAT, en waarom de geldroute hem nog NIET gebruikt.

   De ketenronde vond dat een oplading met 200 wordt bevestigd terwijl het geld
   na een herstart weg is. De voor de hand liggende reparatie -- pas bevestigen
   als de boeking is weggeschreven -- vraagt een manier om dat vast te stellen,
   en teruglezen kan dat niet: dat leest het geheugen, en daar staat de boeking.
   Deze teller leeft er wel buiten.

   MAAR OBSERVEREN IS NIET GENOEG, en dat is met een echte proef vastgesteld en
   niet beredeneerd. Een eerste versie van de reparatie liet de geldroute wachten
   tot deze teller was opgelopen. Vier geldtoetsen zakten meteen met 503: de
   opslag is WRITE-BEHIND, dus op het moment dat de route antwoordt is de
   schrijfactie nog niet eens geprobeerd. De teller staat dan terecht stil.

   De echte reparatie is dus niet "kijken of het is weggeschreven" maar "een
   duurzame schrijfactie AFDWINGEN en daarop wachten", en dat raakt de
   prestatiekenmerken van de hele geldlaag. Die stap is bewust niet in deze
   sessie genomen; wat hier staat is het meetpunt dat ervoor nodig is, mét het
   bewijs dat het meetpunt werkt.

   Draai los: node --test test/persistentiestand.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const WORTEL = path.join(__dirname, '..');
const inProces = (env, code) => execFileSync(process.execPath, ['-e', code],
  { encoding: 'utf8', env: { ...process.env, ...env }, cwd: WORTEL }).trim().split('\n').pop();
const verseMap = () => fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-pstand-'));

test('de stand loopt op na een echte schrijfactie', () => {
  const uit = inProces({ RTG_DATA_DIR: verseMap() },
    "const db=require('./server/db');(async()=>{await db.load();" +
    "const a=db.persistentieStand();db.db.data.proef={t:1};db.save();" +
    "const b=db.persistentieStand();console.log(JSON.stringify([typeof a,b>a]))})()");
  assert.deepEqual(JSON.parse(uit), ['number', true]);
});

test('de stand komt uit de DATABASE en niet uit het geheugen', () => {
  /* Zou hij uit het geheugen komen, dan loopt hij ook op als er niets is
     weggeschreven -- en dan bevestigt hij precies de leugen die hij moest
     ontmaskeren. Met het verraad `schrijf-verloren` doet save() niets, dus de
     stand hoort STIL te staan terwijl het geheugen wel verandert. */
  const uit = inProces({ RTG_DATA_DIR: verseMap(), RTG_VERRAAD: 'schrijf-verloren' },
    "const db=require('./server/db');(async()=>{await db.load();" +
    "const a=db.persistentieStand();db.db.data.proef={t:1};db.save();" +
    "const b=db.persistentieStand();console.log(JSON.stringify([b===a, db.db.data.proef.t===1]))})()");
  assert.deepEqual(JSON.parse(uit), [true, true],
    'de teller staat stil terwijl het geheugen wel is gewijzigd -- dat is het hele punt');
});

test('zonder een opslag die tellen kan, is de stand null en niet nul', () => {
  /* null betekent NIET VAST TE STELLEN. Zou hier 0 staan, dan leest een
     aanroeper "er is niets weggeschreven" waar "ik kan het niet zien" hoort. */
  const uit = inProces({ RTG_DATA_DIR: verseMap(), RTG_STORE: 'geheugen' },
    "const db=require('./server/db');(async()=>{await db.load();" +
    "console.log(JSON.stringify(db.persistentieStand()))})()");
  assert.equal(uit, 'null');
});
