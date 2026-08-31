/* TWEE SERVERS DIE TEGELIJK OPKOMEN OP DEZELFDE DATABASE.

   In de vloot (server/vloot.js) draait elke groep als eigen proces, maar ze
   delen een database. Alle vier doen bij het opstarten hetzelfde: kijken of het
   eigenaarsaccount bestaat en het anders aanmaken. Dat is kijken-dan-doen, en
   tussen die twee stappen kan een ander proces er net zijn geweest. Wie de
   tweede is, botst op UNIQUE(users.username) -- en die uitzondering viel buiten
   elke route, dus hij was FATAAL: die groep viel om.

   Dat is lang goed gegaan omdat de vloot een omgevallen groep herstart en het
   account de tweede keer wel bestaat. Op een trage bouwmachine met
   dekkingsmeting haalde het kantoor daarmee de opkomsttijd niet: op 27 augustus
   2026 zakte test/vloot.test.js op `{"leden":200,"kantoor":502,"rtf":200}` --
   twee groepen op, een groep niet. Geen crash in de toets zelf, alleen een
   groep die er nooit kwam.

   Deze toets zet dezelfde wedloop op in het klein, met twee gewone servers en
   zonder poortwachter, zodat de oorzaak zichtbaar is waar hij zit en niet pas
   in een integratietoets van twee minuten.

   Draai los: node --experimental-sqlite --test test/eigenaar-wedloop.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');
const net = require('node:net');
const fs = require('fs');
const os = require('os');
const path = require('path');

const migraties = require('../server/migraties');

const SERVER = path.join(__dirname, '..', 'server', 'server.js');
const HOEVEEL = 3;      // drie processen: net als de vloot, en genoeg om te botsen

/* HOE LANG DRIE SERVERS MOGEN DOEN OVER OPKOMEN, en waarom dat niet 60 s is.

   Dit stond op zestig seconden en dat is ruim -- los gedraaid komen ze er in
   zestien. In de volle ronde niet: `npm run test:gate` draait alles tegelijk
   MET dekkingsmeting, en dan is een serveropstart een veelvoud trager. Op
   28 augustus 2026 zakte deze toets daar op 60,19 s, terwijl er geen enkel
   proces was omgevallen -- ze waren alleen nog niet klaar.

   Precies dezelfde les staat al in test/vloot.test.js, die om deze reden op
   120 s staat. Die stond hier ook, en ik heb hem gelezen en niet toegepast.

   Wachten kost hier niets: een proces dat OMVALT breekt de lus meteen af (zie
   de controle op `gestopt` hieronder), dus een echte terugval zakt nog steeds
   binnen een paar seconden. Alleen een trage opkomst krijgt meer lucht.

   EN OP 31 AUGUSTUS 2026 WAS 120 S OOK NIET GENOEG. In de CI draaien vier
   toetsscherven tegelijk op dezelfde runner, elk met hun eigen servers, plus een
   postgres en een redis in containers ernaast. Deze toets zakte daar op de
   volle 120 s met opnieuw geen enkel omgevallen proces: drie node-processen die
   op twee kernen om de beurt mogen opstarten, halen die klok niet.

   Dus 300 s, en de reden dat dat geen doekje voor het bloeden is staat
   hierboven: dit is geen prestatietoets. Wat hij bewijst is dat drie servers op
   dezelfde database elkaar niet omverduwen en samen EEN grootboek overhouden.
   De tijd is het vervoermiddel, niet de bewering -- en de jobgrens van de CI
   (45 minuten) blijft de echte vangrail voor iets dat werkelijk hangt.

   Zou dit ooit nog eens zakken op de klok, dan is de volgende stap niet weer
   meer tijd maar de opstart zelf meten: hoe lang doet EEN server hier over, en
   waarom loopt dat uit de hand. */
const OPKOMST = 300000;

function vrijePoort() {
  return new Promise((res, rej) => {
    const s = net.createServer();
    s.unref();
    s.on('error', rej);
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); });
  });
}

test('drie servers die tegelijk opkomen op een gedeelde database botsen niet op het eigenaarsaccount', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-wedloop-'));
  const kinderen = [];
  try {
    const poorten = [];
    for (let i = 0; i < HOEVEEL; i++) poorten.push(await vrijePoort());

    /* TEGELIJK, en niet na elkaar. Na elkaar bestaat het account al bij de
       tweede en is er niets te winnen; de wedloop zit juist in het gaatje
       tussen "bestaat hij?" en "maak hem aan". */
    for (const poort of poorten) {
      const kind = spawn(process.execPath, ['--experimental-sqlite', SERVER], {
        env: { ...process.env, NODE_ENV: 'test', RTG_DEMO: '1', RTG_DATA_DIR: TMP,
          SMTP_URL: '', PORT: String(poort), RTG_POORT: String(poort) },
        stdio: ['ignore', 'ignore', 'pipe']
      });
      const staat = { poort, kind, fouten: [], gestopt: null };
      let rest = '';
      kind.stderr.on('data', (buf) => {
        rest += buf.toString();
        const regels = rest.split('\n'); rest = regels.pop();
        for (const r of regels) if (/"bron":"uncaughtException"/.test(r)) staat.fouten.push(r.slice(0, 240));
      });
      kind.on('exit', (code) => { staat.gestopt = code; });
      kinderen.push(staat);
    }

    const gezond = async (poort) => {
      try { return (await fetch('http://127.0.0.1:' + poort + '/api/health',
        { signal: AbortSignal.timeout(2000) })).ok; } catch (e) { return false; }
    };
    const tot = Date.now() + OPKOMST;
    let alle = false;
    while (Date.now() < tot && !alle) {
      /* Een proces dat al gestopt is komt niet meer; dan hoeft er niet gewacht
         te worden tot de klok op is -- de melding hieronder is de uitslag. */
      if (kinderen.some(k => k.gestopt !== null)) break;
      const standen = await Promise.all(kinderen.map(k => gezond(k.poort)));
      alle = standen.every(Boolean);
      if (!alle) await new Promise(r => setTimeout(r, 250));
    }

    const omgevallen = kinderen.filter(k => k.gestopt !== null || k.fouten.length);
    assert.equal(omgevallen.length, 0,
      'geen enkele server valt om bij het gelijktijdig opstarten; omgevallen: ' +
      JSON.stringify(omgevallen.map(k => ({ poort: k.poort, code: k.gestopt, fout: k.fouten[0] || null }))));
    /* Zakt hij toch op de klok, dan zegt de melding WELKE server niet
       antwoordde. Zonder dat is de enige aanwijzing "een van de drie", en dan
       begint het zoeken bij nul. */
    if (!alle) {
      const standen = await Promise.all(kinderen.map(async k => ({ poort: k.poort, gezond: await gezond(k.poort) })));
      assert.fail('niet alle ' + HOEVEEL + ' servers antwoordden op /api/health binnen ' +
        Math.round(OPKOMST / 1000) + 's; stand: ' + JSON.stringify(standen));
    }

    /* EN HET GROOTBOEK IS ER MAAR EEN. Niemand omgevallen is de helft van de
       vraag; de andere helft is of de migraties ook precies EEN KEER zijn
       gedraaid. Elke stap staat er dus een keer in, en de database staat op de
       hoogste versie die deze code kent. Zonder die tweede helft zou een stille
       tweede uitvoering hier ongezien doorglippen. */
    const db = new DatabaseSync(path.join(TMP, 'rtg.db'));
    try {
      const rijen = migraties.gedraaid(db);
      const nummers = rijen.map(r => r.n);
      assert.equal(new Set(nummers).size, nummers.length,
        'elke migratie staat precies een keer in het grootboek: ' + JSON.stringify(nummers));
      assert.equal(migraties.stand(db), migraties.hoogsteBekend(),
        'en de database staat op de hoogste versie die deze code kent');
    } finally { try { db.close(); } catch (e) {} }
  } finally {
    for (const k of kinderen) try { k.kind.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
