/* Gedeeld testgereedschap: start een echte server op een GEGARANDEERD vrije
   poort en wacht robuust tot hij gezond is. Zo botsen parallelle of snel
   opeenvolgende tests niet meer op dezelfde poort (de oude oorzaak van
   sporadische "fetch failed"), en kan de suite weer met concurrency draaien. */
const { spawn } = require('node:child_process');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

/* DE BROWSER VOOR EEN SCHERMTOETS, en waarom dit hier staat en niet 32 keer.

   EEN GEVONDEN PAKKET IS NIET HETZELFDE ALS EEN WERKENDE BROWSER, en dat is
   precies waar dit op stukliep. Tweeendertig e2e-bestanden droegen elk een eigen
   `laadPlaywright()` -- in zes verschillende varianten -- die zo begon:

       try { return require('playwright') } catch (e) {}
       try { const eigen = require('../server/lib/browser'); ... } catch (e) {}

   Het pakket staat er, dus de eerste regel slaagt altijd en de tweede werd nooit
   bereikt. Alleen: het pakket wijst naar een chromium-build die er niet staat
   (`chromium-1234` terwijl 1194 geinstalleerd is). Elke toets in die 32
   bestanden viel daardoor om op een INSTALLATIEBANNER van Playwright, en die
   ziet eruit als een omgevingsmelding en niet als een rode toets.

   Wat dat kostte: de zes bestanden die de werktafel bewaken konden niet meer
   zakken. Een hernoeming in de bank (Bedieningspaneel -> Instellingen) stond
   twee commits lang stuk zonder dat iets rood werd -- LAT.md regel 2, een toets
   die je niet hebt zien zakken is geen toets.

   De reparatie is een regel: neem het pakket alleen als zijn binary er ECHT
   staat, en val anders terug op onze eigen driver (server/lib/browser, CDP over
   een pipe, geen dependency). Waar Playwright netjes geinstalleerd is verandert
   er niets. */
/* De vindwijze staat in scripts/lib/scherm.js, want scripts/a11y.js heeft hem
   ook nodig en twee laders van dezelfde browser lopen uiteen (LAT.md regel 4).
   Daar staat ook wat er hier tweeendertig keer misging. */
/* EEN LADER VOOR ALLE SCHERMTOETSEN. laadScherm() was de ene helft van een
   dubbeling en laadBrowser() de andere; ze kwamen uit twee takken die allebei
   dezelfde 94-voudige kopie opruimden. Hier komen ze samen: laadBrowser doet
   het werk (hij probeert te STARTEN, niet te laden), laadScherm is de naam
   waaronder drieendertig toetsen hem al aanroepen. scripts/lib/scherm.js blijft
   bestaan voor scripts/a11y.js, dat buiten test/ draait. */
const { laadBrowser } = require('./browser');
const laadScherm = (opties) => laadBrowser(opties);

// Een vrije poort van het besturingssysteem: bind op 0, lees de toegewezen
// poort, laat hem meteen weer los en geef hem door aan de kindserver.
function vrijePoort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.unref();
    s.on('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const p = s.address().port;
      s.close(() => resolve(p));
    });
  });
}

/* Start server/server.js (of een ander script) en wacht tot hij gezond is.
   Geeft { child, base, port } terug. Gooit als de server niet gezond wordt.

   Belangrijk: tussen het vrijgeven van de poort en het binden door de kindserver
   zit een gaatje waarin een parallelle test dezelfde poort kan krijgen. Dan
   antwoordt op onze poort de server van een ANDERE test (met andere env!) en
   crasht ons eigen kind op EADDRINUSE. Daarom checken we via /api/health dat de
   pid van de antwoordende server echt ons kind is, en proberen we bij een
   verloren poort gewoon opnieuw op een verse poort. */
async function startServer(opts = {}) {
  let laatste;
  for (let poging = 0; poging < 3; poging++) {
    try { return await startEens(opts); }
    catch (e) {
      laatste = e;
      if (!/stopte tijdens opstarten/.test(e.message)) throw e; // echte startfout: niet maskeren
    }
  }
  throw laatste;
}

/* Strenge poort: een geslaagde test mag de server nooit een echte fout laten
   loggen -- een uncaughtException, een niet-opgevangen belofte (unhandledRejection),
   of een onverwachte 5xx uit een route (een geworpen fout -> 500). Die glippen
   anders stil door, want de test checkt alleen zijn eigen verzoeken. We lezen de
   stderr van elke kind-server mee, tonen hem gewoon, en onthouden zulke regels.
   Aan het eind van de testrun faalt het proces (exit 1) als er ook maar één is
   geweest. Client-invoerfouten (400/413 via de express error-middleware) tellen
   NIET mee -- die markeert de server niet als serverfout -- zodat normale negatieve
   tests gewoon blijven werken. */
const serverUitzonderingen = [];
const FATAAL = /"bron":"(uncaughtException|unhandledRejection)"|"serverfout":true/;
let poortGewapend = false;
function wapenStrengePoort() {
  if (poortGewapend) return;
  poortGewapend = true;
  process.on('exit', () => {
    if (!serverUitzonderingen.length) return;
    /* WELK TOETSBESTAND, en dat stond er niet. In een volle, parallelle run
       schrijven tientallen kindprocessen door elkaar heen; deze melding kwam dan
       tussen de regels van vier andere bestanden terecht en de TAP-uitslag zei
       alleen "not ok test/x.test.js -- exitCode 1", terwijl al zijn subtoetsen
       ok waren. Dat kost een half uur zoeken in een logbestand van 55.000
       regels, en dat is een keer gebeurd: twee bestanden leken flaky onder
       belasting en waren in werkelijkheid slachtoffer van EEN ontbrekende naam
       in GRENZEN.json. Een meter die niet zegt waar hij aansloeg, laat je de
       verkeerde oorzaak verzinnen (LAT.md regel 1). */
    const wie = require('path').basename(process.argv[1] || 'onbekend');
    process.stderr.write('\n[31mSTRENGE POORT (' + wie + '): ' + serverUitzonderingen.length +
      ' server-uitzondering(en) tijdens de tests (uncaught/unhandled). De run faalt.[0m\n');
    for (const r of serverUitzonderingen.slice(0, 10)) process.stderr.write('  - ' + r + '\n');
    if (serverUitzonderingen.length > 10)
      process.stderr.write('  ... en nog ' + (serverUitzonderingen.length - 10) + ' die hier niet passen\n');
    if (!process.exitCode) process.exitCode = 1;
  });
}
function luisterOpFouten(child) {
  wapenStrengePoort();
  let rest = '';
  child.stderr.on('data', (buf) => {
    process.stderr.write(buf); // gewoon tonen, net als 'inherit'
    rest += buf.toString();
    const regels = rest.split('\n'); rest = regels.pop();
    for (const regel of regels) if (FATAAL.test(regel)) serverUitzonderingen.push(regel.trim().slice(0, 300));
  });
}

/* HOEVEEL GEDULD BIJ EEN OPSTART -- op EEN plek, want hij stond er twee keer.

   De schaling hieronder woonde binnen startEens(). test/domeinalleen.test.js
   start zijn servers zelf (hij zet RTG_DOMAINS en kan de helper dus niet
   gebruiken) en had een eigen wacht met een VASTE 25000 ms -- precies het getal
   dat hier al als te krap staat opgeschreven. Op 19 augustus 2026 zakte hij
   daarop in een volle suite, met een levend kindproces en een belasting van 8,5
   op vier kernen; los gedraaid op een rustige machine drie keer groen. Dat is
   dezelfde fout die deze schaling ooit heeft opgelost, in een tweede kopie
   (LAT.md regel 4: een regel op twee plekken loopt uit elkaar).

   De eerste versie deed Math.round(druk), en dat was te grof: bij een
   genormaliseerde belasting van 0,7 tot 0,9 -- een machine die bijna vol staat
   -- rondde dat af op 1 en bleef het geduld op 25 seconden. Zeventig toetsen
   zakten daarop, allemaal met een LEVEND kindproces. Een server die opstart doet
   echt werk (SQLite, seed, sleutels), dus "bijna vol" is al genoeg om hem over
   de grens te duwen. Vandaar 1 + druk: elke bezette kern telt meteen mee in
   plaats van pas bij een hele. */
function opstartGeduld(basisMs) {
  const kernen = Math.max(1, os.cpus().length);
  const druk = os.loadavg()[0] / kernen;                       // 1 = precies vol
  const extra = Math.min(5, Math.max(1, Math.ceil(1 + druk)));
  return { druk, kernen, extra, ms: (basisMs || 25000) * extra };
}

async function startEens(opts) {
  const script = opts.script || path.join(__dirname, '..', 'server', 'server.js');
  // Standaard wachten op /api/ready, niet alleen /api/health: sinds de
  // opslag-poortwachter geeft de server 503 op alle API's tot de opslag echt
  // geladen is (belangrijk in Postgres-modus), en een test die meteen na
  // "gezond" een API aanroept zou daarop stranden.
  const wachtPad = opts.wachtPad || '/api/ready';
  /* HOE LANG WACHTEN WE, EN WAT ZEGGEN WE ALS HET NIET LUKT.

     Deze grens is al twee keer opgehoogd (15s -> 25s) en werd allebei de keren
     opgehoogd om dezelfde reden: onder volle belasting boot een server trager
     dan de teller toestond. Dat is geen defect maar drukte, en toch stond er dan
     "server werd niet gezond" -- een zin die leest als "de server is stuk". Die
     ene zin heeft in deze codebase inmiddels meer dan een uur zoekwerk gekost
     naar een fout die er niet was.

     Twee dingen zijn daarom veranderd. Het geduld schaalt nu mee met de
     belasting van de machine (zie opstartGeduld hierboven): de basis is 25
     seconden en de factor loopt met de druk mee, tot vijf keer op een machine
     die vol staat. Die factor is minimaal twee zodra er uberhaupt iets draait --
     `Math.ceil(1 + druk)` -- en dat is met opzet: een boot doet echt werk. Hier
     stond nog "op een rustige machine blijft het 25 seconden", en dat klopte
     sinds die wijziging niet meer. En als het dan alsnog niet
     lukt, ZEGT de fout wat er aan de hand was -- leefde het kindproces nog, hoe
     lang is er gewacht, en hoe zwaar stond de machine. Een levend kind plus een
     hoge belasting is drukte; een gestopt kind is een echt defect. Dat verschil
     hoort in de melding te staan en niet in het hoofd van wie hem leest. */
  const { druk, extra } = opstartGeduld();
  const pogingen = opts.pogingen || 250 * extra;
  const gestart = Date.now();
  const port = await vrijePoort();
  const base = 'http://127.0.0.1:' + port;
  // Zonder eigen stderr-optie vangen we de stderr op (pipe) om de strenge poort te
  // voeden; met een expliciete optie (een test die stderr zelf inspecteert) blijft
  // het gedrag ongewijzigd.
  const eigenStderr = opts.stderr && opts.stderr !== 'inherit';
  /* ISOLATIE IS DE STANDAARD, GEEN AFSPRAAK.

     Elke toets hoorde zelf een verse RTG_DATA_DIR mee te geven, en dat deden er
     acht niet. Die acht draaiden dus op server/data/ -- de ECHTE datamap van de
     ontwikkelinstallatie. Twee gevolgen, allebei stil: de toets vervuilt de
     installatie (aannames, sollicitaties, leden), en de installatie vervuilt de
     toets. Zo zakte test/menselijkebanen.test.js op "KIKUNOI: 3 mensen terwijl
     de seed er 2 belooft" -- de derde was een aanname die een EERDERE testronde
     in de echte datamap had achtergelaten. Vijf commits terug gezocht naar een
     oorzaak die in geen enkele commit zat.

     Een regel die alleen werkt als iedereen hem onthoudt, is een voornemen
     (LAT.md). Dus krijgt elke kindserver nu STANDAARD een eigen verse map, en
     wordt die bij het einde van het kind opgeruimd. Wie juist WIL delen -- een
     herstart-toets, een multi-instance-toets -- geeft RTG_DATA_DIR expliciet
     mee, precies zoals die toetsen altijd al deden; en staat hij in de
     omgeving van de aanroeper (een losse run met RTG_DATA_DIR=...), dan wint
     die ook. */
  const eigenMap = (opts.env && ('RTG_DATA_DIR' in opts.env)) || process.env.RTG_DATA_DIR
    ? null : fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-toets-'));
  const child = spawn(process.execPath, [script], {
    /* RTG_TOETS: welke toets deze server start. De server schrijft dat mee in
       het schermjournaal, zodat scripts/schermen.js een VEEGTOETS (een die
       honderd schermen even aantikt) kan onderscheiden van een toets die de
       weg van een app werkelijk aflegt. Zonder die naam zag dat journaal
       alleen "geopend", en dan staat de meter na de eerste veegronde op nul en
       zegt hij voorgoed "in orde" -- precies de vorm waar LAT-regel 10 voor
       waarschuwt. */
    env: {
      // toetsen doorlopen de hele herstelstroom; op een echte server staat
      // deze vlag uit en komt er nooit een link of code in een antwoord
      RTG_DEV_LINKS: '1',
      /* De meeste toetsen leunen op de demo-stand (vaste inlog, bekend
         eigenaarsaccount). Op een echte server staat die UIT tenzij iemand hem
         aanzet -- hij stond aan zolang NODE_ENV niet gezet was, en dat zette het
         wachtwoord van de eigenaar bij elke start terug op een waarde uit de repo.

         MAAR NIET IN EEN PRODUCTIETOETS. Wie NODE_ENV=production meegeeft wil
         juist bewijzen dat de grendels dichtzitten, en de config weigert dan
         terecht te starten met RTG_DEMO=1. Deze standaard zette zulke toetsen
         stil om. */
      ...(((opts.env || {}).NODE_ENV) === 'production' ? {} : { RTG_DEMO: '1' }),
      ...process.env, NODE_ENV: 'test',
      RTG_TOETS: path.basename(String(process.argv[1] || 'onbekend')),
      ...(eigenMap ? { RTG_DATA_DIR: eigenMap } : {}),
      ...(opts.env || {}), PORT: String(port)
    },
    stdio: ['ignore', 'ignore', eigenStderr ? opts.stderr : 'pipe']
  });
  if (!eigenStderr) luisterOpFouten(child);
  /* De eigen map gaat weg zodra het kind weg is -- ook bij SIGKILL, want 'exit'
     vuurt altijd. Alleen wat de helper zelf aanmaakte; een meegegeven map is
     van de toets en blijft van de toets. */
  if (eigenMap) child.on('exit', () => {
    try { fs.rmSync(eigenMap, { recursive: true, force: true }); } catch (e) { /* al weg */ }
  });
  for (let i = 0; i < pogingen; i++) {
    if (child.exitCode != null) throw new Error('server stopte tijdens opstarten (exit ' + child.exitCode + ')');
    try {
      const r = await fetch(base + '/api/health', { headers: { 'X-Forwarded-Proto': 'https' } });
      if (r.ok) {
        const d = await r.json().catch(() => ({}));
        if (d.pid === child.pid) {
          // echt onze server; eventueel nog even wachten op het gevraagde pad
          if (wachtPad !== '/api/health') {
            for (let j = 0; j < 50; j++) {
              const w = await fetch(base + wachtPad, { headers: { 'X-Forwarded-Proto': 'https' } }).catch(() => null);
              if (w && w.ok) break;
              await new Promise(r2 => setTimeout(r2, 100));
            }
          }
          return { child, base, port };
        }
        // een vreemde server op onze poort: ons kind gaat zo op EADDRINUSE af,
        // de exitCode-check hierboven vangt dat en we beginnen op een verse poort
      }
    } catch (e) { /* nog niet op; opnieuw proberen */ }
    await new Promise(r => setTimeout(r, 100));
  }
  const leefde = child.exitCode == null;
  const seconden = Math.round((Date.now() - gestart) / 1000);
  const nu1 = (os.loadavg()[0] / kernen).toFixed(1);
  try { child.kill('SIGKILL'); } catch (e) {}
  throw new Error('server werd niet gezond op ' + base
    + ' na ' + seconden + 's; het kindproces ' + (leefde ? 'LEEFDE nog' : 'was al gestopt')
    + ', belasting ' + nu1 + 'x de kernen'
    /* De grens voor "dit is drukte" ligt bewust LAAG (0,6 van de kernen) en niet
       op 1. Een machine hoeft niet vol te staan om een opstartende server over
       de 25 seconden te duwen; bij 0,7 gebeurde het al zeventig keer. Liever een
       keer ten onrechte "drukte" suggereren dan iemand een uur laten zoeken naar
       een defect dat er niet is -- dat is hier al twee keer gebeurd. */
    + (leefde && Number(nu1) > 0.6
      ? ' -- dit ziet eruit als DRUKTE, niet als een defect: draai deze toets los om het te bevestigen.'
      : ''));
}

/* EEN STOP DIE STIL NIETS DOET, IS GEEN STOP.

   Hier stond `if (child) try { child.kill('SIGKILL'); } catch (e) {}`. Wie het
   hele resultaat van startServer meegaf -- `stop(srv)` in plaats van
   `stop(srv.child)` -- raakte een object zonder .kill: de TypeError verdween in
   de catch en de server bleef gewoon draaien. De testrunner wacht dan op een
   kindproces dat niemand doodt, en de toets "hangt" zonder dat er iets stuk is.
   Dat is me met test/wings.e2e.js precies overkomen (dat bestand is er niet meer,
   de wings zijn verwijderd; de les eronder blijft) en het kostte twee runs van
   een kwartier voordat ik doorhad dat het aan de aanroep lag.

   Nu accepteert hij beide vormen (het kind of het hele resultaat), en een
   argument waar niets mee te stoppen valt is een FOUT in plaats van stilte. De
   catch blijft alleen om een proces dat al weg is, en dat is geen probleem. */
function stop(watDanOok) {
  if (!watDanOok) return;
  const kind = typeof watDanOok.kill === 'function' ? watDanOok
    : (watDanOok.child && typeof watDanOok.child.kill === 'function' ? watDanOok.child : null);
  if (!kind) throw new TypeError('stop() kreeg iets zonder .kill: geef het kindproces mee (of het resultaat van startServer).');
  try { kind.kill('SIGKILL'); } catch (e) { /* al weg: prima */ }
}

/* Een NETTE stop: SIGTERM, en wachten tot het proces echt weg is.

   Het verschil met stop() is geen detail. SIGKILL is een stroomstoring: de
   server krijgt geen kans zijn write-behind te spoelen. SIGTERM is een DEPLOY:
   hij hoort zijn laatste staat weg te schrijven voordat hij afsluit. Wie het
   verschil niet maakt, toetst met een stroomstoring een garantie die alleen
   over herstarts gaat -- of andersom, en dan slaagt de toets om de verkeerde
   reden.

   Wacht ten hoogste `ms` en pakt daarna alsnog door met SIGKILL, zodat een
   hangende afsluiting de suite niet laat staan. */
function stopNet(child, ms) {
  return new Promise(resolve => {
    if (!child || wegAl(child)) return resolve();
    let klaar = false;
    const af = () => { if (!klaar) { klaar = true; resolve(); } };
    child.on('exit', af);
    try { child.kill('SIGTERM'); } catch (e) { return af(); }
    setTimeout(() => { try { child.kill('SIGKILL'); } catch (e) {} af(); }, ms || 15000).unref();
  });
}

/* IS DIT KIND AL WEG? `exitCode` alleen is niet genoeg.

   Een proces dat door een SIGNAAL stierf houdt `exitCode === null` en zet
   `signalCode` (bijvoorbeeld 'SIGKILL'). Wie alleen naar exitCode kijkt, denkt
   dus dat zo'n kind nog leeft, hangt zijn `exit`-luisteraar op aan een proces
   dat al weg is, en wacht op een gebeurtenis die nooit meer komt. Node meldt dat
   als "Promise resolution is still pending but the event loop has already
   resolved" -- en de hele toets wordt geannuleerd in plaats van rood.

   Dat is hier ook echt gebeurd, bij test/herstelproef.test.js: die stopt zijn
   servers met een signaal en daarna nog een keer via de opruimer. */
function wegAl(child) {
  return child.exitCode != null || child.signalCode != null || child.killed && !child.connected && child.pid == null;
}

/* EEN HARDE stop, en WACHTEN tot hij weg is.

   Het spiegelbeeld van stopNet(). stopNet is een deploy: SIGTERM, en de server
   spoelt zijn write-behind nog weg. stopHard is een STROOMSTORING: SIGKILL, dus
   niets wordt afgemaakt -- en dat is precies wat een duurzaamheidsproef wil
   toetsen. Het verschil met stop() is dat deze WACHT tot het proces echt weg is.

   Waarom dat verschil ertoe doet: na stop() liep er in de toetsen steevast een
   `setTimeout(300)` met de opmerking "laat de OS-poort echt vrijkomen". Die
   reden klopte niet eens (startServer pakt elke keer een verse vrije poort),
   maar er zat wel een echte eis onder: zolang het oude proces nog leeft heeft
   het de datamap nog vast, en dan start de volgende server op een half
   afgesloten sqlite. 300 ms was daarvoor een gok; `exit` is het teken. */
function stopHard(child, ms) {
  return new Promise(resolve => {
    if (!child || wegAl(child)) return resolve();
    let klaar = false;
    const af = () => { if (!klaar) { klaar = true; resolve(); } };
    child.on('exit', af);
    try { child.kill('SIGKILL'); } catch (e) { return af(); }
    // SIGKILL is niet te weigeren; deze kap is er alleen voor het geval het
    // handvat niet meer bij het proces hoort (al opgeruimd, of overschreven).
    setTimeout(af, ms || 10000).unref();
  });
}

function postJson(base) {
  return (pad, body, tok) => fetch(base + pad, {
    method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
    body: JSON.stringify(body || {}) }).then(r => r.json());
}

/* EEN BACKOFFICE-SESSIE MET EEN NAAM ERAAN.

   De gedeelde kantoorcode wijst niemand aan. Sinds een Lifestyle- of Business
   Pass uitsluitend door een herleidbaar persoon wordt toegekend, is die code
   voor die twee passen niet meer genoeg (403). Dit hulpje loopt de weg die een
   personeelslid in productie ook loopt: inloggen op zijn EIGEN RTG-account en
   daarmee de backoffice in.

   Dit staat hier los omdat twee plekken hem nodig hebben (elevateTier en het
   proefpubliek in gezelschap.js). Twee kopieen van dezelfde weg lopen uiteen
   zodra de inlog verandert -- LAT.md regel 4. Geeft null als het niet lukt, zodat
   de aanroeper zelf kan besluiten wat dat betekent. */
async function kantoorAlsPersoon(base) {
  const post = postJson(base);
  const eig = await post('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' });
  if (!eig || !eig.token) return null;
  const kantoor = await post('/api/account/start', { rol: 'kantoor' }, eig.token);
  return (kantoor && kantoor.token) || null;
}

/* Een lid naar Lifestyle of Business tillen, zoals het in het echt gaat: een
   aanvraag, en daarna het menselijke besluit.

   DE APPROVER MOET EEN PERSOON ZIJN. Veertien toetsbestanden gebruiken dit
   hulpje, en ze gaven er allemaal de GEDEELDE kantoorcode aan mee. Sinds die
   twee passen alleen nog door een herleidbaar persoon worden toegekend (de
   merkregel: uitsluitend na menselijke goedkeuring, en een gedeelde code is
   geen mens) levert dat een 403. Kreeg dit hulpje geen bruikbare approver, dan
   haalt hij hier zelf de eigenaar erbij -- dat is wie het in productie ook zou
   doen, en het houdt veertien toetsbestanden op een echt scenario in plaats van
   op een omweg. */
async function elevateTier(base, memberToken, pas, approverToken) {
  const post = postJson(base);
  const aanvraag = await post('/api/aanmelding/aanvraag', { pas, naam: 'Test ' + pas, contact: pas + '@test.example' }, memberToken);
  const id = aanvraag.aanmelding && aanvraag.aanmelding.id;
  if (!id) throw new Error('elevateTier: aanvraag mislukt (' + JSON.stringify(aanvraag).slice(0, 120) + ')');
  let goedkeurder = approverToken;
  if (pas === 'lifestyle' || pas === 'business') goedkeurder = (await kantoorAlsPersoon(base)) || approverToken;
  const besluit = await post('/api/aanmelding/beslis', { id, besluit: 'geaccepteerd' }, goedkeurder);
  if (!besluit.aanmelding || besluit.aanmelding.status !== 'geaccepteerd')
    throw new Error('elevateTier: beslis mislukt (' + JSON.stringify(besluit).slice(0, 120) + ')');
  return besluit;
}

/* Paginafouten verzamelen, zonder de ruis van de browser zelf.

   De site zet zachte overgangen tussen pagina's aan met @view-transition in
   shared/rtg-uniform.css. Die overgang maakt de BROWSER; wij krijgen hem pas
   te zien in het pagereveal-event, en dat vuurt voordat ons eerste script
   draait. Slaat de browser zo'n overgang over -- een tweede navigatie er
   meteen achteraan, of een tabblad dat niet zichtbaar is -- dan verwerpt de
   ready-promise van die overgang met "Transition was skipped". Niemand van
   ons heeft die promise gemaakt, dus niemand kan hem opvangen, en Playwright
   meldt hem als paginafout.

   Het is geen fout. De navigatie is gewoon gebeurd; alleen de animatie viel
   weg. Het is bovendien een race: welke test erop struikelt verschilt per
   run. Hem meetellen als "JS-fout op de pagina" maakt de tests onbetrouwbaar
   zonder ook maar iets te bewaken. Alles wat WEL uit onze code komt telt
   onverkort mee -- dit filter noemt precies een bericht, geen patroon. */
const BROWSERRUIS = ['Transition was skipped'];
function letOpFouten(page, bak) {
  /* De eigen browserdriver (server/lib/browser.js) heeft geen .on. Vroeger stond
     bij elke aanroeper `if (page.on)` ervoor; nu staat die vraag hier, op een
     plek. Zonder dit zou de omzetting naar dit hulpje die toetsen laten vallen
     op precies de driver waar ze het soepelst mee moesten omgaan. */
  if (!page || typeof page.on !== 'function') return bak;
  page.on('pageerror', (e) => {
    const bericht = String((e && e.message) || e);
    if (!BROWSERRUIS.includes(bericht)) bak.push(bericht);
  });
  return bak;
}

/* Voor toetsen die hun server om goede redenen ZELF starten (eigen poort, eigen
   sleutels, een tweede instance): geef het kindproces hier af en de strenge poort
   leest zijn stderr alsnog mee. Zonder dit valt zo'n server buiten de bewaking en
   telt een crash niet als fout -- in scheiding.test.js gold een 500 daardoor
   zelfs als een geslaagde weigering. Spawn dan wel met stderr op 'pipe'. */
function bewaakKind(kind) { if (kind && kind.stderr) luisterOpFouten(kind); return kind; }


/* ============================================================================
   WACHTEN OP EEN TOESTAND, NIET OP DE KLOK.

   WAAR DIT VANDAAN KOMT. `page.waitForTimeout(2500)` met de opmerking "de
   widgets halen hun bron op" is een gok, en een gok die twee kanten op fout
   gaat: op een rustige machine te lang (de suite duurt onnodig minuten langer)
   en onder belasting te kort (rood zonder dat er iets stuk is). Dat laatste is
   het ergste, want een suite die af en toe rood geeft zonder dat iemand weet
   waarop, wordt binnen een maand genegeerd. Er stonden er 162, verdeeld over
   35 bestanden; twee ervan hebben hier echt een halve dag zoeken gekost
   (TAKEN.md 6.5).

   Wat hieronder staat wacht op wat er MOET GEBEUREN in plaats van op hoe lang
   dat ongeveer duurt. Twee eisen die het bruikbaar maken:

   1. HIJ VERTELT WAAROP HIJ WACHTTE. Een kale "Timeout 15000ms exceeded" laat
      de volgende lezer opnieuw zoeken. Deze gooit met wat er verwacht werd EN
      met de eerste tweehonderd tekens die er wel stonden.
   2. HIJ IS BEGRENSD. Een wacht zonder bovengrens hangt de hele suite op; de
      grens staat hoog genoeg voor een trage machine (RTG_E2E_WACHT om hem te
      verzetten) en is geen verkapte klok: hij gaat af als er iets stuk is, niet
      als het even duurt.
   ========================================================================== */
const WACHT_MS = Number(process.env.RTG_E2E_WACHT || 15000);

async function korteStand(page) {
  try {
    const t = await page.evaluate(() => (document.body ? document.body.innerText : '').replace(/\s+/g, ' ').slice(0, 200));
    return 'wat er wel stond: "' + t + '"';
  } catch (e) { return 'de pagina was niet meer te lezen (' + (e && e.message) + ')'; }
}

/* Wacht tot een uitdrukking in de pagina waar is. `wat` is de zin die in de
   foutmelding komt -- schrijf hem als wat je verwachtte, niet als code. */
async function wachtTot(page, fn, arg, opties) {
  const ms = (opties && opties.ms) || WACHT_MS;
  const wat = (opties && opties.wat) || 'de verwachte toestand';
  /* `polling` gaat door naar Playwright. Standaard kijkt die per ANIMATIEFRAME,
     en dat is te fijn voor een vraag als "ligt dit stil": twee frames vlak na
     elkaar kunnen dezelfde afgeronde plaats geven terwijl de overgang nog loopt.
     Wie op stilstand wacht, geeft hier een tempo mee dat grover is dan de
     beweging -- en telt meerdere gelijke lezingen. */
  const polling = opties && opties.polling;
  try {
    await page.waitForFunction(fn, arg, polling ? { timeout: ms, polling } : { timeout: ms });
  } catch (e) {
    throw new Error('wachtte ' + ms + 'ms op ' + wat + ', en die kwam niet. ' + (await korteStand(page)) +
      '\n  onderliggend: ' + String((e && e.message) || e).split('\n')[0]);
  }
}

/* Wacht tot een patroon in de zichtbare tekst staat. Standaard in de hele
   pagina; `in` beperkt het tot een selector. */
async function wachtOpTekst(page, patroon, opties) {
  const bron = patroon instanceof RegExp ? patroon.source : String(patroon).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const vlaggen = patroon instanceof RegExp ? patroon.flags.replace(/g/g, '') : 'i';
  const sel = (opties && opties.in) || 'body';
  await wachtTot(page, ([b, v, s]) => {
    const el = document.querySelector(s);
    if (!el) return false;
    return new RegExp(b, v).test(String(el.innerText || el.textContent || '').replace(/\s+/g, ' '));
  }, [bron, vlaggen, sel], { ms: opties && opties.ms, wat: 'tekst ' + patroon + ' in ' + sel });
}

/* Wacht tot de tekst van een element VERANDERT ten opzichte van wat er stond.

   Dit is de wacht voor het geval waarin je niet kunt zeggen wat er komt: een
   melding die ook leeg kan blijven, een lijst die korter wordt, een antwoord
   waarvan de toets juist wil controleren dat het NIET iets zegt. Op de tekst
   wachten die je verwacht kan daar niet -- dus wacht je op het moment dat het
   scherm iets nieuws heeft gezegd. Neem de oude tekst op met tekstVan(). */
async function wachtOpVerandering(page, selector, oud, opties) {
  await wachtTot(page, ([s, o]) => {
    const el = document.querySelector(s);
    if (!el) return false;
    return String(el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim() !== o;
  }, [selector, String(oud || '').replace(/\s+/g, ' ').trim()],
  { ms: opties && opties.ms, wat: 'een nieuwe tekst in ' + selector });
}

/* WACHTEN TOT HET SCHERM STIL IS -- de enige eerlijke vervanger van "even 800ms".

   Waarom dit nodig is naast wachten op een antwoord: een scherm dat een antwoord
   krijgt, tekent zichzelf daarna opnieuw, en soms haalt het onderweg nog iets.
   Wie tussen die twee in typt, ziet zijn invoer verdwijnen -- en stuurt lege
   velden mee. Dat is precies waar de Living Lab-toets op omviel toen de vaste
   wachttijden eruit gingen: het scherm zei "Wat heeft u waargenomen?" over een
   veld dat de toets aantoonbaar had gevuld.

   Stil betekent hier twee dingen tegelijk: er loopt geen verzoek meer, EN de
   tekst is tussen twee pollingrondes niet veranderd. Dat is geen verkapte klok:
   duurt het langer, dan wacht hij langer; is het meteen klaar, dan gaat hij
   meteen door. volgVerzoeken() moet vóór de eerste goto worden aangeroepen,
   want hij hangt een teller om window.fetch. */
async function volgVerzoeken(page) {
  await page.addInitScript(() => {
    window.__rtgBezig = 0;
    /* De ADRESSEN erbij, en niet alleen de teller. Blijft een wacht hangen op
       "er loopt nog een verzoek", dan is de teller alleen een getal en moet je
       gaan raden welk verzoek; met de lijst staat het in de foutmelding. Dat is
       dezelfde regel als bij de gezakte toets: noem hem bij naam. */
    window.__rtgInVlucht = [];
    const echt = window.fetch;
    window.fetch = function (...args) {
      const waar = String((args[0] && args[0].url) || args[0] || '');
      window.__rtgBezig++;
      window.__rtgInVlucht.push(waar);
      return echt.apply(this, args).finally(() => {
        window.__rtgBezig--;
        const i = window.__rtgInVlucht.indexOf(waar);
        if (i >= 0) window.__rtgInVlucht.splice(i, 1);
      });
    };
  });
}

/* WAT HIELD HET SCHERM BEZIG -- de helft van een wachtmelding die er niet was.
   "Het werd niet stil" zegt niet of er nog een verzoek liep, en welk. */
async function watHieldHemBezig(page) {
  try {
    return await page.evaluate(() => 'op ' + location.pathname + ' liepen er ' + (window.__rtgBezig || 0) +
      ' verzoeken' + (window.__rtgInVlucht && window.__rtgInVlucht.length
        ? ' (' + window.__rtgInVlucht.slice(0, 4).join(', ') + ')' : '') + '.');
  } catch (e) { return 'de stand was niet meer te lezen (' + (e && e.message) + ').'; }
}

/* `rondes` is het aantal opeenvolgende gelijke lezingen dat nodig is voordat
   iets "stil" heet. Standaard een; hoger als het scherm een eigen wachttijd
   heeft die je moet overleven -- shared/deelmenu.js bouwt bijvoorbeeld pas 120 ms
   NA de laatste wijziging, en dan is een enkele gelijke ronde te vroeg. Dat is
   geen verkapte klok: elke ronde die niet gelijk is, zet de teller terug, dus
   hij wacht net zo lang als het scherm nodig heeft. */
let rustMerkTeller = 0;
async function wachtOpRust(page, selector, opties) {
  const ms = (opties && opties.ms) || WACHT_MS;
  const rondes = Math.max(1, (opties && opties.rondes) || 1);
  /* EEN MERK PER WACHT, en het woont in het DOCUMENT. Hier stond een aparte
     `page.evaluate` die de vorige lezing wiste voordat de wacht begon -- nodig,
     want anders vergelijkt de eerste ronde met de tekst waarop de VORIGE wacht
     eindigde en is hij meteen "stil". Maar die evaluate viel om als de pagina
     precies dan navigeerde, en de vangst hieronder maakte daar een verzonnen
     time-out van. Met een merk in het document doet de wacht het zelf: klopt het
     merk niet -- eerste ronde, of een NIEUW document na een omleiding -- dan
     begint de telling opnieuw. Een omleiding overleeft de wacht dus in plaats
     van hem te laten liegen, en er is een evaluate minder om over te struikelen. */
  const merk = 'rust-' + (++rustMerkTeller);
  try {
    await page.waitForFunction(([s, n, m]) => {
      if (window.__rtgRustMerk !== m) {
        window.__rtgRustMerk = m; window.__rtgVorigeTekst = '\u0000nog-niet-gelezen'; window.__rtgStil = 0;
      }
      if (window.__rtgBezig) { window.__rtgStil = 0; return false; }
      const el = s ? document.querySelector(s) : document.body;
      if (!el) { window.__rtgStil = 0; return false; }
      const nu = String(el.innerText || '');
      const zelfde = window.__rtgVorigeTekst === nu;
      window.__rtgVorigeTekst = nu;
      window.__rtgStil = zelfde ? (window.__rtgStil || 0) + 1 : 0;
      return window.__rtgStil >= n;
    }, [selector || null, rondes, merk], { timeout: ms, polling: 100 });
  } catch (e) {
    /* EN DE ECHTE FOUT GAAT MEE. Deze vangst zei altijd "het werd niet stil",
       ook als de wacht was omgevallen op iets heel anders -- een vernielde
       context bij een omleiding bijvoorbeeld. Dat is precies het soort melding
       waar een halve dag in gaat zitten: hij leest als een diagnose en is er
       geen. */
    throw new Error('wachtte ' + ms + 'ms tot ' + (selector || 'het scherm') +
      ' stil was (geen lopend verzoek, geen hertekening), en dat werd het niet. ' +
      (await watHieldHemBezig(page)) + ' ' + (await korteStand(page)) +
      '\n  onderliggend: ' + String((e && e.message) || e).split('\n')[0]);
  }
}

/* WACHTEN TOT DE PAGINA UITGEPRAAT IS -- geen nieuw verzoek meer.

   Dit is de tegenhanger van wachtOpRust voor het geval waarin je NIET weet
   waarop je wacht: een scan die elk scherm opent en alleen wil weten of er
   onderweg iets omvalt. Zo'n scan heeft geen enkel teken om op te wachten, want
   elk scherm heeft een ander teken. Daar stond dan ook jarenlang een vaste
   `setTimeout(900)`: lang genoeg voor de meeste, en op een trage machine
   precies te kort voor de schermen waar het om gaat.

   Het teken dat er wel is, is het GEDRAG van de pagina: zolang hij nog verzoeken
   afvuurt is hij bezig, en zodra er `stilMs` lang geen NIEUW verzoek meer
   begint, is hij uitgepraat. Dat is een toestand en geen duur -- op een trage
   machine wacht hij vanzelf langer, en op een snelle is hij eerder klaar dan de
   900 ms die er stond.

   Waarom "geen nieuw verzoek BEGINT" en niet "geen verzoek meer OPEN"
   (Playwrights networkidle): de apps houden een SSE-lijn open, en die telt bij
   networkidle voor altijd mee als lopend verkeer. Dan wacht je bij elk scherm de
   volle kap uit en is de scan tien keer trager zonder iets extra's te zien.

   `maxMs` is een kap en geen wacht: een pagina die blijft pollen (een tikker die
   elke seconde iets ophaalt) wordt anders nooit stil. Hij komt dan gewoon terug;
   de scan doet zijn beweringen daarna. */
function wachtOpNetstilte(page, opties) {
  const stilMs = (opties && opties.stilMs) || 400;
  const maxMs = (opties && opties.maxMs) || 6000;
  return new Promise((klaar) => {
    let af = false, stilte = null;
    const eind = () => {
      if (af) return;
      af = true;
      clearTimeout(stilte); clearTimeout(kap);
      try { page.off('request', tik); } catch (e) { /* pagina al dicht */ }
      klaar();
    };
    const tik = () => { clearTimeout(stilte); stilte = setTimeout(eind, stilMs); };
    const kap = setTimeout(eind, maxMs);
    page.on('request', tik);
    tik();
  });
}

/* Klik, en wacht op het ANTWOORD VAN DE SERVER in plaats van op een geschatte
   duur. Voor de gevallen waarin niet vooraf te zeggen is wat er op het scherm
   komt (een lijst die vult, een melding die ook leeg kan blijven): de handeling
   is klaar zodra het verzoek dat hij afvuurt beantwoord is.

   `urlDeel` is een stuk van het pad, bijvoorbeeld '/horeca/hotel/open'. Zonder
   dat wacht hij op het eerstvolgende POST-antwoord van de eigen API -- ruim
   genoeg voor een scherm dat er maar een afvuurt, en te ruim voor een scherm
   dat er drie doet; noem in dat geval het pad. */
async function klikEnWacht(page, selector, urlDeel, opties) {
  const ms = (opties && opties.ms) || WACHT_MS;
  const deel = urlDeel || '/api/';
  try {
    const [antwoord] = await Promise.all([
      page.waitForResponse((r) => r.url().includes(deel) && r.request().method() !== 'GET', { timeout: ms }),
      page.click(selector)
    ]);
    return antwoord;
  } catch (e) {
    throw new Error('klikte op ' + selector + ' en wachtte ' + ms + 'ms op een antwoord van ' + deel +
      ', dat niet kwam. ' + (await korteStand(page)));
  }
}

async function tekstVan(page, selector) {
  return page.evaluate((s) => {
    const el = document.querySelector(s);
    return el ? String(el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim() : '';
  }, selector);
}

/* Wacht tot een element zichtbaar is (of juist verborgen). Werkt ook op
   elementen die met `hidden` worden geschakeld, en dat is hier de gewone
   manier: de apps zetten hele blokken aan en uit. */
async function wachtOpZichtbaar(page, selector, opties) {
  const weg = !!(opties && opties.weg);
  await wachtTot(page, ([s, w]) => {
    const el = document.querySelector(s);
    const zichtbaar = !!el && !el.hidden && el.offsetParent !== null;
    return w ? !zichtbaar : zichtbaar;
  }, [selector, weg], { ms: opties && opties.ms, wat: selector + (weg ? ' verdwenen' : ' zichtbaar') });
}


/* EEN BEWERING OVER "VANDAAG" GELDT MAAR BINNEN EEN KALENDERDAG.

   Drie toetsen rekenden een datum uit (morgen, een verjaardag, "over negen
   dagen") en lieten de server daarna hetzelfde uitrekenen. Loopt de run over
   middernacht heen -- en een volle suite duurt twintig minuten, dus dat gebeurt
   een keer per etmaal -- dan rekent de toets vanaf de oude dag en de server
   vanaf de nieuwe. De uitslag was dan rood zonder dat er iets stuk was, en
   precies dat maakt een rode uitslag waardeloos: je went eraan.

   binnenEenDag() draait het werk en kijkt of de kalenderdag onderweg is
   omgeslagen. Zo ja, dan draait hij het EEN keer over -- de tweede poging valt
   niet nog eens op dezelfde grens, want die komt pas over vierentwintig uur
   terug. Zo blijft de bewering net zo streng als hij was, zonder de dagelijkse
   valse alarmbel. Slaat hij twee keer om, dan is er iets anders aan de hand en
   hoort de toets gewoon te zakken. */
async function binnenEenDag(werk) {
  const dag = () => new Date().toISOString().slice(0, 10);
  const voor = dag();
  const uit = await werk();
  if (dag() === voor) return uit;
  return werk();   // de dag sloeg om tijdens de eerste poging: een keer overdoen
}

/* Chromium levert met deze schakelaars een echt MediaStream-videotrack zonder
   camera of toestemmingsvenster. Recente macOS-versies proberen voor AUDIO
   soms alsnog de systeemingang te openen; dat vangen we hieronder af. */
function nepMediaArgs() {
  return ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'];
}

/* Installeer vóór de eerste pagina een browser-eigen testmicrofoon. Dit is geen
   kaal testobject: Web Audio maakt een echte live MediaStreamTrack die ook door
   RTCPeerConnection kan. Alleen de audiohardware wordt vervangen; videovragen
   blijven door Chromiums echte getUserMedia-implementatie lopen. Op een
   onveilige http-origin bestaat mediaDevices niet en blijft de productdiagnose
   daardoor ongewijzigd meetbaar. */
async function installeerNepMicrofoon(context) {
  await context.addInitScript(() => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
    const echt = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async function (wensen) {
      wensen = wensen || {};
      if (!wensen.audio) return echt(wensen);
      const sporen = [];
      if (wensen.video) {
        const beeld = await echt({ video: wensen.video, audio: false });
        sporen.push(...beeld.getVideoTracks());
      }
      const AudioMotor = window.AudioContext || window.webkitAudioContext;
      if (!AudioMotor) throw new DOMException('Web Audio ontbreekt', 'NotSupportedError');
      const motor = new AudioMotor();
      const bron = motor.createOscillator();
      const uitgang = motor.createMediaStreamDestination();
      bron.frequency.value = 440;
      bron.connect(uitgang);
      bron.start();
      sporen.push(...uitgang.stream.getAudioTracks());
      return new MediaStream(sporen);
    };
  });
}

/* DE BANK OPENEN, WAT VOOR SCHERM HET OOK IS.

   De bank van de werktafel heeft twee vormen, en dat is ontwerp: op een smal
   scherm ligt hij als lade onder de rand en haal je hem met de greep
   (.cmd-lade); vanaf 1000px staat hij als vaste rail altijd open en is die
   greep er niet (shared/command.css: "de greep heeft hier geen werk").

   Een toets die een deur in de bank nodig heeft, gaat niet over die twee
   vormen. Toch stond in twee toetsen letterlijk `waitForSelector('.cmd-lade',
   {state:'visible'})` -- op de standaardbreedte van Playwright (1280) wacht
   die tien seconden op een knop die daar met opzet niet bestaat, en de
   foutmelding ("resolved to hidden") wijst naar de knop en niet naar de
   aanname eronder. Vandaar dit hulpje: het opent de bank en laat het aan de
   pagina welke van de twee vormen dat is.

   Het GOKT niet. Is de bank er niet, dan gooit het, want dan is er geen
   werktafel en hoort de toets daarop te zakken en niet stil door te lopen. */
async function openBank(page, opties) {
  const t = (opties && opties.timeout) || 10000;
  await page.waitForSelector('#rtgCommand .cmd-bank', { state: 'attached', timeout: t });
  const greep = page.locator('#rtgCommand .cmd-lade');
  if (await greep.isVisible()) {
    await greep.click();
    await page.waitForSelector('#rtgCommand.bank-open', { timeout: t });
    return 'lade';
  }
  // brede stand: de rail staat er al. Even nagaan dat hij ook echt in beeld is.
  await page.waitForSelector('#rtgCommand .cmd-bank', { state: 'visible', timeout: t });
  return 'rail';
}

/* EEN DEUR IN DE VOET VAN DE BANK, OP NAAM.

   Hier stond `click('.cmd-bankvoet [data-systeem]')` -- de EERSTE systeemdeur.
   Dat werkte zolang er één was. Er staan er nu twee (Rahul boven het
   bedieningspaneel), en toen opende diezelfde regel opeens het vraagveld van
   Rahul. De toets faalde daarna een stap verderop, op een scrim die nooit zou
   komen, en de melding wees naar het paneel in plaats van naar de klik.

   Op naam en niet op positie: welke deuren er staan en in welke volgorde is een
   ontwerpkeuze die mag bewegen; WELKE deur deze toets nodig heeft niet. */
async function bankDeur(page, naam, opties) {
  const t = (opties && opties.timeout) || 10000;
  await openBank(page, opties);
  const knop = page.locator('#rtgCommand .cmd-bankvoet button', { hasText: naam });
  await knop.first().waitFor({ state: 'visible', timeout: t });
  await knop.first().click();
}

module.exports = { vrijePoort, startServer, opstartGeduld, stop, stopNet, stopHard, elevateTier, kantoorAlsPersoon, letOpFouten, bewaakKind,
  wachtTot, wachtOpTekst, wachtOpZichtbaar, wachtOpVerandering, wachtOpRust, wachtOpNetstilte, volgVerzoeken, klikEnWacht, tekstVan, WACHT_MS,
  binnenEenDag, nepMediaArgs, installeerNepMicrofoon, openBank, bankDeur,
  // testhaken om de strenge poort zelf te kunnen verifiëren
  _poort: { luisterOpFouten, serverUitzonderingen, isFataal: (r) => FATAAL.test(r) } };
