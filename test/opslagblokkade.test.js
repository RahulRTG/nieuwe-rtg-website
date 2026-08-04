/* ============================================================================
   DE OPSLAGBLOKKADE: START DEZE PRODUCTIESTAND WEL OP EEN GROOTBOEK?

   WAAROM DEZE TOETS ER IS

   TAKEN 4.7 zegt dat de json- en geheugenstand geen transactiegrootboek hebben,
   en dat dat "klaar" is zodra die standen in productie geblokkeerd zijn --
   "dat laatste doet server/config/productie-opslag.js al".

   Dat wist ik uit de CODE, niet uit een draaiend systeem. De blokkade stond er,
   en er was geen enkele toets op. Precies het patroon waar dit huis zich al een
   paar keer op heeft gebrand: een handhaver waarvan iedereen aanneemt dat hij
   handhaaft.

   WAT ER OP HET SPEL STAAT. Zonder rij-voor-rij grootboek is er maar een
   vangnet voor een collectie die haar grens raakt: de staart gaat naar archief/
   en dan wordt er gekapt. Er is geen index, geen paginering, en herstel is
   handwerk met een jsonl-bestand. Voor betalingen en boekingen is dat te mager.

   EN HET GEVAL DAT DE KOP VAN productie-opslag.js ZELF "STIL" NOEMT is het
   scherpst: een installatie die ooit met een db.json is begonnen en waar
   DATABASE_URL later wegvalt. Dan kiest de opslag de json-stand -- niet omdat
   iemand dat besloot, maar omdat dat bestand er nog ligt. Dat hoort de start te
   blokkeren, en die tak ligt hier vast.

   Draai los: node --experimental-sqlite --test test/opslagblokkade.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const keuze = require('../server/db/keuze');
const { keurOpslag, bestaatDbJson } = require('../server/config/productie-opslag');

/* De keuring roept keurOpslag(env, fouten, waarschuwingen) aan en vult die twee
   lijsten. Een FOUT blokkeert de start; een waarschuwing niet. Dat onderscheid
   is de hele toets: een waarschuwing die je kunt negeren beschermt niemand. */
function keur(env) {
  const fouten = [], waarschuwingen = [];
  const store = keurOpslag(env || {}, fouten, waarschuwingen);
  return { store, fouten, waarschuwingen };
}

/* Een tijdelijke datamap met (of zonder) db.json, zodat de keuze op schijf
   berust en niet op een aanname. */
function metDataMap(metJson, doe) {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-opslag-'));
  try {
    if (metJson) fs.writeFileSync(path.join(map, 'db.json'), '{}');
    return doe(map);
  } finally { try { fs.rmSync(map, { recursive: true, force: true }); } catch (e) {} }
}

test('zonder grootboek gaat de start NIET door: json en geheugen worden geblokkeerd', () => {
  for (const store of ['json', 'geheugen']) {
    const r = keur({ RTG_STORE: store });
    assert.equal(r.store, store, 'de stand is ' + store);
    assert.ok(r.fouten.length >= 1,
      'de stand "' + store + '" blokkeert de start (fouten: ' + JSON.stringify(r.fouten) + ')');
    assert.match(r.fouten.join(' '), /grootboek/i, 'en zegt waarom: het grootboek ontbreekt');
    /* Een WAARSCHUWING zou hier het gevaar zijn: die kun je negeren, en dan
       draait er alsnog een betaalsysteem zonder grootboek. */
    assert.equal(r.waarschuwingen.length, 0,
      'het is een fout en geen waarschuwing (' + JSON.stringify(r.waarschuwingen) + ')');
  }
});

test('met grootboek mag het wel: postgres zonder klacht, sqlite met een aanbeveling', () => {
  const pg = keur({ DATABASE_URL: 'postgres://x/y' });
  assert.equal(pg.store, 'postgres', 'een DATABASE_URL kiest postgres');
  assert.deepEqual(pg.fouten, [], 'en blokkeert niets: ' + JSON.stringify(pg.fouten));
  assert.deepEqual(pg.waarschuwingen, [], 'zonder waarschuwing');

  /* Sqlite mag, maar deelt niet tussen instances. Dat is een aanbeveling en
     geen blokkade -- een enkele bak met sqlite is een geldige productiestand.
     Zonder deze helft zou de vorige toets ook slagen als ALLES geblokkeerd
     werd, en dan is de keuring een muur in plaats van een poort. */
  const lite = keur({ RTG_STORE: 'sqlite' });
  assert.deepEqual(lite.fouten, [], 'sqlite blokkeert niet: ' + JSON.stringify(lite.fouten));
  assert.equal(lite.waarschuwingen.length, 1, 'maar krijgt wel een aanbeveling');
  assert.match(lite.waarschuwingen[0], /DATABASE_URL/, 'over PostgreSQL voor meerdere instances');
});

test('het sqlite-grootboek uitzetten blokkeert ook, en de melding wijst de schakelaar aan', () => {
  /* TX_LEDGER_SQLITE=0 is de enige manier om sqlite zonder grootboek te
     draaien. Dat is een bewuste schakelaar, en juist daarom moet de keuring hem
     zien: wie hem ooit voor een proef omzette, hoort hem niet stilzwijgend in
     productie mee te nemen. */
  const r = keur({ RTG_STORE: 'sqlite', TX_LEDGER_SQLITE: '0' });
  assert.ok(r.fouten.length >= 1, 'sqlite zonder grootboek blokkeert: ' + JSON.stringify(r.fouten));
  assert.match(r.fouten.join(' '), /TX_LEDGER_SQLITE/,
    'en de melding noemt de schakelaar die het veroorzaakt: ' + r.fouten.join(' '));
});

test('de stille tak: een achtergebleven db.json zonder DATABASE_URL blokkeert de start', () => {
  /* Dit is het geval dat de kop van productie-opslag.js zelf als het gevaarlijkst
     aanwijst, en het is ook de reden dat de oude keuring niet deugde: die keek
     naar `!DATABASE_URL && RTG_STORE !== 'sqlite'` en wees daarmee een VERSE
     installatie aan (die krijgt sqlite en heeft dus wel een grootboek) terwijl
     hij een bestaande installatie met een achtergebleven db.json liet lopen.

     Precies andersom dus. Deze toets legt de goede kant vast. */
  metDataMap(true, (map) => {
    const env = { RTG_DATA_DIR: map };
    assert.equal(bestaatDbJson(env), true, 'er ligt een db.json in de datamap');
    assert.equal(keuze.kiesStore(env, true), 'json', 'en dan kiest de opslag de json-stand');

    const r = keur(env);
    assert.equal(r.store, 'json', 'de keuring ziet dezelfde stand als de opslag');
    assert.ok(r.fouten.length >= 1, 'en blokkeert de start: ' + JSON.stringify(r.fouten));
  });

  /* En de andere kant: een VERSE installatie zonder db.json krijgt sqlite en
     mag gewoon starten. Zonder deze helft zou de blokkade een verse installatie
     tegenhouden, en dat was nu juist de oude fout. */
  metDataMap(false, (map) => {
    const env = { RTG_DATA_DIR: map };
    assert.equal(bestaatDbJson(env), false, 'er ligt geen db.json');
    const r = keur(env);
    assert.equal(r.store, 'sqlite', 'een verse installatie krijgt sqlite');
    assert.deepEqual(r.fouten, [], 'en start gewoon: ' + JSON.stringify(r.fouten));
  });
});

test('de keuring en de opslag lezen dezelfde regel, zodat ze niet uiteen kunnen lopen', () => {
  /* De kop van keuze.js zegt het met zoveel woorden: dit is de ENIGE plek waar
     staat welke stand een grootboek draagt, en db/index.js gebruikt hem ook om
     te besluiten of hij het sqlite-grootboek start. Zou de keuring een eigen
     kopie hebben, dan kan hij iets goedkeuren wat de opslag anders invult --
     en dat is een bewering die pas in productie stukgaat.

     Deze toets houdt de twee tegen elkaar over alle standen die er zijn. */
  const standen = ['postgres', 'sqlite', 'json', 'geheugen'];
  const verwacht = { postgres: true, sqlite: true, json: false, geheugen: false };
  for (const store of standen) {
    assert.equal(keuze.heeftGrootboek({}, store), verwacht[store], store + ' draagt wel/geen grootboek');
    const r = keur({ RTG_STORE: store });
    assert.equal(r.fouten.length === 0, verwacht[store],
      'de keuring volgt diezelfde regel voor ' + store + ': ' + JSON.stringify(r.fouten));
  }
});
