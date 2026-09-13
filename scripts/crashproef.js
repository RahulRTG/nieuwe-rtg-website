#!/usr/bin/env node
/* ============================================================================
   DE CRASHPROEF -- wat er van een GELDROUTE overblijft als het proces sterft.

   scripts/crashas.js CLASSIFICEERT: bestaat deze crashgrens op deze route, en
   is hij te beproeven? Dat leverde 90 grenzen die bestaan EN te beproeven zijn,
   en 1 die werkelijk gemeten was. Dit script meet de andere 89.

   HET VERSCHIL MET crashgrenzen.js. Dat script stelt EEN vraag over de
   modi zelf -- raakt elke verraadsmodus een ANDER moment? -- op een enkel
   geldpad. Dit script neemt die modi als gegeven en loopt er de hele lijst
   geldroutes mee af. Zonder crashgrenzen.js zou dit script 90 metingen kunnen
   opleveren die alle drie hetzelfde moment raken.

   DE VRAAG IS ECONOMISCH EN NIET TECHNISCH, en dat bepaalt wat er gemeten
   wordt. Een route mag netjes 500 geven terwijl drie van de vijf collecties al
   tweemaal zijn aangepast. Daarom kijkt deze proef niet naar het ANTWOORD --
   dat is er bij een crash per definitie niet -- maar naar de INHOUD van de
   opslag na de herstart, via scripts/droogloop.js. Er komt geen tweede lezer
   van de opslag bij, en geen tweede wereldbouwer: de wereld en de lijven komen
   uit scripts/lib/idemwereld.js, dezelfde die de idempotentieproef gebruikt.

   DE HERSTARTRUIS WORDT EERST GEMETEN EN DAARNA AFGETROKKEN. Een server die
   opstart schrijft zelf: sessies, migraties, een spoorregel. Zonder die ruis
   apart te meten zou elke ronde "er is iets veranderd" zeggen en zou ATOMIC
   nergens te halen zijn. De ruisronde draait EEN keer, zonder verraad, en doet
   verder exact hetzelfde: opstellen, snapshot, doden, herstarten, snapshot.

   WAT EEN UITSLAG BETEKENT -- en `PROVEN` is er maar een van:

     PROVEN            de grens is geraakt en de belofte gehouden
     PROVEN_PARTIAL    de herstart lukte, maar de dubbeling is NIET beoordeeld:
                       deze route hoort bij een tweede oproep werk te doen, dus
                       "er kwam iets bij" is hier geen fout
     FAILED            de grens is geraakt en er staat iets wat er niet hoort
     GEEN_DUURZAME_WEG de modus stond scherp, de route deed zijn werk en stierf
                       NIET. Dan heeft hij `bijeen()` noch `saveDuurzaam()`
                       aangeroepen: hij schrijft via de gewone write-behind
                       save(). Deze twee grenzen BESTAAN dus niet op zijn pad --
                       en dat is geen geruststelling, want wat hem wel bedreigt
                       is een VERLOREN schrijfactie, en dat is `schrijf-verloren`
                       en niet deze proef
     GEEN_WERK         de oproep kwam niet aan het werk (status erbij), dus er
                       viel niets te crashen
     WERELD_ONTBREEKT  deze route heeft een onderwerp nodig dat de wereld niet
                       klaarzette -- met erbij WAT er zou moeten bestaan
     BLOCKED           de opstelling zelf kwam niet rond

   Draaien:  npm run crashproef
             npm run crashproef -- --pad=/api/pay/saldo
             npm run crashproef -- --routes=5 --json
   ========================================================================== */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const W = require('./lib/wegwerpserver.js');
const { inhoudsBeeld, verschil, isSpoor } = require('./droogloop.js');
const { haalSleutels } = require('./lib/proefsleutels.js');
const verraad = require('../server/lib/verraad.js');

const WORTEL = path.join(__dirname, '..');

/* Elke wegwerpserver hangt een opruimhaak aan `process.exit`, en deze proef
   start er vier per ronde. Boven de tien waarschuwt node over een lek dat er
   niet is: de haken horen bij servers die nog kunnen draaien, en ze verdwijnen
   met het proces. De waarschuwing zou hier wel elke ronde de uitslag
   vertroebelen. */
process.setMaxListeners(0);
const argv = process.argv.slice(2);
const jsonUit = argv.includes('--json');
const vastleggen = argv.includes('--vastleggen');
const alleenPad = (argv.find(a => a.startsWith('--pad=')) || '').slice(6) || null;
const maxRoutes = Number((argv.find(a => a.startsWith('--routes=')) || '').slice(9)) || 0;

/* De twee grenzen die een injectiepunt HEBBEN. `in-de-opslag` staat er met
   opzet niet bij: crashgrenzen.js heeft gemeten dat hij op een transactionele
   opslag geen eigen moment heeft, en scripts/crashas.js draagt dat als een
   gemeten `nee`. Een proef die hem toch zou draaien, meet sterf-na-commit nog
   een keer en noemt dat dekking. */
const GRENZEN = [
  { grens: 'voor-eerste-mutatie', modus: 'sterf-voor-mutatie',
    belofte: 'er hoort geen spoor te zijn -- de collecties van deze route staan onaangeroerd' },
  { grens: 'na-commit-voor-antwoord', modus: 'sterf-na-commit',
    belofte: 'de uitkomst staat vast, en een herhaling na de herstart legt er niets bovenop' }
];

const OFFICE = 'RTG-OFFICE-PROEF';
const SERVEROMGEVING = { RTG_DEMO: '1', RTG_MAGNAAT_TEST: '1', OFFICE_CODE: OFFICE };

async function post(basis, pad, lijf, tok) {
  try {
    const r = await fetch(basis + pad, { method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) },
      body: JSON.stringify(lijf || {}) });
    const tekst = await r.text();
    let data; try { data = JSON.parse(tekst); } catch (e) { data = tekst; }
    return { status: r.status, data };
  } catch (e) { return { status: 0, data: String(e.message) }; }
}

/* De opstelling: een verse server, de sleutelbos, en de geldwereld van
   idemwereld.js. Geeft ook het LIJF van deze route terug -- dat is waarom die
   module bestaat: een plausibel lijf kent de IBAN's van DEZE database niet, en
   dan strandt de oproep op "deed geen werk" in plaats van op de crash. */
async function stelOp(datamap) {
  const srv = await W.start({ naam: 'crashproef', datamap, env: SERVEROMGEVING });
  const p = (pad, lijf, tok) => post(srv.basis, pad, lijf, tok);
  const bos = await haalSleutels({ post: p });
  const { zetWereldKlaar, voorzieningVoor } = require('./lib/idemwereld');
  const w = await zetWereldKlaar({ post: p, tokens: bos.tokens, datamap });
  const { gedeeldLijf } = require('./lib/idemwereld');
  return { srv, p, bos, wereld: w.wereld, lijven: w.perRoute || {},
    gedeeld: gedeeldLijf(w.wereld), voorzieningVoor };
}

/* De ruis van een herstart: wat schrijft de server uit zichzelf? Een keer
   gemeten, want dit hangt aan de server en niet aan de route. Zonder deze
   aftrek zou geen enkele route ooit ATOMIC halen. */
async function meetHerstartruis() {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-crashruis-'));
  let srv = null;
  try {
    const a = await stelOp(map);
    srv = a.srv;
    /* Exact dezelfde vorm als ronde(): beide momentopnamen terwijl een verse
       schone server draait, en er even veel starts tussen. Een ruisronde die
       anders meet dan de ronde die hem gebruikt, trekt het verkeerde af. */
    try { srv.kind.kill('SIGKILL'); } catch (e) {}
    srv = await W.start({ datamap: map, env: SERVEROMGEVING });
    const voor = inhoudsBeeld(map);
    try { srv.kind.kill('SIGKILL'); } catch (e) {}
    srv = await W.start({ datamap: map, env: SERVEROMGEVING });
    try { srv.kind.kill('SIGKILL'); } catch (e) {}
    srv = await W.start({ datamap: map, env: SERVEROMGEVING });
    const na = inhoudsBeeld(map);
    return (verschil(voor, na) || []).filter(k => !isSpoor(k));
  } finally {
    try { if (srv && srv.kind) srv.kind.kill('SIGKILL'); } catch (e) {}
    fs.rmSync(map, { recursive: true, force: true });
  }
}

/* Raakt deze sleutel uit het opslagbeeld een collectie die DEZE route
   declareert? De sleutels heten `boek:collectie`, dus het laatste deel telt. */
const vanRoute = (route) => (sleutel) => route.collecties.includes(String(sleutel).split(':').pop());

/* DE WEGING VAN EEN HERHALING NA DE HERSTART -- DRIE UITKOMSTEN EN NIET TWEE.

   De eerste versie had er twee te weinig: alles wat niet `beschermd` heet ging
   naar PROVEN_PARTIAL met de reden "deze route hoort bij een tweede oproep werk
   te doen". Dat is `ongemeten` gelezen als `niet idempotent` -- dezelfde fout
   als `onbekend` lezen als `nee`, en juist de fout die dit huis overal elders
   tegenhoudt. IDEMPROEF.json zegt van vier geldroutes niets; dat is geen
   uitspraak over hun gedrag. /api/pay/saldo is er een van, en factuurproef.js
   heeft de idempotentie ervan gewoon BEWEZEN.

   Het is ook niet nodig, want de meting is er al: de herhaling is uitgevoerd en
   de collecties zijn nageteld. Legt zij niets bovenop, dan is de belofte
   gehouden -- wat het register ook nog niet wist. Alleen bij een herhaling die
   WEL werk deed maakt het uit wat er over de route bekend is.

   Deze functie staat apart en wordt geexporteerd omdat test/crashproef.test.js
   hem narekent. Een toets die de regel OVERSCHRIJFT in plaats van aanroept,
   blijft groen als de regel verandert -- en dan bewaakt hij niets. */
function weegHerhaling(bijgekomen, idempotentie) {
  if (bijgekomen === 0) return { stand: 'PROVEN',
    reden: 'de herhaling na de herstart legde niets bovenop de uitkomst' };
  if (idempotentie === 'beschermd') return { stand: 'FAILED',
    reden: 'deze route heet beschermd, maar de herhaling na de herstart veranderde ' +
      bijgekomen + ' collectie(s) van deze route opnieuw' };
  return { stand: 'PROVEN_PARTIAL',
    reden: 'de herstart lukte en de opslag is leesbaar, maar de herhaling deed werk in ' +
      bijgekomen + ' collectie(s). Of dat een gebroken belofte is of het bedoelde gedrag, ' +
      'kan deze proef niet zeggen: IDEMPROEF.json noemt deze route ' + idempotentie + '.' };
}

async function ronde(route, grens, ruis) {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-crashproef-'));
  let srv = null;
  const schoon = (lijst) => (lijst || []).filter(k => !isSpoor(k) && !ruis.includes(k));
  try {
    const a = await stelOp(map);
    srv = a.srv;
    const tok = a.bos.tokenVoor ? a.bos.tokenVoor(route.rol) : a.bos.tokens[route.rol];
    if (!tok && route.rol) return { stand: 'BLOCKED', reden: 'geen sleutel voor rol ' + route.rol };
    /* HET LIJF, MET EEN TERUGVAL -- want zonder terugval viel tweederde weg.

       idemwereld.js kent een eigen lijf voor een stuk of vijftien geldroutes;
       de eerste ronde meldde de andere dertig als WERELD_ONTBREEKT en meette ze
       niet. Dat is te streng: het GEDEELDE lijf (de echte IBAN en codenamen uit
       deze database) brengt een deel van die routes gewoon aan het werk, en een
       route die er niets mee kan, meldt zich daarna als GEEN_WERK MET zijn
       status -- wat meer zegt dan "geen lijf". WERELD_ONTBREEKT blijft over
       voor het geval dat de wereld helemaal niets opleverde. */
    const lijf = a.lijven[route.pad] || a.gedeeld;
    if (!lijf || !Object.keys(lijf).length) return { stand: 'WERELD_ONTBREEKT',
      reden: 'idemwereld.js levert geen lijf voor dit pad en de gedeelde wereld is leeg; ' +
        'zonder de echte IBAN/codenaam van DEZE database strandt de oproep op "deed geen werk" ' +
        'in plaats van op de crash' };
    const eigenLijf = !!a.lijven[route.pad];

    const maak = a.voorzieningVoor(route.pad);
    if (maak) { try { await maak({ post: a.p, tokens: a.bos.tokens }); } catch (e) {} }

    /* DE TWEE MOMENTOPNAMEN WORDEN OP DEZELFDE MANIER GEMAAKT, EN DAT IS DE
       HELE REPARATIE: allebei terwijl een VERS OPGESTARTE, SCHONE server draait.

       Twee dingen zijn hier achter elkaar misgegaan en ze wezen allebei op
       hetzelfde. Eerst stond de voormeting voor de kill en de nameting na een
       herstart. Toen zette ik de voormeting NA de kill -- en dat was erger, want
       toen las hij minder.

       De oorzaak is de WAL van sqlite. Een momentopname vlak na een SIGKILL
       opent de .db-bestanden alleen-lezen en kan de WAL niet terugdraaien; wat
       daar nog in staat, ziet hij dus niet. De eerstvolgende start herstelt de
       WAL, en dan verschijnt die inhoud alsnog -- wat er als "veranderd door de
       gemeten oproep" uitziet. Gemeten, zonder ook maar een oproep te doen:
       vlak-na-de-kill tegen draaiend gaf drie verschillen, draaiend tegen
       draaiend gaf er een.

       Die ene is echt: `schaduwregels` beweegt bij ELKE start, en die hoort de
       ruisronde eruit te halen. De andere twee (`rijkVoertuigen`, `suppliers`)
       waren nooit ruis maar een leesfout, en zolang ze als ruis werden
       afgetrokken, dekte de proef echte veranderingen in die collecties mee af.

       Symmetrie is hier dus geen netheid maar de meting zelf: twee
       momentopnamen die op verschillende manieren zijn gemaakt, verschillen
       altijd. */
    try { srv.kind.kill('SIGKILL'); } catch (e) {}
    srv = await W.start({ datamap: map, env: SERVEROMGEVING });
    const voor = inhoudsBeeld(map);

    /* Het verraad gaat pas AAN bij de volgende start. De opstelling schrijft
       zelf duurzaam, dus met de modus vanaf het begin scherp sterft de server
       tijdens het inloggen en meet de ronde de opstelling in plaats van de
       geldroute. */
    try { srv.kind.kill('SIGKILL'); } catch (e) {}
    srv = await W.start({ datamap: map, magSterven: true, wachtMs: 30000,
      env: { ...SERVEROMGEVING, RTG_VERRAAD: grens.modus, RTG_VERRAAD_SEED: '20260913' } });
    if (srv.dood) return { stand: 'BLOCKED',
      reden: 'de server stierf al tijdens het opstarten onder ' + grens.modus };

    const r = await post(srv.basis, route.pad, lijf, tok);
    const gestorven = r.status === 0;

    try { srv.kind.kill('SIGKILL'); } catch (e) {}
    srv = await W.start({ datamap: map, env: SERVEROMGEVING });
    const na = inhoudsBeeld(map);
    const geraakt = schoon(verschil(voor, na));
    const binnen = geraakt.filter(vanRoute(route));
    const buiten = geraakt.filter(k => !vanRoute(route)(k));

    /* NIET GESTORVEN -- EN DAT IS TWEE VERSCHILLENDE DINGEN.

       De eerste ronde noemde allebei `BLINDE_INJECTIE`, en dat was een vals
       alarm op acht routes. Een blinde injectie hoort te betekenen: de modus
       stond scherp, de route liep LANGS het injectiepunt, en er gebeurde niets.
       Wat hier werkelijk aan de hand was, is iets anders: de route KOMT er niet
       langs. /api/bank/pas/bevries en zeven broers schrijven met de gewone
       write-behind save() -- nagelezen in server/kern/bank/passen.js -- en
       raken dus `bijeen()` noch `saveDuurzaam()`.

       Dat maakt het geen bevinding OVER de route maar een uitspraak over zijn
       schrijfweg, en die is scherp: deze twee grenzen bestaan daar niet, want
       een write-behind save heeft geen moment waarop iets half duurzaam is. Wat
       hem WEL bedreigt is een schrijfactie die beloofd en niet bewaard wordt,
       en dat is `schrijf-verloren` -- een andere modus, die deze proef niet
       draait.

       Een 200 bewijst dat de route zijn werk afmaakte, dus was hij niet in de
       bundel: daar zou hij gestorven zijn. Voor sterf-na-commit zit er een rand
       aan: die vuurt alleen als de duurzame schrijfactie ook BEVESTIGD werd,
       dus een route die saveDuurzaam roept op een opslag die niet kan
       bevestigen, komt hier ook terecht. Op sqlite bevestigt hij. */
    if (!gestorven) {
      const deedWerk = r.status >= 200 && r.status < 300;
      return { stand: deedWerk ? 'GEEN_DUURZAME_WEG' : 'GEEN_WERK', statusVanDeAanroep: r.status,
        reden: deedWerk
          ? 'de route gaf ' + r.status + ' en het proces leefde door, dus hij liep niet langs ' +
            'het injectiepunt van ' + grens.modus + ': hij schrijft via de gewone write-behind ' +
            'save(). Deze grens bestaat niet op zijn pad -- wat hem wel bedreigt is een ' +
            'VERLOREN schrijfactie (`schrijf-verloren`), en die draait deze proef niet'
          : 'de oproep kwam niet aan het werk (status ' + r.status + ')',
        geraakt: binnen, buitenDeRoute: buiten, eigenLijf };
    }

    if (grens.grens === 'voor-eerste-mutatie') {
      return { stand: binnen.length === 0 ? 'PROVEN' : 'FAILED', statusVanDeAanroep: 0,
        reden: binnen.length === 0
          ? 'na de herstart is geen enkele collectie van deze route veranderd'
          : binnen.length + ' collectie(s) van deze route veranderden terwijl er niets gemuteerd mocht zijn',
        geraakt: binnen, buitenDeRoute: buiten, eigenLijf };
    }

    /* na-commit-voor-antwoord: de schrijfactie is duurzaam en de klant heeft
       niets gehoord. De belofte is dus niet "er staat niets" maar "een tweede
       poging legt er niets bovenop" -- en die vraag mag alleen gesteld worden
       aan een route die zich idempotent NOEMT. Bij de rest hoort een tweede
       oproep werk te doen, en dan is een verschil geen fout maar de bedoeling. */
    const na2Voor = inhoudsBeeld(map);
    const herhaal = await post(srv.basis, route.pad, lijf, tok);
    const na2 = inhoudsBeeld(map);
    const bijgekomen = schoon(verschil(na2Voor, na2)).filter(vanRoute(route));

    const w = weegHerhaling(bijgekomen.length, route.idempotentie);
    return { stand: w.stand, reden: w.reden, statusVanDeAanroep: 0,
      geraakt: binnen, buitenDeRoute: buiten, eigenLijf,
      herhaling: { status: herhaal.status, bijgekomen } };
  } catch (e) {
    return { stand: 'BLOCKED', reden: 'de ronde brak af: ' + String(e.message).slice(0, 140) };
  } finally {
    try { if (srv && srv.kind) srv.kind.kill('SIGKILL'); } catch (e) {}
    fs.rmSync(map, { recursive: true, force: true });
  }
}

function geldroutes() {
  const g = JSON.parse(fs.readFileSync(path.join(WORTEL, 'GELDDEKKING.json'), 'utf8'));
  let r = (g.rijen || []).filter(x => (x.collecties || []).length);
  if (alleenPad) r = r.filter(x => x.pad === alleenPad);
  if (maxRoutes) r = r.slice(0, maxRoutes);
  return r;
}

async function meet() {
  const routes = geldroutes();
  if (!jsonUit) console.log('\n\x1b[1mDE CRASHPROEF OVER DE GELDROUTES\x1b[0m \x1b[2m(' +
    routes.length + ' route(s) x ' + GRENZEN.length + ' grens)\x1b[0m\n');

  const ongebouwd = GRENZEN.filter(g => !verraad.CATALOGUS.some(v => v.naam === g.modus && v.waar));
  if (ongebouwd.length) throw new Error('geen injectiepunt voor: ' +
    ongebouwd.map(g => g.modus).join(', ') + ' -- deze proef zou dan niets meten');

  if (!jsonUit) process.stdout.write('  herstartruis meten ... ');
  const ruis = await meetHerstartruis();
  if (!jsonUit) console.log(ruis.length + ' collectie(s) die de server uit zichzelf schrijft\n');

  const per = [];
  for (const route of routes) {
    for (const g of GRENZEN) {
      const uit = await ronde(route, g, ruis);
      per.push({ methode: route.methode, pad: route.pad, rol: route.rol, grens: g.grens,
        modus: g.modus, belofte: g.belofte, collecties: route.collecties,
        idempotentie: route.idempotentie, ...uit });
      if (!jsonUit) console.log('  ' + uit.stand.padEnd(17) + route.pad.padEnd(34) +
        '\x1b[2m' + g.grens + '\x1b[0m');
    }
  }

  const telling = {};
  for (const r of per) telling[r.stand] = (telling[r.stand] || 0) + 1;
  return { per, telling, ruis, routes: routes.length, grenzen: GRENZEN.length };
}

/* Het register. De stempel komt uit ./lib/stempel.js -- dezelfde als elk ander
   register, zodat `boomVuil` ook hier betekent wat het overal betekent: deze
   uitslag is gemeten terwijl er ongecommitte code lag, en dan hoort hij niet
   ingecheckt te worden. */
function schrijf(u) {
  const { stempel } = require('./lib/stempel.js');
  const reg = Object.assign({
    soort: 'meting',
    uitleg: 'per geldroute en per crashgrens: wat er van de uitkomst overblijft als het ' +
      'proces op dat moment sterft. De vraag is economisch -- wat staat er in de opslag na ' +
      'de herstart -- en niet wat de route antwoordde, want bij een crash antwoordt hij niet.',
    grens: 'drie dingen die deze proef NIET zegt. (1) Wat een aanbieder buiten de deur al had ' +
      'gecommit ziet hij niet -- dat is EXTERNALLY_RECONCILABLE en dat wacht op een echte ' +
      'aanbieder. (2) Het OORDEEL hangt aan de collecties die GELDDEKKING.json per route ' +
      'declareert; een halve schrijfactie in een collectie die daar niet staat, komt terug in ' +
      '`buitenDeRoute` maar laat de uitslag niet zakken. Die lijst is dus de bovengrens van wat ' +
      'hier te vinden is. (3) Een PROVEN geldt voor DIT lijf op DEZE wereld -- een andere invoer ' +
      'kan een ander pad door de route nemen.',
    stempel: stempel({ instrument: 'scripts/crashproef.js' })
  }, u);
  fs.writeFileSync(path.join(WORTEL, 'CRASHPROEF.json'), JSON.stringify(reg, null, 2) + '\n');
}

if (require.main === module) {
  meet().then(u => {
    if (vastleggen) schrijf(u);
    if (jsonUit) { console.log(JSON.stringify(u, null, 2)); return; }
    if (vastleggen) console.log('\n  CRASHPROEF.json geschreven.');
    console.log('\n  \x1b[1muitslag\x1b[0m');
    for (const [k, v] of Object.entries(u.telling).sort((a, b) => b[1] - a[1]))
      console.log('    ' + k.padEnd(18) + String(v).padStart(4));
    /* ALLEEN FAILED IS EEN BEVINDING. `BLINDE_INJECTIE` stond hier eerst naast,
       en die stand is bewust verdwenen: van buiten is een blinde injectie niet
       te onderscheiden van een route die het injectiepunt niet raakt, want in
       allebei de gevallen komt er een 200 terug. Een stand die nooit eerlijk
       kan worden toegekend, hoort niet in de lijst -- dat is dekking die er
       niet is. Wat overblijft heet GEEN_DUURZAME_WEG en zegt wat er gemeten IS:
       deze route liep niet langs de bundel. */
    const hard = u.telling.FAILED || 0;
    if (hard) { console.log('\n  \x1b[31m' + hard + ' bevinding(en).\x1b[0m'); process.exitCode = 1; }
    else console.log('\n  \x1b[32mGeen bevindingen.\x1b[0m');
  }).catch(e => { console.error(e); process.exitCode = 2; });
}

module.exports = { meet, ronde, meetHerstartruis, weegHerhaling, GRENZEN };
