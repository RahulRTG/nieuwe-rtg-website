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

   BEWIJS 8 (MENSELIJK) WORDT AFGELEID, NIET GESCHREVEN (18 oktober 2026).
   scripts/appwerkt.js ziet op het scherm of een kale fout de gebruiker bereikt
   en zei bij elke rij: "of een foutMELDING bruikbaar is, vraagt de storingen
   uit bewijs 7". Die storingen staan hier. Daarom leidt deze proef per
   onderdeel uit ALLE antwoorden die het lid kreeg (ook tijdens de dubbeltik,
   het afgebroken verzoek en na de crash) drie schakels af: geen kale 5xx of
   weggevallen verbinding, geen antwoord zonder leesbaar lijf, en elke
   weigering draagt een melding in woorden en geen stacktrace. Een scenario
   dat geen enkele weigering uitlokte, heeft dat laatste niet laten zien: dan
   draagt menselijk GEEN schakels en `nietBeproefd` met de reden, en APPWERKT
   leest dat als NIET_GETEST en nooit als bewezen. Een scenario kan dit bewijs
   niet zelf schrijven: `stap()` kent alleen de drie hierboven.

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
/* Afgeleid uit de antwoorden, niet door een scenario geschreven (zie de kop). */
const AFGELEID = 'menselijk';

/* DE SCENARIO'S STAAN HIER LETTERLIJK, en niet als een require over een
   mapinhoud. De versheid van VOLTOOIPROEF.json rekent alleen wijzigingen mee in
   wat dit instrument via een LETTERLIJKE require bereikt (sluiting() in
   ./lib/stempel.js); een berekende require ziet die niet. Met readdirSync +
   require(path.join(...)) bleef het register daardoor "vers" -- en de rij
   BEWEZEN -- terwijl het scenario dat het bewijs leverde was veranderd. Een
   bestand in de map dat hier niet staat, laat de proef weigeren in plaats van
   stil niet mee te tellen. */
const SCENARIOS = {
  'aankomst.js': require('./lib/voltooi/aankomst'),
  'attenties.js': require('./lib/voltooi/attenties'),
  'bescherming.js': require('./lib/voltooi/bescherming'),
  'cellier.js': require('./lib/voltooi/cellier'),
  'cercle.js': require('./lib/voltooi/cercle'),
  'commerce.js': require('./lib/voltooi/commerce'),
  'entourage.js': require('./lib/voltooi/entourage'),
  'foodcourt.js': require('./lib/voltooi/foodcourt'),
  'garderobe.js': require('./lib/voltooi/garderobe'),
  'gegevens.js': require('./lib/voltooi/gegevens'),
  'hangar.js': require('./lib/voltooi/hangar'),
  'ik.js': require('./lib/voltooi/ik'),
  'kwesties.js': require('./lib/voltooi/kwesties'),
  'logboek.js': require('./lib/voltooi/logboek'),
  'loopbaan.js': require('./lib/voltooi/loopbaan'),
  'maison.js': require('./lib/voltooi/maison'),
  'mall.js': require('./lib/voltooi/mall'),
  'mecenaat.js': require('./lib/voltooi/mecenaat'),
  'mijnmall.js': require('./lib/voltooi/mijnmall'),
  'move.js': require('./lib/voltooi/move'),
  'nalatenschap.js': require('./lib/voltooi/nalatenschap'),
  'navigatie.js': require('./lib/voltooi/navigatie'),
  'neigingen.js': require('./lib/voltooi/neigingen'),
  'ov.js': require('./lib/voltooi/ov'),
  'ovroutes.js': require('./lib/voltooi/ovroutes'),
  'pay.js': require('./lib/voltooi/pay'),
  'post.js': require('./lib/voltooi/post'),
  'pulse.js': require('./lib/voltooi/pulse'),
  'reisboek.js': require('./lib/voltooi/reisboek'),
  'reizen.js': require('./lib/voltooi/reizen'),
  'relaties.js': require('./lib/voltooi/relaties'),
  'rtmail.js': require('./lib/voltooi/rtmail'),
  'school.js': require('./lib/voltooi/school'),
  'sessies.js': require('./lib/voltooi/sessies'),
  'table.js': require('./lib/voltooi/table'),
  'uitgaan.js': require('./lib/voltooi/uitgaan'),
  'vandaag.js': require('./lib/voltooi/vandaag'),
  'veilig.js': require('./lib/voltooi/veilig'),
  'verificatie.js': require('./lib/voltooi/verificatie'),
  'wereldlaag.js': require('./lib/voltooi/wereldlaag'),
  'wonen.js': require('./lib/voltooi/wonen'),
  'werkos.js': require('./lib/voltooi/werkos')
};

function scenarios(alleen) {
  const inMap = fs.readdirSync(MAP).filter((n) => n.endsWith('.js')).sort();
  const vergeten = inMap.filter((n) => !SCENARIOS[n]);
  if (vergeten.length) throw new Error('scenario(s) in scripts/lib/voltooi/ die niet in SCENARIOS staan: ' + vergeten.join(', ') +
    ' -- zet ze er met een letterlijke require bij, anders ziet de versheid een wijziging erin niet');
  return Object.keys(SCENARIOS).sort()
    .filter((n) => !alleen || n === alleen + '.js')
    .map((n) => Object.assign({ bestand: 'scripts/lib/voltooi/' + n }, SCENARIOS[n]));
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
  /* `omgeving`: een scenario dat een herleidbaar mens van het kantoor nodig
     heeft, draait in de kantoorwereld (KANTOORWERELD in ./lib/voltooiwereld.js).
     De postvanger-grendel geldt daar net zo. */
  const w = await maakWereld(path.basename(sc.bestand, '.js'), sc.omgeving);
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
  uit[AFGELEID] = menselijkUit(w.antwoorden(), afgebroken);
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

/* De grens tussen een melding in woorden en een kale fout, zoals een lid hem
   ziet: een zin van ten minste acht tekens met letters erin, zonder stacktrace
   en zonder de naam van een JavaScript-fout. Alleen de `error`-tekst telt: dat
   is het veld dat elk scherm van dit huis aan de gebruiker toont. */
const KAAL = /TypeError|ReferenceError|SyntaxError|RangeError|Cannot read propert|is not a function|is not defined|\n\s+at\s|^Error:/;
function inWoorden(melding) {
  return typeof melding === 'string' && melding.trim().length >= 8 && /[A-Za-z]/.test(melding) && !KAAL.test(melding);
}

function menselijkUit(antwoorden, afgebroken) {
  const n = antwoorden.length;
  const kaal = antwoorden.filter((a) => a.status === 0 || a.status >= 500);
  const leeg = antwoorden.filter((a) => a.status > 0 && !a.lijf);
  const weigeringen = antwoorden.filter((a) => a.status >= 400 && a.status < 500);
  const zonder = weigeringen.filter((a) => !inWoorden(a.melding));
  const samenvat = (lijst) => [...new Set(lijst.map((a) => a.status + ' ' + a.pad))].slice(0, 5).join(', ');
  if (!n || !weigeringen.length) {
    return { schakels: [], storingen: [], telling: { schakels: 0, gesloten: 0, open: 0, stuk: 0 }, sluit: false,
      antwoorden: n, weigeringen: 0,
      nietBeproefd: n ? 'het scenario lokte geen enkele weigering uit, dus of een melding in woorden de gebruiker bereikt is hier niet gezien'
        : 'het scenario kreeg geen enkel antwoord' };
  }
  const schakels = [
    { nr: 1, wat: 'geen kale 5xx en geen weggevallen verbinding in de ' + n + ' antwoorden, de dubbeltik, het afgebroken verzoek en de crash inbegrepen',
      stand: kaal.length ? 'open' : 'gesloten', ziet: kaal.length ? kaal.length + ' kaal: ' + samenvat(kaal) : n + ' antwoorden, geen enkele kaal' },
    { nr: 2, wat: 'geen antwoord zonder leesbaar lijf (de lege pagina van een route)',
      stand: leeg.length ? 'open' : 'gesloten', ziet: leeg.length ? leeg.length + ' leeg: ' + samenvat(leeg) : 'elk antwoord droeg een lijf' },
    { nr: 3, wat: 'elke weigering (' + weigeringen.length + ') draagt een melding in woorden en geen stacktrace of foutnaam',
      stand: zonder.length ? 'open' : 'gesloten', ziet: zonder.length ? zonder.length + ' zonder melding: ' + samenvat(zonder)
        : weigeringen.length + ' weigering(en), bijvoorbeeld "' + String(weigeringen[0].melding).slice(0, 90) + '"' }
  ];
  const t = { schakels: schakels.length, gesloten: 0, open: 0, stuk: 0 };
  for (const s of schakels) t[s.stand]++;
  return { schakels, storingen: [], telling: t, antwoorden: n, weigeringen: weigeringen.length,
    sluit: t.open === 0 && t.stuk === 0 && !afgebroken };
}

async function meet(opties) {
  const o = opties || {};
  const reg = {
    stempel: huisStempel(),
    uitleg: 'Bewijs 3 (voltooibaar), 5 (persistent) en 7 (herstelbaar) uit BETROUWBAARHEID.md, per onderdeel uit MAPPEN, in de gecontroleerde testwereld: wegwerpdata, postvanger en sms-sandbox, een nette herstart en een crash op dezelfde datamap, en een lezer van de opslag buiten de server om. Bewijs 8 (menselijk) wordt per onderdeel AFGELEID uit alle antwoorden die het lid daarbij kreeg: geen kale 5xx, geen leeg antwoord, en elke weigering met een melding in woorden; zonder uitgelokte weigering is het niet beproefd.',
    grens: 'Gemeten in de gecontroleerde testwereld (wegwerpdata, postvanger, sms-sandbox), niet op productie: een onderdeel dat hier voltooibaar, persistent en herstelbaar is, kan dat buiten die wereld nog niet zijn. Een geslaagd scenario geldt voor DAT scenario en die invoer, niet voor elke variant van het onderdeel.',
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
  /* De telling en `sluit` gaan over de drie geschreven bewijzen. Menselijk
     telt apart (`menselijkGesloten`, `menselijkNietBeproefd`): een scenario dat
     geen weigering uitlokte is niet gezakt, het heeft dat stuk niet gemeten. */
  const t = { apps: 0, bewijzenGesloten: 0, bewijzenOpen: 0, menselijkGesloten: 0, menselijkOpen: 0, menselijkNietBeproefd: 0 };
  for (const a of Object.values(reg.apps)) {
    t.apps++;
    for (const b of BEWIJZEN) (a[b].sluit ? t.bewijzenGesloten++ : t.bewijzenOpen++);
    const m = a[AFGELEID];
    if (m.nietBeproefd) t.menselijkNietBeproefd++; else if (m.sluit) t.menselijkGesloten++; else t.menselijkOpen++;
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
    const m = a[AFGELEID];
    console.log('  ' + AFGELEID + ' (afgeleid): ' + (m.nietBeproefd ? 'NIET BEPROEFD -- ' + m.nietBeproefd : (m.sluit ? 'sluit' : 'SLUIT NIET') + ' (' + m.telling.gesloten + '/' + m.telling.schakels + ')'));
    for (const s of m.schakels) console.log('    ' + String(s.nr).padStart(2) + ' ' + s.stand.padEnd(9) + s.wat + (s.ziet ? '\n         ziet: ' + s.ziet : ''));
    console.log('  post: ' + a.post.gevangen + ' gevangen, ' + a.post.naarBuiten + ' naar buiten');
  }
  console.log(reg.sluit ? '\nAlle bewijzen sluiten.' : '\nNIET ALLE BEWIJZEN SLUITEN (' + reg.telling.bewijzenOpen + ' open).');
  console.log('menselijk (afgeleid): ' + reg.telling.menselijkGesloten + ' gesloten, ' + reg.telling.menselijkOpen + ' open, ' + reg.telling.menselijkNietBeproefd + ' niet beproefd.');
}

module.exports = { meet, scenarios, DOEL, BEWIJZEN, AFGELEID, menselijkUit, inWoorden };

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
