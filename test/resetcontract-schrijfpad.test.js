/* RESETCONTRACT: het schrijfpad van de opslag -- fase C van de runtime.

   server/db/snapshot.js en server/db/geheugen.js zijn allebei een write-behind:
   ze verzamelen wijzigingen en schrijven ze in een venster weg. Elf wortels
   samen, met dezelfde naad in beide modules: terugNaarVers().

   Het waarneembare verschil tussen vers en gebruikt zit in het plannen. Bij een
   verse module staat saveKlaar op -Infinity, dus de eerste plan schrijft
   METEEN; is er net geschreven, dan plant hij een venster in. Precies dat
   verschil mag een toets die na een andere draait niet merken -- dat is wat
   "verse gelijkwaardigheid" hier betekent.

   En de reset schrijft openstaand werk EERST weg. Een reset die de vuil-vlag
   gewoon leegzet gooit gegevens weg; in een gedeelde server lijkt dat op een
   vorige toets die niets had opgeslagen.

   Draai los: node --experimental-sqlite --test test/resetcontract-schrijfpad.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const wacht = ms => new Promise(r => setTimeout(r, ms));

/* Een eigen datamap en een verse modulecache, en na afloop alles terug. */
function metVerseOpslag(store, doe) {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-reset-'));
  const oud = { d: process.env.RTG_DATA_DIR, s: process.env.RTG_STORE, ms: process.env.RTG_SAVE_MS };
  process.env.RTG_DATA_DIR = TMP; process.env.RTG_STORE = store; process.env.RTG_SAVE_MS = '120';
  for (const k of Object.keys(require.cache)) if (k.startsWith(path.join(WORTEL, 'server'))) delete require.cache[k];
  const klaar = () => {
    for (const [k, v] of [['RTG_DATA_DIR', oud.d], ['RTG_STORE', oud.s], ['RTG_SAVE_MS', oud.ms]]) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
    fs.rmSync(TMP, { recursive: true, force: true });
  };
  return Promise.resolve(doe(TMP)).finally(klaar);
}

test('resetcontract: snapshot.terugNaarVers() maakt het plangedrag weer dat van een verse start', async () => {
  return metVerseOpslag('json', async () => {
    const snap = require(path.join(WORTEL, 'server/db/snapshot'));
    const DB_FILE = require(path.join(WORTEL, 'server/db/opslag')).DB_FILE;
    const erIs = () => fs.existsSync(DB_FILE);
    const weg = () => { try { fs.rmSync(DB_FILE); } catch (e) {} };

    /* 1. Vers: de eerste plan schrijft meteen. Zonder deze regel zou stap 3
       groen zijn om de verkeerde reden. */
    weg();
    snap.planSnapshot();
    assert.equal(erIs(), true, 'een verse module hoort bij de eerste planSnapshot() meteen te schrijven');

    /* 2. Gebruikt: er is net geschreven, dus nu plant hij een venster in in
       plaats van te schrijven -- en blijft vuil. */
    weg();
    snap.planSnapshot();
    assert.equal(erIs(), false, 'vlak na een schrijfactie hoort planSnapshot() een venster in te plannen');
    assert.equal(snap.snapshotVuil(), true, 'en er staat dan werk open');

    /* 3. Reset. Het openstaande werk hoort NIET verloren te gaan -- een reset
       die gegevens weggooit is geen schone lei maar dataverlies. */
    snap.terugNaarVers();
    assert.equal(erIs(), true, 'terugNaarVers() hoort openstaand werk eerst weg te schrijven');
    assert.equal(snap.snapshotVuil(), false, 'en daarna niets meer open te hebben staan');

    /* 3b. EN EEN RESET OP EEN SCHONE MODULE SCHRIJFT NIETS. Dat is geen extra
       netheid maar de andere helft van het contract: als een reset ook zonder
       openstaand werk gaat schrijven, dan doet elke schoonmaakbeurt tussen twee
       toetsen een schrijfactie die niemand heeft gevraagd -- en in een gedeelde
       server landt die op de data van de VOLGENDE toets. */
    weg();
    snap.terugNaarVers();
    assert.equal(erIs(), false, 'een reset zonder openstaand werk hoort niets te schrijven');

    /* 4. En het plangedrag is weer dat van stap 1. */
    weg();
    snap.planSnapshot();
    assert.equal(erIs(), true, 'na de reset hoort de eerste planSnapshot() weer meteen te schrijven, net als vers');

    /* 5. De afgezegde timer uit stap 2 mag niet alsnog vuren. Die stond op ~120
       ms; na het venster hoort er geen tweede schrijfactie meer te komen.

       EERLIJK OVER WAT DIT WEL EN NIET AANTOONT. Een reset die de timer alleen
       op null zet in plaats van hem af te zeggen, blijft hier groen -- ik heb
       het nagelopen. De reden is de flush in stap 3: die zet saveVuil op false,
       en dan doet de wees bij het vuren niets meer. In dit ontwerp is een
       niet-afgezegde timer dus niet met gedrag te betrappen. Dat gat zit sinds
       die mutatie in de BRONPOORT: bij een wortel met vorm `timer` eist
       scripts/staat.js een echte clearTimeout/clearInterval en niet alleen een
       schrijfactie (zie dekking() daar, gebrek `timerNietAfgezegd`). */
    weg();
    await wacht(300);
    assert.equal(erIs(), false, 'de timer van voor de reset hoort afgezegd te zijn, niet alsnog te schrijven');

    snap.terugNaarVers();
  });
});


test('resetcontract: geheugen.terugNaarVers() maakt het savegedrag weer dat van een verse start', async () => {
  return metVerseOpslag('geheugen', async () => {
    const geheugen = require(path.join(WORTEL, 'server/db/geheugen'));
    const state = require(path.join(WORTEL, 'server/db/state'));
    state.db.data = { proef: { a: 1 } };
    state.db.writable = true;

    const brokken = () => (fs.existsSync(geheugen.GDIR) ? fs.readdirSync(geheugen.GDIR) : []).length;
    const leeg = () => { try { fs.rmSync(geheugen.GDIR, { recursive: true, force: true }); } catch (e) {} };

    /* 1. Vers: de eerste save schrijft meteen (saveKlaar staat op -Infinity). */
    leeg();
    geheugen.saveGeheugen();
    assert.ok(brokken() > 0, 'een verse module hoort bij de eerste saveGeheugen() meteen te schrijven');

    /* 2. Gebruikt: er is net geschreven, dus nu plant hij een venster in. */
    leeg();
    state.db.data.proef.a = 2;
    geheugen.saveGeheugen();
    assert.equal(brokken(), 0, 'vlak na een schrijfactie hoort saveGeheugen() een venster in te plannen');

    /* 3. Reset: het openstaande werk landt, en daarna is het gedrag weer vers. */
    geheugen.terugNaarVers();
    assert.ok(brokken() > 0, 'terugNaarVers() hoort openstaand werk eerst weg te schrijven');

    /* 3b. En een reset op een SCHONE module schrijft niets -- anders doet elke
       schoonmaakbeurt tussen twee toetsen een ongevraagde schrijfactie, die in
       een gedeelde server op de data van de volgende toets landt. */
    leeg();
    geheugen.terugNaarVers();
    assert.equal(brokken(), 0, 'een reset zonder openstaand werk hoort niets te schrijven');

    leeg();
    state.db.data.proef.a = 3;
    geheugen.saveGeheugen();
    assert.ok(brokken() > 0, 'na de reset hoort de eerste save weer meteen te schrijven, net als vers');

    /* 4. De afgezegde timer uit stap 2 mag niet alsnog vuren. */
    leeg();
    await wacht(300);
    assert.equal(brokken(), 0, 'de timer van voor de reset hoort afgezegd te zijn, niet alsnog te schrijven');

    geheugen.terugNaarVers();
  });
});
