#!/usr/bin/env node
'use strict';
/* ============================================================================
   DE VOLTOOIPROEF -- bewijs 3, 5 en 7 uit BETROUWBAARHEID.md, per onderdeel
   uit MAPPEN, in de gecontroleerde testwereld.

   WAAROM DIT BESTAAT. APPWERKT.json had voor bijna elke rij drie bewijzen op
   GEEN_FIXTURE: voltooibaar (kan de hele bedoeling worden afgemaakt),
   persistent (staat de uitkomst er na een herstart en in een nieuwe sessie
   nog, en staat hij in de OPSLAG) en herstelbaar (overleeft het dubbelklik, een
   herhaald verzoek, een afgebroken verzoek en een crash). De ketenproeven
   leveren alleen het eerste, en met opzet (scripts/lib/appcontract.js, kop):
   ze herstarten niets en laten niets crashen. Deze proef doet dat wel, en mag
   daarom alle drie leveren -- en geen ander.

   DE TESTWERELD (BETROUWBAARHEID.md par. 4) is hier een wegwerpserver met:
     - een eigen datamap (wegwerpdata),
     - de postvanger voor mail en de sms-sandbox (server/post-vanger.js,
       server/sms-sandbox.js): de proef WEIGERT te meten als er in haar
       omgeving post naar buiten kan (scripts/lib/postvanger.js),
     - een nette herstart (SIGTERM) en een crash (SIGKILL) op dezelfde map,
     - en een lezer van de opslag die buiten de server om leest.
   Geen vlag in een poort: de server draait de gewone code. De adapters
   vervangen een rail, nooit een poort (MAGNAATLAB.md par. 3).

   PER ONDERDEEL EEN SCENARIO in scripts/lib/voltooi/<naam>.js. Daarin staan de
   routes letterlijk, en daarop rust de koppeling die scripts/lib/bewijsbron.js
   meet: het scenario moet routes raken die de ingang zelf aanroept. Een
   scenario dat elders landt, levert niets.

   WAT EEN STAP IS: handelt het lid (of zijn tweede toestel), en ziet de
   ontvanger daarna de verandering? `gesloten` als het klopt, `open` als de
   handeling lukte maar de uitkomst niet klopt, `stuk` als het werk zelf al niet
   lukte. Dezelfde woorden als de ketenregisters, want dezelfde lezer leest ze.

   WAT DEZE PROEF NIET IS, en dat staat per onderdeel onder `grens`:
     - geen browser: de routes van het scherm, niet het scherm (dat is bewijs 2);
     - geen Redis en geen PostgreSQL: herstelbaar is hier een proces dat sterft
       op SQLite, niet een gedeelde opslag die wegvalt;
     - geen bezorging: de postvanger bewijst wat het huis wilde versturen en dat
       het nergens heen ging, niet dat het aankwam.

   Draaien:  npm run voltooiproef             (print, zakt op een open schakel)
             npm run voltooiproef:vast        (schrijft VOLTOOIPROEF.json; eist
                                               een schone boom)
             node scripts/voltooiproef.js --alleen=sessies
   ============================================================================ */
const fs = require('fs');
const path = require('path');
const { stempel: huisStempel, eisSchoneBoom } = require('./lib/stempel');
const { maakWereld } = require('./lib/voltooiwereld');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'VOLTOOIPROEF.json');
const MAP = path.join(__dirname, 'lib', 'voltooi');
const BEWIJZEN = ['voltooibaar', 'persistent', 'herstelbaar'];

function scenarios(alleen) {
  return fs.readdirSync(MAP).filter((n) => n.endsWith('.js')).sort()
    .filter((n) => !alleen || n === alleen + '.js')
    .map((n) => Object.assign({ bestand: 'scripts/lib/voltooi/' + n }, require(path.join(MAP, n))));
}

async function meetScenario(sc) {
  const boek = Object.fromEntries(BEWIJZEN.map((b) => [b, []]));
  /* Een stap faalt nooit stil: een uitzondering wordt `stuk` met de fout erbij,
     en de volgende stap loopt gewoon -- een keten die na de eerste fout stopt,
     verbergt hoeveel er verder nog kapot is. */
  const stap = async (bewijs, wat, fn) => {
    if (!boek[bewijs]) throw new Error('onbekend bewijs ' + bewijs + ' in ' + sc.bestand);
    const t0 = Date.now();
    const nr = boek[bewijs].length + 1;
    try {
      const r = await fn();
      boek[bewijs].push({ nr, wat, stand: r && r.klopt ? 'gesloten' : 'open', ziet: r && r.ziet || null, ms: Date.now() - t0 });
    } catch (e) {
      boek[bewijs].push({ nr, wat, stand: 'stuk', fout: String(e && e.message || e).slice(0, 300), ms: Date.now() - t0 });
    }
  };
  const w = await maakWereld(path.basename(sc.bestand, '.js'));
  let afgebroken = null;
  try { await sc.loop(w, stap); }
  catch (e) { afgebroken = String(e && e.message || e).slice(0, 300); }
  const post = w.berichten();
  w.klaar();
  const uit = { scenario: sc.bestand, ingang: sc.ingang, persona: sc.persona, belofte: sc.belofte, grens: sc.grens,
    herstarts: w.herstarts, afgebroken,
    /* Wat de postvanger ving. Geen inhoud en geen adres: de soort, het onderwerp
       en hoeveel. Dat er iets ligt, bewijst dat het huis het wilde versturen;
       dat het nergens heen ging, bewijst de grendel. */
    post: { gevangen: post.length, naarBuiten: 0,
      onderwerpen: post.map((b) => b.soort + ': ' + (b.onderwerp || '(geen onderwerp)')) } };
  for (const b of BEWIJZEN) {
    const schakels = boek[b];
    const t = { schakels: schakels.length, gesloten: 0, open: 0, stuk: 0 };
    for (const s of schakels) t[s.stand]++;
    /* Een bewijs zonder stappen sluit NIET: niets gemeten is geen groen. En een
       scenario dat halverwege afbrak, sluit ook niet -- ook als de stappen die
       wel liepen allemaal dicht waren. */
    uit[b] = { schakels, storingen: [], telling: t,
      sluit: schakels.length > 0 && t.open === 0 && t.stuk === 0 && !afgebroken };
  }
  return uit;
}

async function meet(opties) {
  const o = opties || {};
  const reg = {
    stempel: huisStempel(),
    uitleg: 'Bewijs 3 (voltooibaar), 5 (persistent) en 7 (herstelbaar) uit BETROUWBAARHEID.md, per onderdeel uit MAPPEN, in de gecontroleerde testwereld: wegwerpdata, postvanger en sms-sandbox, een nette herstart en een crash op dezelfde datamap, en een lezer van de opslag buiten de server om.',
    hoe: 'npm run voltooiproef:vast',
    testwereld: {
      mail: 'postvanger (server/post-vanger.js): alleen met RTG_POSTVANGER=1, nooit in productie, nooit naast SMTP_URL of MAIL_DIRECT',
      sms: 'sms-sandbox (server/sms-sandbox.js): alleen met SMS_SANDBOX=1, nooit in productie; beide choke points (sendSms en send("sms:...")) lopen erdoor',
      betalen: 'simulatiebank (server/betaal/synthetisch.js) bestaat; geen van de scenario\'s hieronder betaalt',
      opslag: 'eigen RTG_DATA_DIR per scenario, gelezen met node:sqlite readOnly',
      storing: 'SIGTERM (deploy) en SIGKILL (stroomstoring) op dezelfde datamap; een afgebroken verzoek met AbortController'
    },
    apps: {}
  };
  for (const sc of scenarios(o.alleen)) reg.apps[sc.functie] = await meetScenario(sc);
  const t = { apps: 0, bewijzenGesloten: 0, bewijzenOpen: 0 };
  for (const a of Object.values(reg.apps)) {
    t.apps++;
    for (const b of BEWIJZEN) (a[b].sluit ? t.bewijzenGesloten++ : t.bewijzenOpen++);
  }
  reg.telling = t;
  reg.sluit = t.apps > 0 && t.bewijzenOpen === 0;
  return reg;
}

function druk(reg) {
  for (const [f, a] of Object.entries(reg.apps)) {
    console.log(f + '  (' + a.ingang + ', ' + a.scenario + ')' + (a.afgebroken ? '\n  AFGEBROKEN: ' + a.afgebroken : ''));
    for (const b of BEWIJZEN) {
      console.log('  ' + b + ': ' + (a[b].sluit ? 'sluit' : 'SLUIT NIET') + ' (' + a[b].telling.gesloten + '/' + a[b].telling.schakels + ')');
      for (const s of a[b].schakels) console.log('    ' + String(s.nr).padStart(2) + ' ' + s.stand.padEnd(9) + s.wat +
        (s.ziet ? '\n         ziet: ' + s.ziet : '') + (s.fout ? '\n         FOUT: ' + s.fout : ''));
    }
    console.log('  post: ' + a.post.gevangen + ' gevangen, ' + a.post.naarBuiten + ' naar buiten');
  }
  console.log(reg.sluit ? '\nAlle bewijzen sluiten.' : '\nNIET ALLE BEWIJZEN SLUITEN (' + reg.telling.bewijzenOpen + ' open).');
}

module.exports = { meet, scenarios, DOEL, BEWIJZEN };

if (require.main === module) {
  const vast = process.argv.includes('--vastleggen');
  const alleen = (process.argv.find((a) => a.startsWith('--alleen=')) || '').slice(9) || null;
  if (vast && alleen) {
    console.error('--vastleggen en --alleen gaan niet samen: een gedeeltelijk register zou de andere onderdelen stil laten verdwijnen.');
    process.exit(2);
  }
  if (vast) {
    const schoon = eisSchoneBoom('de voltooiproef');
    if (!schoon.ok) { console.error('NIET GEMETEN: ' + schoon.reden); process.exit(2); }
  }
  meet({ alleen }).then((reg) => {
    druk(reg);
    if (vast) { fs.writeFileSync(DOEL, JSON.stringify(reg, null, 2) + '\n'); console.log('geschreven: VOLTOOIPROEF.json'); }
    process.exit(reg.sluit ? 0 : 1);
  }).catch((e) => { console.error('de voltooiproef kon niet draaien: ' + (e && e.message || e)); process.exit(1); });
}
