#!/usr/bin/env node
/* ============================================================================
   DE MUTATIEMOTOR -- kan deze toets eigenlijk zakken?

   WAAROM. LAT.md regel 9: een toets die niet kan zakken is erger dan geen toets,
   want hij geeft dekking zonder dekking te leveren. BEWIJS.md legde bloot hoe
   groot dat gat hier is: van de 612 toetsbestanden noemen er 586 geen enkele
   mutatie. "Noemt geen mutatie" is niet hetzelfde als "kan niet zakken" -- maar
   het betekent wel dat niemand het weet, en dat is precies het probleem dat deze
   motor oplost. Hij MEET het, per bestand.

   TWEE SOORTEN TOETS, TWEE SOORTEN MUTATIE, en dat onderscheid is de hele opzet.

   A. DE PURE TOETSEN (145 van de 544). Die laden een module rechtstreeks
      (`require('../server/kern/pdf')`) en hebben geen server nodig. Voor elk
      zo'n bestand pakken we de module die hij laadt, brengen er EEN mechanische
      verandering in aan, en draaien alleen die toets. Zakt hij: bewezen
      gevoelig. Blijft hij groen na alle operatoren: dan toetst hij het gedrag
      van die module niet, of niet op een plek die deze operatoren raken.
      Snel: geen server, seconden per bestand. Van de 145 laden er 134 een module
      die te muteren is; de andere elf zeggen dat ook in de uitslag.

   B. DE SERVERTOETSEN (399). Die starten een echte server en praten over HTTP.
      Daar is de mutatie de LIEGPOORT die er al staat (server/opzet/liegpoort.js):
      met RTG_LIEG=/api/ geeft elk endpoint een geldig maar leeg antwoord. Een
      toets die dan groen blijft, kijkt nergens naar de inhoud van een antwoord.

      DIT DEEL DUURT UREN, en dat is geen ontwerpfout maar de prijs: elke
      servertoets moet twee keer draaien (een keer eerlijk om vast te stellen dat
      hij groen IS, een keer liegend) en elke ronde start een echte server. Daarom
      houdt de motor zijn voortgang buiten de repo bij (zie VOORTGANG) en slaat
      hij over wat al gemeten is. Afbreken kost niets; --opnieuw doet alles over.

   WAT DEZE MOTOR NIET BEWEERT, en dit hoort er eerlijk bij:

   - Een toets die zakt is BEWEZEN gevoelig, niet bewezen GOED. Hij kan op de
     verkeerde reden zakken en nog steeds een slechte assertie hebben.
   - Een toets die groen blijft is niet bewezen waardeloos. De operatoren hier
     zijn mechanisch; er zijn fouten die ze niet maken.
   - Bij de servertoetsen telt ook een toets die tijdens zijn VOORBEREIDING
     omvalt (inloggen lukt niet meer als /api/auth/ liegt). Dat is echte
     afhankelijkheid van echt gedrag, dus het telt -- maar het is een zwakker
     bewijs dan een assertie die precies op de inhoud viel.
   - Een module die niets teruggeeft (alleen in de database schrijft) kan onder
     al deze mutaties terecht groen blijven.

   - Een bestand dat zichzelf HELEMAAL overslaat (chaos.pg.test.js zonder
     Postgres) meldt ook met een mutatie in de bron netjes "0 gezakt". Dat heet
     hier "slaat zichzelf over" en niet "overleefd": de motor beschuldigt geen
     toets van iets wat hij niet gedaan heeft -- hij heeft niets gedaan.

   Uitslag in MUTATIES.json; BEWIJS.md leest die en zet er per toets de gemeten
   stand in plaats van een woord uit commentaar.

   Draai:  node scripts/mutatie.js               (alles -- lang)
           node scripts/mutatie.js --verlopen    (alleen wat bewijsvers.js verlopen noemt)
           node scripts/mutatie.js --puur        (alleen A)
           node scripts/mutatie.js --server      (alleen B)
           node scripts/mutatie.js --opruimen    (zet een blijven staan mutatie terug)
           node scripts/mutatie.js test/pdf.test.js   (een bestand)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
/* Loopt op per aanroep, zodat twee motoren naast elkaar (en twee aanroepen achter
   elkaar) elkaars uitslagbestand niet overschrijven. */
let uitTeller = 0;

const WORTEL = path.join(__dirname, '..');
const TEST = path.join(WORTEL, 'test');
const UITSLAG = path.join(WORTEL, 'MUTATIES.json');
/* DE VOORTGANG STAAT BUITEN DE REPO, en dat is geen detail.

   Een ronde duurt uren. Schrijft de motor na elk bestand in MUTATIES.json, dan
   staat de werkboom die hele tijd open EN loopt BEWIJS.md continu achter -- dus
   staat keuringsregel 41 uren rood om iets wat gewoon nog bezig is. Dat leert
   iedereen om die regel weg te kijken, en dan is hij niets meer waard.

   Dus: na elk bestand naar server/data/ (staat in .gitignore, dus geen open
   werkboom), en pas aan het EINDE van een fase naar MUTATIES.json. Afbreken kost
   je nog steeds niets -- bij de volgende start wordt de voortgang uit de datamap
   erbij gelezen. */
const VOORTGANG = path.join(WORTEL, 'server', 'data', 'mutatie-voortgang.json');

/* TOETSEN DIE ZELF BESTANDEN VERANDEREN GAAN HIER NIET DOOR, en die uitzondering
   komt uit een botsing die ik heb zien gebeuren.

   test/meterijk.test.js muteert met opzet echte bestanden om te bewijzen dat een
   meter uitslaat -- daarvoor bestaat hij. Een van die ijkingen schrijft in
   MUTATIES.json, precies het bestand dat DEZE motor bijhoudt. De motor liet die
   toets negen keer draaien met een mutatie in de bron; elke ronde maakte een
   tijdelijk ijkbestand in test/ aan en weer weg, en bij een afbreking bleef dat
   staan. Twee schrijvers op een bestand, en een uitslag die van de timing afhangt.

   Erger nog: het is een meting zonder betekenis. Deze motor vraagt "zakt deze
   toets als de bron verandert", en meterijk.test.js DOET dat zelf al -- met een
   proef per meter en een reden waar dat niet kan (regel 35 van scripts/check.js
   bewaakt dat). Diezelfde vraag er nog een keer omheen bouwen levert geen bewijs
   op, alleen twee processen die in hetzelfde bestand schrijven.

   Ze staan hier MET reden en niet stilzwijgend overgeslagen: BEWIJS.md meldt ze
   als 'muteert zelf' en niet als gemeten. */
/* WELK BESTAND SLAAN WE OVER? Drie regimes, en ze zijn met opzet uit main()
   gehaald: dit is de enige plek waar besloten wordt of een meting opnieuw wordt
   gedaan, en een keuzeregel die alleen in een uren durende ronde te zien is,
   is een keuzeregel die niemand ooit heeft zien werken (LAT.md regel 10).
   test/bewijsvers.test.js stelt hem los.

     --opnieuw    niets overslaan; alles opnieuw meten
     --verlopen   alleen doen wat bewijsvers.js verlopen noemt, de rest overslaan
     (geen vlag)  overslaan wat al een bruikbare uitslag heeft

   Let op de derde: "geen toetsen gedraaid" is GEEN uitslag maar een mislukking,
   en die hoort opnieuw geprobeerd te worden. Hetzelfde geldt voor `voorlopig`:
   een overlever uit de ondiepe ronde waar de A-diepe ronde nog overheen moet.
   Die twee gelden ook ONDER --verlopen niet als gedaan, want daar gaat het niet
   om houdbaarheid maar om werk dat nooit af is gekomen. */
/* EEN OVERLEVER UIT DE ONDIEPE RONDE IS NOG GEEN OORDEEL.

   Fase A probeert EEN plek per operator. Blijft een toets daar groen, dan heet
   hij "overleefd" -- maar dat is precies de uitslag waar de A-diepe ronde
   overheen gaat, met acht plekken. Van de vijf gevallen die ik vandaag terug
   moest halen deed A-diep er vijf van vijf alsnog zakken.

   Zolang die tweede ronde niet is gelopen, is "overleefd" dus een TUSSENSTAND
   en geen bewering. Hij stond er wel als bewering: de motor schrijft na elk
   bestand weg (dat moet -- een ronde van uren mag bij een ctrl-C niet alles
   verliezen), en wie tussen fase A en A-diep afbreekt, laat die toetsen als
   ONGEVOELIG in het register achter. Dat getal staat in NORM.json en ging zo
   van 1,2 naar 1,7 zonder dat er een regel code was veranderd.

   Deze functie staat op moduleniveau en niet in main(), en dat is met opzet:
   binnen main() was hij niet los te toetsen, en toen ik hem daar wegmutéérde
   zakte er niets (LAT.md regel 10). Nu houdt test/bewijsvers.test.js hem vast,
   samen met moetOverslaan() hieronder -- die twee zijn een keten en alleen
   samen het gedrag. */
/* EEN AFGEBROKEN PROBE IS GEEN OVERLEVER. Losse functie op moduleniveau, want
   binnen de lus was hij niet te stellen -- en een regel die alleen tijdens een
   ronde van uren zichtbaar wordt, is een regel die niemand ooit heeft zien werken
   (LAT.md regel 10). test/bewijsvers.test.js houdt hem vast. */
function naAfbreking(diag, waar) {
  if (!diag || diag.staat !== 'overleefd') return diag;
  const uit = Object.assign({}, diag);
  uit.staat = 'niet uitgemeten';
  uit.reden = (diag.reden ? diag.reden + '. ' : '') +
    'De probe is hier afgebroken na operator ' + waar +
    ', dus of de OVERIGE operatoren gezien zouden worden is niet vastgesteld.';
  return uit;
}

function voorlopigMaken(r) {
  return (r && r.staat === 'overleefd') ? Object.assign({}, r, { voorlopig: true }) : r;
}

function moetOverslaan(naam, opties) {
  const o = opties || {};
  if (o.opnieuw) return false;
  if (o.verlopenNamen) {
    const v = o.uitslag && o.uitslag[naam];
    if (v && (v.voorlopig || v.staat === 'geen toetsen gedraaid')) return false;
    return !o.verlopenNamen.has(naam);
  }
  const r = o.uitslag && o.uitslag[naam];
  if (!r) return false;
  if (r.voorlopig) return false;   // ondiepe overlever: de diepe ronde moet er nog overheen
  return r.staat !== 'geen toetsen gedraaid';
}

const NIET_MUTEREN = new Map([
  ['meterijk.test.js', 'muteert zelf echte bestanden (waaronder MUTATIES.json) om meters te ijken'],
  ['mutatiewacht.test.js', 'toetst de opruimwacht van deze motor; die twee om elkaar heen draaien zegt niets']
]);

/* DE OPERATOREN. Mechanisch, klein, en elk met een reden waarom hij ECHT gedrag
   verandert in plaats van alleen tekst. Ze worden een voor een geprobeerd tot de
   toets zakt; dat is genoeg, want de vraag is "kan hij zakken" en niet "hoe vaak".

   Elke operator werkt op de bron ZONDER commentaar en tekenreeksen mee te
   rekenen, want een verandering in een uitlegregel bewijst niets. */
const OPERATOREN = [
  { naam: 'true->false', zoek: /\breturn true\b/, zet: 'return false' },
  { naam: 'false->true', zoek: /\breturn false\b/, zet: 'return true' },
  { naam: '===->!==', zoek: /===/, zet: '!==' },
  { naam: '!==->===', zoek: /!==/, zet: '===' },
  { naam: '>=->>', zoek: />=/, zet: '>' },
  { naam: '<=-><', zoek: /<=/, zet: '<' },
  { naam: '&&->||', zoek: /&&/, zet: '||' },
  { naam: '+->-', zoek: /(\w) \+ (\w)/, zet: '$1 - $2' },
  { naam: 'return-weg', zoek: /\breturn ([a-zA-Z_$][\w$.]*);/, zet: 'return undefined;' },
  /* EEN GETAL IS OOK GEDRAG. Plafonds, drempels, tijden en indexen staan hier
     overal, en geen van de operatoren hierboven raakt er een: ze kijken naar
     tekens, niet naar waarden. Daardoor kreeg een toets over een GRENS soms maar
     een of twee schoten -- test/txkap.test.js gaat over de vraag wat er gebeurt
     bij de 50.001e boeking, en dat is een getal.

     Eentje erbij is de kleinste stap die de betekenis echt verandert: een
     plafond van vijf wordt zes, een index van nul wordt een, een wachttijd van
     tien seconden wordt elf. Wie daarop leunt, merkt het; wie niet, niet -- en
     dat is precies wat een operator hoort te scheiden. Een getal in een
     tekenreeks of in commentaar blijft buiten schot via het masker hieronder. */
  { naam: 'getal+1', zoek: /\b(\d+)\b/, zet: (m, n) => String(Number(n) + 1) },
  /* EEN REGEX IS OOK GEDRAG, en geen van de negen operatoren hierboven raakt er
     een. Zie ./lib/regexmutatie.js voor wat hij doet en waarom -- en voor de
     toets die hem vasthoudt. Waar hij mag toeslaan wordt niet gegokt: een
     schuine streep is soms een deling en soms een regex, en een verkeerde gok
     levert onzin-code op die de toets om de verkeerde reden laat zakken. De
     lexer van de eigen AST-scanner wijst regex-tokens exact aan. */
  {
    naam: 'regex-alternatief-weg',
    vind: (bron) => {
      let tokens; try { tokens = require('./ast/lexer').lex(bron); } catch (e) { return []; }
      return tokens.filter(t => t.type === 'regex').map(t => ({ start: t.start, eind: t.end }));
    },
    maak: (tekst) => require('./lib/regexmutatie').laatsteAlternatiefWeg(tekst)
  }
];
/* Waar mag een operator toeslaan? Niet in commentaar en niet in een tekenreeks:
   daar verandert hij niets aan het gedrag, en dan meet de proef of de toets
   tekst leest. We muteren alleen op posities die in het masker "code" zijn.

   HET MASKER ZELF WOONT IN ./lib/bron.js, en dat is geen opruiming maar een
   reparatie. scripts/lib/bewijsgraaf.js had dezelfde vraag ("staat deze
   require echt in code?") en beantwoordde hem ZONDER masker: een `require(`
   binnen een tekenreeks telde daar mee. Dit bestand heeft er zelf een op regel
   666 staan, en daardoor gold scripts/mutatie.js als een bestand met een
   niet-te-volgen require -- en elke toets die hem laadt als een toets met een
   onvolledige bewijsruimte. Twee plekken die dezelfde vraag anders
   beantwoorden is LAT.md regel 4; nu is het er een. */
const { codemasker } = require('./lib/bron');

/* Een operator toepassen op de n-DE plek die in code staat (n vanaf 0). Geeft de
   nieuwe bron terug, of null als die plek niet bestaat.

   WAAROM ER EEN INDEX IN ZIT, en dat is een correctie op de eerste versie. Die
   muteerde alleen de EERSTE plek per operator. Uitkomst: `anthropic.test.js`
   heette "overleefd" terwijl `ai-cache.test.js` diezelfde module
   (server/anthropic.js) met `===->!==` prima liet omvallen -- mijn negen schoten
   hadden alleen geen code geraakt die die ene toets aanroept. "Overleefd" betekende
   toen deels "de motor mikte mis", en dat is een uitslag die de verkeerde partij
   de schuld geeft. Nu gaat de motor bij een overlever DIEPER: meer plekken per
   operator. Zie proefPuur. */
function muteer(bron, op, index) {
  /* Een operator met `vind` wijst zijn eigen plekken aan (zie
     regex-alternatief-weg): daar is een tekstpatroon niet genoeg om te weten of
     iets code is. De rest werkt op het masker hieronder. */
  if (op.vind) {
    const plekken = op.vind(bron);
    let n = 0;
    for (const p of plekken) {
      const nieuw = op.maak(bron.slice(p.start, p.eind));
      if (nieuw === null) continue;
      if (n++ < (index || 0)) continue;
      return bron.slice(0, p.start) + nieuw + bron.slice(p.eind);
    }
    return null;
  }
  const masker = codemasker(bron);
  const re = new RegExp(op.zoek.source, 'g');
  let m, n = 0;
  while ((m = re.exec(bron))) {
    if (!masker[m.index]) continue;
    if (n++ < (index || 0)) continue;
    /* `zet` mag ook een functie zijn (zie getal+1): dan rekent hij de nieuwe
       tekst uit in plaats van hem te plakken. String.replace kent beide vormen. */
    const vervanging = m[0].replace(new RegExp(op.zoek.source), op.zet);
    return bron.slice(0, m.index) + vervanging + bron.slice(m.index + m[0].length);
  }
  return null;
}

/* DE OPRUIMWACHT, en die komt uit een echte breuk. Een `finally` zet de bron
   netjes terug bij een normale afloop, maar NIET als het proces wordt afgebroken:
   ik heb de motor met een kill gestopt terwijl hij `server/lokaal-tls.js`
   gemuteerd had staan, en die mutatie (`return true` -> `false` in het
   CA-certificaat-loket) bleef in de werkboom achter. Een uur later had die
   ongemerkt in een commit kunnen zitten.

   Dus houdt de motor bij wat er OP DIT MOMENT gemuteerd is, en zet hij dat terug
   bij SIGINT, SIGTERM, SIGHUP en een onverwachte uitzondering. Regel 36 van
   scripts/check.js vangt zo'n restant in een COMMIT; deze wacht voorkomt dat hij
   er ooit komt.

   WAT DE WACHT NIET DEKT, en dat is geen slordigheid maar een grens van het
   besturingssysteem: SIGKILL (kill -9) is niet te vangen. Nagemeten en het klopt:
   een kill -9 midden in de ronde liet het tijdelijke ijkbestand in test/ staan dat
   meterijk.test.js aanmaakt -- de toets die de motor op dat moment draaide. (De
   naam staat hier opgeknipt in NIET_MUTEREN en niet voluit: regel 36 van
   scripts/check.js zoekt hem in de inhoud van een commit, en dan klaagt hij over
   deze uitleg.)
   Wie de motor met -9 afbreekt, hoort daarna `git status` te lezen. Regel 36 is
   het net eronder.

   EN EEN GEVOLG WAAR JE OP MOET REKENEN: zolang de motor draait, staat er ALTIJD
   een bronbestand gemuteerd in de werkboom. Dat is geen vervuiling maar het werk
   zelf. Een mutatieronde en "de werkboom moet schoon zijn" gaan dus niet samen;
   committen doe je tussen de fases, niet tijdens. */
const open = new Map();                  // pad -> originele inhoud
const SPOOR = path.join(WORTEL, 'server', 'data', 'mutatie-open.json');

/* WAAROM ER EEN SPOOR OP SCHIJF STAAT, en niet alleen een lijst in het geheugen.

   De eerste versie vertrouwde op signaalhandlers, en die zijn hier grotendeels
   NUTTELOOS: deze motor draait zijn toetsen met spawnSync, en dat blokkeert de
   event-loop. Node levert een signaal pas af tussen twee loop-slagen, dus een
   SIGTERM tijdens een proef -- precies wanneer er een mutatie openstaat -- doet
   niets. Nagemeten: de motor bleef staan met server/redis.js gemuteerd en
   reageerde op geen enkele SIGTERM; alleen kill -9 hielp, en dan is er niets
   opgeruimd. Dat de wacht eerder WEL werkte op server/lokaal-tls.js was geluk:
   die kill landde tussen twee spawnSync-aanroepen.

   Dus staat er nu vóór elke mutatie een spoor op schijf met het pad en de
   originele inhoud, buiten de repo. Elke volgende start ruimt dat eerst op. Dat
   werkt ook na kill -9, na een stroomstoring en na een crash in een kindproces --
   gevallen waarin geen enkele handler nog aan de bak komt. De handlers blijven
   staan voor het geval de motor wel idle is, maar ze zijn niet meer de dekking. */
function schrijfSpoor() {
  try {
    /* Niets open = GEEN bestand, en niet een bestand met een lege lijst erin. Dat
       is geen kosmetiek: "er ligt een spoor" moet hetzelfde betekenen als "er staat
       iets gemuteerd", anders moet elke lezer eerst de inhoud interpreteren en gaat
       dat op een dag mis. */
    if (!open.size) { try { fs.unlinkSync(SPOOR); } catch (e) { /* was er niet */ } return; }
    fs.mkdirSync(path.dirname(SPOOR), { recursive: true });
    fs.writeFileSync(SPOOR, JSON.stringify([...open.entries()].map(([p, b]) => ({ pad: p, bron: b }))));
  } catch (e) { /* dan valt de opruiming terug op git status, en dat zeggen we ook */ }
}
function zetTerug() {
  for (const [p, bron] of open) { try { fs.writeFileSync(p, bron); } catch (e) { /* niets meer aan te doen */ } }
  open.clear();
  try { fs.unlinkSync(SPOOR); } catch (e) { /* was er niet */ }
}
/* DE ENIGE PLEK DIE EEN MUTATIE OP SCHIJF ZET. Aanmelden, spoor schrijven,
   muteren, en in een finally alles terugdraaien -- alle vier bij elkaar, want
   losgeknipt vergeet een lus er een van.

   Waarom dit een eigen functie is en niet drie regels in de lus: mijn eerste
   toets op het spoor kon niet zakken. Hij riep schrijfSpoor() zelf aan, dus toen
   ik die aanroep UIT de lus van de motor haalde bleef de toets groen -- hij
   bewees dat de twee helften samenwerken en niet dat de motor ze gebruikt. Met
   een enkele functie is er iets om te toetsen dat WEL omvalt als de bedrading
   weg is (test/mutatiewacht.test.js). */
function metMutatie(pad, nieuweBron, doe) {
  const origineel = fs.readFileSync(pad, 'utf8');
  try {
    open.set(pad, origineel);
    schrijfSpoor();
    fs.writeFileSync(pad, nieuweBron);
    return doe();
  } finally {
    fs.writeFileSync(pad, origineel);
    open.delete(pad);
    schrijfSpoor();
  }
}

/* Opruimen wat een eerdere ronde heeft laten staan. Geeft terug wat er is
   teruggezet, zodat de motor dat HARDOP kan zeggen: een stille opruiming laat
   niemand weten dat er iets was blijven liggen. */
function ruimEerderOp() {
  let lijst;
  try { lijst = JSON.parse(fs.readFileSync(SPOOR, 'utf8')); } catch (e) { return []; }
  const terug = [];
  for (const { pad, bron } of lijst || []) {
    try {
      if (fs.readFileSync(pad, 'utf8') !== bron) { fs.writeFileSync(pad, bron); terug.push(pad); }
    } catch (e) { /* bestand is weg: dan valt er niets terug te zetten */ }
  }
  try { fs.unlinkSync(SPOOR); } catch (e) {}
  return terug;
}
for (const sein of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(sein, () => { zetTerug(); process.exit(130); });
}
process.on('uncaughtException', (e) => { zetTerug(); console.error(e); process.exit(1); });
process.on('exit', zetTerug);

/* DE UITSLAG GAAT NAAR EEN BESTAND EN NIET DOOR EEN PIJP, en dat is geen
   opruiming maar de reparatie van een vastloper die de motor uren kostte.

   spawnSync met `encoding` geeft het kind een PIJP voor stdout, en hij komt pas
   terug als die pijp DICHT is. Dicht gaat hij pas als iedereen die hem open
   heeft klaar is -- en dat is niet alleen het kind. `node --test` draait zijn
   toetsbestand in een eigen proces, en zo'n toets start hier vaak een server als
   KLEINKIND. Dat kleinkind erft fd 1. Blijft het draaien nadat de toets zijn
   uitslag heeft gedrukt, dan staat de motor te wachten op een pijp van een proces
   waar hij niets meer van wil.

   GEMETEN op een nagebouwd geval: een kind dat in 50 milliseconde klaar is en een
   kleinkind achterlaat, kost via een pijp de VOLLE time-out -- 2004 ms op een
   time-out van 2000 -- en komt terug met ETIMEDOUT. Via een bestand: 58 ms, geen
   fout, dezelfde uitslag. In deze motor staat die time-out op 240 seconde, en
   `tijdout` betekent in proefPuur() "te langzaam". Een toets die prima draaide en
   zijn asserties netjes meldde, kan zo vier minuten opgehouden worden en daarna
   ALS ONMEETBAAR worden weggeschreven.

   Een bestand heeft dat probleem niet: daar is niets te draineren, dus spawnSync
   wacht alleen op het KIND en de time-out doet wat hij belooft.

   EN WAT DIT NIET IS, want ik dacht eerst van wel. test/lokaal-tls.test.js hield
   de motor zes minuten bezig, en dat leek dit geval. Het was het niet: die toets
   draait los in 0,34 seconde, maar de MUTATIE laat hem hangen, en dan betaalt de
   motor terecht zijn 90 seconde plus de herkansing met --test-force-exit. Dat is
   geen fout maar de prijs van het onderscheid tussen "hij komt er niet uit" en
   "geen assertie zag het". De reparatie hieronder haalt die zes minuten dus NIET
   weg. Wat er wel is waargenomen: een wees van 66 megabyte die vijf en een halve
   minuut na zijn ouder nog draaide -- daar gaat `detached` over.

   TWEE VERSCHILLENDE WACHTTIJDEN, en het verschil komt uit een vastloper.

   test/redis.test.js sluit onder een mutatie in server/redis.js niet meer af: de
   toets houdt een handle open die bij het gewijzigde gedrag nooit wordt
   opgeruimd, dus blijft node hangen. De motor zat daardoor twintig minuten stil
   in spawnSync -- ik dacht dat hij niets deed, maar hij stond te wachten.

   De NULMETING mag lang duren (vier minuten): een echte toets kan traag zijn en
   die uitslag is de voorwaarde voor al het andere. Een MUTATIERONDE krijgt anderhalve
   minuut: die toets is net zonder mutatie binnen de tijd groen geworden, dus als
   hij nu niet afkomt, is dat de mutatie en geen traagheid. Zonder dat onderscheid
   kost een enkel vastlopend bestand negen keer vier minuten. */
const WACHT_NUL = 240000;
const WACHT_MUTATIE = 90000;

/* `forceer` zet --test-force-exit erbij: de draaier stopt zodra de toetsen klaar
   zijn, ook als er nog een handle openstaat. Alleen gebruikt om NA een time-out te
   achterhalen wat de asserties zeiden -- zie tijdoutMaarMeetbaar(). */
function draaiToets(bestand, env, wacht, forceer) {
  /* DE REPORTER STAAT VASTGEPIND OP TAP, want deze functie leest de uitslag
     met /^# tests/ en /^not ok/. Tot Node 22 was TAP de standaard zonder TTY;
     op Node 24 is dat de spec-reporter geworden en las de motor ineens NIETS
     meer -- elke toets heette "geen toetsen gedraaid", ook een suite die
     aantoonbaar draaide en zakte. Een meter die op een standaardinstelling
     leunt, meet de standaardinstelling (LAT regel 10). */
  const vlaggen = ['--experimental-sqlite', '--test', '--test-reporter=tap'];
  if (forceer) vlaggen.push('--test-force-exit');
  const uitPad = path.join(os.tmpdir(), 'rtg-mutatie-' + process.pid + '-' + (uitTeller++) + '.tap');
  const fd = fs.openSync(uitPad, 'w+');
  let r;
  try {
  r = spawnSync('node', vlaggen.concat([bestand]), {
    cwd: WORTEL, timeout: wacht || WACHT_NUL,
    /* stdin dicht (een toets die om invoer vraagt hoort te falen, niet te
       wachten), stdout en stderr naar hetzelfde bestand -- zie de kop hierboven. */
    stdio: ['ignore', fd, fd],
    /* SIGKILL EN NIET HET STANDAARD SIGTERM, en dat is geen ruwheid maar een
       lek dat ik heb zien ontstaan. Bij een time-out stuurt spawnSync SIGTERM,
       en juist de toetsen die hier vastlopen (test/redis.test.js) blijven hangen
       op een handle die niet meer opruimt -- die negeren dat sein. Ik zag twee
       kindprocessen van dezelfde toets naast elkaar draaien terwijl spawnSync er
       maar EEN kan hebben: de eerste was een wees van een afgelopen time-out.
       Over een ronde van uren stapelen die zich op, houden ze poorten en geheugen
       vast, en vervuilen ze de metingen die erna komen. */
    /* Een eigen procesgroep, zodat de opruiming hieronder niet alleen het kind
       maar ook de kleinkinderen bereikt. Zonder dit gaat SIGKILL naar `node
       --test` en blijft de server die de toets startte gewoon draaien: over een
       ronde van uren stapelen die zich op en houden ze poorten en geheugen vast. */
    detached: true,
    killSignal: 'SIGKILL',
    env: Object.assign({}, process.env, env || {})
  });
  } finally { try { fs.closeSync(fd); } catch (e) {} }
  /* De hele groep opruimen, ook als spawnSync gewoon klaar was: een toets mag een
     server achterlaten, deze motor mag dat niet. ESRCH betekent dat de groep al
     weg is en dat is de normale afloop. Op Windows bestaan procesgroepen zo niet;
     daar blijft het gedrag als voorheen. */
  if (r && r.pid && process.platform !== 'win32') {
    try { process.kill(-r.pid, 'SIGKILL'); } catch (e) { if (e.code !== 'ESRCH') throw e; }
  }
  let uit = '';
  try { uit = fs.readFileSync(uitPad, 'utf8'); } catch (e) { uit = ''; }
  try { fs.unlinkSync(uitPad); } catch (e) {}
  const gezakt = (uit.match(/^not ok /gm) || []).length;
  const geteld = /^# tests (\d+)/m.exec(uit);
  /* OOK DE OVERGESLAGEN TOETSEN TELLEN, en dat is geen bijzaak. Een bestand dat
     zichzelf helemaal overslaat (chaos.pg.test.js zonder Postgres, een e2e zonder
     browser) meldt netjes "0 gezakt" -- ook met een mutatie in de bron. Zonder
     deze telling heet dat "overleefd", en dan beschuldigt de motor een toets van
     iets wat hij niet heeft gedaan: hij heeft niets gedaan. */
  const over = /^# skipped (\d+)/m.exec(uit);
  const toetsen = geteld ? Number(geteld[1]) : 0;
  const overgeslagen = over ? Number(over[1]) : 0;
  return { gezakt, toetsen, overgeslagen, alGeslagen: toetsen > 0 && overgeslagen >= toetsen,
    tijdout: r.error && r.error.code === 'ETIMEDOUT' };
}

/* TOETSEN DIE DE SERVER STARTEN IN PLAATS VAN HEM TE REQUIREN, en waarom die een
   handgeschreven koppeling nodig hebben.

   modulesVan() leest de requires van een toets, en dat werkt voor een pure toets
   die zijn module noemt. Een toets die de server als KINDPROCES opstart en er
   verzoeken naartoe stuurt, noemt die module nergens -- hij kent alleen een poort.
   De motor meldt dan "geen module gevonden", en dat is geen fout maar een grens
   van deze vindwijze.

   Het gevolg was wel dat zo'n toets ONMEETBAAR bleef: elf toetsen stonden zo,
   waaronder de zwaarste die er zijn (boot-smoke, golive, vloot). Dat is precies
   het soort toets waarvan je het meest wil weten of hij kan zakken.

   Hier staat daarom per toets de module die hij ECHT op de proef stelt. Elke
   regel is een bewering die met een mutatie is nagetrokken en niet een gok: staat
   hier een module die de toets niet raakt, dan komt hij als 'overleefd' terug en
   krijgt de toets de schuld van iets wat de lijst fout heeft.

   De tien andere staan nog open; dat is een geteld gat in TAKEN.md en geen
   vergeten hoekje. */
const EIGEN_MODULE = new Map([
  /* Nagemeten: RTG_DOMAINS negeren laat hem zakken op de 404 van supplier, en
     nul domeinen ophangen laat hem zakken op de 401 van member. Beide in deze
     module, en beide gezakt. */
  ['domeinalleen.test.js', ['server/opzet/routes.js']],
  /* De resetcontracten laden hun module met een BEREKEND pad (path.join met de
     wortel), omdat ze de modulecache eerst leegmaken om een echt verse kopie te
     krijgen. De regex hierboven zoekt naar een letterlijke require en vindt dan
     niets; zonder deze regels zouden ze als "geen module gevonden" tellen
     terwijl ze juist scherp meten. Beide met de hand nagetrokken en raak. */
  /* Ook deze laadt zijn modules met een berekend pad (verse modulecache per
     scenario), dus de regex vindt er geen require voor. */
  ['datamap-beweegt.test.js', ['server/db/opslag.js', 'server/db/geheugen.js']],
  ['resetcontract-voorcheck.test.js', ['server/db/voorcheck.js']],
  ['resetcontract-schrijfpad.test.js', ['server/db/snapshot.js', 'server/db/geheugen.js']],
  /* VIER TOETSEN DIE DE LIEGPOORT OVERLEEFDEN OMDAT HIJ ZE NIET RAAKT, en dat
     is precies waar de uitleg hierboven over gaat: het overleven zei niets over
     de toets en alles over de verkeerde proef. Alle vier bevatten een require
     van de helper (dus vielen ze in het servervak), maar geen van vieren leest
     iets van /api/ -- ze beproeven een module die ze zelf binnenhalen. */
  ['strenge-poort.test.js', ['test/helper.js']],
  ['loghygiene.test.js', ['server/log.js']],
  ['genreregister.test.js', ['server/seed/genres.js']],
  ['genretoegang.test.js', ['server/kern/aanmeldingen/bedrijf.js', 'server/seed/genres.js']],
  /* VIER TOETSEN DIE OP server/db/index.js MIKTEN, en dat is 23,9 kB met de hele
     opslaglaag erin. Elk van de vier beproeft een SMALLER stuk dat die module
     alleen doorgeeft: het afkappen en de index van de transactiecollecties
     (server/db/tx/index.js) en de drieweg-samenvoeging (server/db/merge.js).
     Eenendertig schoten op de grote module raakten telkens code die deze toetsen
     niet aanroepen -- dezelfde misser als hierboven, alleen subtieler omdat het
     getal hoog is. */
  ['txkap.test.js', ['server/db/tx/index.js']],
  ['txindex.test.js', ['server/db/tx/index.js']],
  ['txgeld.test.js', ['server/db/tx/index.js', 'server/db/tx/collecties.js']],
  ['merge3.property.test.js', ['server/db/merge.js']],
  /* Elke app als eigen proces achter de poortwachter. */
  ['vloot.test.js', ['server/vloot.js']],
  /* Productiestand: demo dicht, geen dev-lekken, registreren werkt. */
  ['golive.test.js', ['server/routes/auth/account.js', 'server/server.js']],
  /* De voorcheck van de SQLite-opslag; de toets noemt de module in zijn kop. */
  ['opslag-voorcheck.test.js', ['server/db/sqlite.js']],
  /* TLS aan of uit, in de hele server en in de poortwachter. Drie mutaties met
     de hand nagetrokken en alle drie raak: het schema in de opstartmelding
     (luister.js), het maken van de TLS-server (web/index.js) en de schakelaar van
     de poortwachter (trio.js). web/index.js staat vooraan omdat die de zwaarste
     bewering draagt -- praat hij echt https. */
  ['tls-boot.test.js', ['server/web/index.js', 'server/opzet/luister.js', 'server/trio.js']],
  /* SCHERMTOETSEN, en dat is nieuw. De motor haalde altijd alleen *.test.js op,
     dus de 85 *.e2e.js-bestanden waren structureel onmeetbaar -- en dat maakte
     toetsenNietGemeten een meter die het SCHRIJVEN van een schermtoets bestrafte.
     Er is geen motorwijziging voor nodig: een los meegegeven bestand wordt al
     aangenomen (zie de regel bij `losse` verderop), het ontbrak alleen aan een
     module om te muteren -- een e2e-toets requiret zijn pagina niet, hij opent
     hem als URL.

     Wat hier staat is per toets de browsermodule die hij echt op de proef stelt,
     en alleen de regels die ik ook door de motor heb laten BEVESTIGEN. Een
     geraden module levert een 'overleefd' en dan krijgt de toets de schuld van
     wat de lijst fout heeft; dat is bij de servertoetsen al een keer gebeurd.

     Het is geen standaardronde: een browsertoets kost minuten per operator, dus
     alle 85 meten is een kwestie van looptijd en niet van ontbrekend gereedschap.
     De weg staat open, per bestand, met de bevestiging als voorwaarde. */
  /* camerascherm toetst wat de PAGINA doet met de camera, niet wat de server
     antwoordt -- hij overleefde de liegpoort, en dat zei niets over de toets. Met
     deze regel gaat hij door de bronmutatie op de mediapoort. Bevestigd.

     deur.e2e.js staat hier BEWUST NIET: die leest echt van /api/ en zakt gewoon op
     de liegpoort (gemeten). Een regel toevoegen die niets toevoegt, zou de lijst
     onbetrouwbaar maken -- elke regel hier hoort een uitspraak te zijn die de
     standaardweg niet al doet. */
  ['camerascherm.e2e.js', ['public/shared/media.js']],
  /* Het grootboek op sqlite. De toets draait een rit-bestand als kindproces,
     en dat requiret server/db -- vandaar dat de scanner niets zag. */
  ['txledger-sqlite.test.js', ['server/db/tx/index.js', 'server/db/index.js']],
  /* Deze toets start twee kindprocessen en raakt daardoor geen module via een
     gewone require. De atomaire revisie en rollback zitten in dit SQLite-slot. */
  ['collectie-transactie-sqlite.test.js', ['server/db/collectie-sqlite.js']],
  /* De facade componeert de Partnerstudio; het gedrag zit bewust in deze
     deelmodules. Muteren van alleen de dunne facade meet dus niet de workflow. */
  ['magnaat-partnerstudio.test.js', [
    'server/kern/magnaat-partnerstudio-basis.js',
    'server/kern/magnaat-partnerstudio-bedrijf.js',
    'server/kern/magnaat-partnerstudio-training.js',
    'server/kern/magnaat-partnerstudio-publicatie.js',
    'server/kern/magnaat-partnerstudio-relaties.js'
  ]],
  /* De rekenmotor van RTG Office draait in de BROWSER; de toets laadt de
     bestanden los in met een uitgerekend pad, dus zonder require-regel. */
  ['office-blad.test.js', ['public/shared/rekenmotor.js', 'public/shared/rekenfuncties.js']],
  /* De blinde vlek zoekt structuurfouten in de PAGINA'S en niet in een module.
     Hij staat er met een kandidaat en niet met een reden, omdat ik niet ga
     beweren dat het onmeetbaar is voordat de motor het heeft geprobeerd:
     routing.js bepaalt welk bestand een URL oplevert, en dat is het dichtste
     bij een module die deze toets echt nodig heeft. Blijft hij overleven, dan
     is dat de uitslag en hoort er een reden te komen in plaats van een gok. */
  ['blindevlek.test.js', ['server/web/routing.js']]
]);

/* TOETSEN WAAR EEN BRONMUTATIE NIETS OVER ZEGT, met de reden en het aantal
   pogingen erbij.

   Deze vier stonden eerst in EIGEN_MODULE met een module die ik erbij had
   bedacht. De motor heeft ze alle vier geprobeerd en ze overleefden -- en dan is
   "overleefd" het verkeerde woord: dat betekent "de toets legt het gedrag niet
   vast", terwijl hier MIJN TOEWIJZING fout was. Ze zo laten staan is de toets de
   schuld geven van iets wat hij niet heeft gedaan, precies waar de kop van
   proefPuur voor waarschuwt.

   Ze krijgen daarom een eigen staat die als NIET GEMETEN telt en niet als
   overlever. Dat houdt toetsenOngevoeligPct eerlijk en laat toetsenNietGemeten
   zeggen wat waar is: deze motor kan hier niets over zeggen.

   Elke reden noemt hoeveel mutaties er zijn geprobeerd, want een reden zonder
   poging is een vermoeden. */
const GEEN_BRONMUTATIE = new Map([
  /* Ik heb dit bestand eerst in EIGEN_MODULE gezet met public/apps/voertuig.js en
     rit.js erbij -- de twee modules die deze toets echt leest. De motor probeerde
     er 17 en de toets overleefde ze allemaal, en dat is hier GEEN uitspraak over
     de toets. De operatoren zijn gedragsmatig (true->false, een vergelijking
     omdraaien); wat deze toets vastlegt is TEKST en NAMEN: de gesloten deur, dat
     "niet van u" en "bestaat niet" niet uit elkaar gehouden worden, en welke
     opslagsleutel bij welke inlog hoort. Geen enkele bronoperator raakt een
     letterlijke string, dus "overleefd" zou de toets de schuld geven van wat mijn
     toewijzing fout had.
     De foutklasse die hij WEL bewaakt is met de hand nagetrokken en tweemaal
     RAAK: rtg_member_token -> rtg_token laat toets 6 zakken, en de tweede
     leverancierssleutel weghalen laat toets 7 zakken. De passende operator is een
     hernoemer van stringliteralen, en die heeft deze motor niet. */
  ['voertuigscherm.e2e.js', 'overleefde 17 mutaties in public/apps/voertuig.js en rit.js. Deze toets legt tekst en sleutelnamen vast, geen rekenend gedrag; geen enkele bronoperator raakt een letterlijke string. Met de hand nagetrokken op de foutklasse die hij wel bewaakt (een hernoemde opslagsleutel): tweemaal raak'],
  ['boot-smoke.test.js', 'overleefde 45 mutaties in server/server.js, en terecht: deze toets is bewust ONDIEP -- de server komt op en de wortel geeft de ROS-poort, meer beweert hij niet. De juiste mutatie zit in de wortelroute of in de pagina, niet in de bron'],
  ['poortrace.test.js', 'overleefde 45 mutaties in server/server.js. De bewering gaat over hoe een EADDRINUSE wordt BENOEMD in het log, niet over rekenend gedrag; een operator raakt dat niet'],
  ['eu-naleving.test.js', 'overleefde 5 mutaties. Deze toets vergelijkt beweringen uit EU.md met code die er nog STAAT; een operator verandert wat code doet en niet dat hij bestaat. De juiste mutatie is de code weghalen of het document laten liegen'],
  ['randen.test.js', 'overleefde 42 mutaties in public/shared/randen.js en rahul-mond.js. Hij toetst of PAGINA\'S de bladen laden en dat er geen zwevende knop terugsluipt -- structuur van de markup, niet gedrag van de module']
]);

/* Welke SERVERMODULE toetst dit bestand? Uit zijn eigen requires: een pure toets
   noemt de module die hij onderzoekt. Meerdere kandidaten: we nemen ze allemaal
   en muteren in die volgorde -- de eerste die de toets laat zakken is genoeg. */
function modulesVan(bestand) {
  const eigen = EIGEN_MODULE.get(path.basename(bestand));
  if (eigen) return eigen.filter(p => fs.existsSync(path.join(WORTEL, p)));
  const bron = fs.readFileSync(bestand, 'utf8');
  const uit = [];
  for (const m of bron.matchAll(/require\('(\.\.\/(?:server|scripts|public)\/[^']+)'\)/g)) {
    let p = path.join(TEST, m[1]);
    if (!/\.[a-z]+$/.test(p)) p += '.js';
    if (!fs.existsSync(p)) { const idx = p.replace(/\.js$/, '/index.js'); if (fs.existsSync(idx)) p = idx; else continue; }
    const rel = path.relative(WORTEL, p).replace(/\\/g, '/');
    if (!uit.includes(rel)) uit.push(rel);
  }
  return uit;
}

/* EEN PURE TOETS. Groen zonder mutatie is een voorwaarde: staat hij al rood, dan
   bewijst "hij zakt" niets (LAT.md regel 3 -- een meter zonder invoer meet niet). */
function proefPuur(naam, posities) {
  if (NIET_MUTEREN.has(naam)) return { soort: 'puur', staat: 'muteert zelf', reden: NIET_MUTEREN.get(naam) };
  if (GEEN_BRONMUTATIE.has(naam)) return { soort: 'puur', staat: 'geen bronmutatie mogelijk', reden: GEEN_BRONMUTATIE.get(naam) };
  const diep = posities || 1;
  const bestand = path.join(TEST, naam);
  const nul = draaiToets(bestand);
  /* Eerst de nulmeting, en een die niet AFKOMT is een eigen uitslag. Zonder deze
     regel zou de motor negen keer vier minuten wachten op een toets die toch niet
     te meten is, en dan draait niemand hem ooit af. */
  if (nul.tijdout) return { soort: 'puur', staat: 'te langzaam' };
  if (nul.gezakt > 0) return { soort: 'puur', staat: 'al rood', gezakteZonderMutatie: nul.gezakt };
  if (!nul.toetsen) return { soort: 'puur', staat: 'geen toetsen gedraaid' };
  if (nul.alGeslagen) return { soort: 'puur', staat: 'slaat zichzelf over', overgeslagen: nul.overgeslagen };
  const modules = modulesVan(bestand);
  if (!modules.length) return { soort: 'puur', staat: 'geen module gevonden' };

  let geprobeerd = 0;
  for (const rel of modules) {
    const p = path.join(WORTEL, rel);
    const origineel = fs.readFileSync(p, 'utf8');
    for (let i = 0; i < diep; i++) {
      for (const op of OPERATOREN) {
        const nieuw = muteer(origineel, op, i);
        if (!nieuw || nieuw === origineel) continue;
        /* Alles wat met de mutatie op schijf te maken heeft, gaat door metMutatie:
           aanmelden, spoor schrijven, terugzetten. Eén plek, dus geen lus die er
           een van vergeet. */
        const uit = metMutatie(p, nieuw, () => {
          const check = spawnSync('node', ['--check', p], { cwd: WORTEL, encoding: 'utf8' });
          if (check.status !== 0) return null;    // mutatie brak de syntaxis: telt niet
          geprobeerd++;
          const na = draaiToets(bestand, null, WACHT_MUTATIE);
          /* EEN VASTLOPER IS GEEN ZAKKER EN GEEN OVERLEVER. De toets was zonder
             mutatie binnen de tijd groen; komt hij er nu niet uit, dan heeft de
             mutatie het gedrag echt veranderd -- maar de toets heeft niets GEMELD,
             en dat is geen bewijs dat een assertie het zag. Hij krijgt zijn eigen
             uitslag en telt bij "niet gemeten", niet bij gezakt. */
          /* NA EEN TIME-OUT NOG EEN KEER MET --test-force-exit, want "hij komt er
             niet uit" en "geen assertie zag het" zijn twee verschillende dingen en
             de eerste mag de tweede niet verbergen. Zie tijdoutMaarMeetbaar(). */
          if (na.tijdout) {
            const diag = Object.assign(tijdoutMaarMeetbaar(bestand, null, 'puur'),
              { module: rel, operator: op.naam + '#' + i, geprobeerd });
            /* EN "OVERLEEFD" MAG HIER NIET STAAN, want deze lus wordt hier
               AFGEBROKEN. `overleefd` betekent in dit register een ding: elke
               operator is geprobeerd en geen enkele werd gezien. Een probe die na
               operator een stopt omdat die traag was, heeft dat niet vastgesteld
               -- er stonden er nog tien te wachten.

               Het stond er wel zo, en het is een RATELTAND: toetsenOngevoeligPct
               in NORM.json. test/rahul-mens.test.js kwam zo binnen met
               "geprobeerd: 1" en de reden "deze toets is TRAAG, hij lekt niets",
               en werd geteld als een toets die zijn eigen gedrag niet vastlegt.
               Dat is een aanklacht op grond van een meting die is afgebroken.

               De uitleg drie regels hierboven belooft ook precies het
               tegenovergestelde van wat de code deed: "hij krijgt zijn eigen
               uitslag en telt bij niet gemeten, niet bij gezakt" (LAT.md regel 6).
               `niet uitgemeten` valt in norm.js vanzelf in de bak nietGemeten,
               want die telt alles wat niet letterlijk overleefd of gezakt heet.

               Een GEZAKT blijft staan: dat is wel vastgesteld, ook als het traag
               ging. Een bewijs verlies je niet door de klok. */
            return naAfbreking(diag, op.naam + '#' + i);
          }
          return na.gezakt > 0 ? { soort: 'puur', staat: 'gezakt', module: rel,
            operator: op.naam + '#' + i, gezakt: na.gezakt, geprobeerd } : null;
        });
        if (uit) return uit;
      }
    }
  }
  /* NUL POGINGEN IS GEEN OVERLEVER. Vijf bestanden kwamen uit de diepe ronde als
     "overleefd (0 mutaties geprobeerd)": functies, kern-events, normprestatie,
     stijlbundel en vuurplan. Er was voor hun module geen enkele bruikbare mutatie
     te maken -- geen operator die past, of elke poging brak de syntaxis en viel
     af bij node --check. Zo'n toets is NIET ongevoelig gebleken; hij is nooit
     uitgedaagd. Dat als overlever noteren beschuldigt hem van iets wat de motor
     niet heeft geprobeerd, en dat is precies de fout die deze motor moet
     voorkomen in plaats van maken. Hij telt nu bij niet-gemeten. */
  if (!geprobeerd) return { soort: 'puur', staat: 'geen bruikbare mutatie', modules, posities: diep };
  return { soort: 'puur', staat: 'overleefd', modules, geprobeerd, posities: diep };
}

function isServerToets(naam) {
  /* EEN EIGEN MODULE WINT VAN DE LIEGPOORT, en dat is gemeten en geen smaak.

     Een schermtoets start ook een server (hij heeft er een nodig om de pagina te
     serveren), dus viel hij hier in het servervak en werd hij met de liegpoort
     beproefd. Voor test/deur.e2e.js is dat precies goed -- die leest echt van
     /api/ en zakt netjes. Voor test/camerascherm.e2e.js is het zinloos: die toetst
     wat de pagina DOET met de camera, niet wat de server antwoordt, en overleefde
     de liegpoort dan ook. Overleven zegt daar niets over de toets en alles over de
     verkeerde proef.

     Staat er in EIGEN_MODULE een module bij deze toets, dan is dat een expliciete
     uitspraak over wat hij op de proef stelt, en die hoort voor te gaan op het
     vermoeden dat een require van de helper oplevert. */
  if (EIGEN_MODULE.has(path.basename(naam))) return false;
  /* En om precies dezelfde reden wint GEEN_BRONMUTATIE. Daar staat een
     UITGEMETEN uitspraak dat een bronmutatie over deze toets niets zegt; hem
     daarna alsnog de liegpoort in sturen levert een tweede verkeerde proef en
     dus weer een 'overleefd' dat de toets de schuld geeft. Dit raakte pas iets
     toen er een e2e-toets bijkwam die de helper WEL gebruikt (voertuigscherm):
     de drie oudere regels doen dat geen van drieen, dus die liepen hier nooit
     langs en hun uitslag verandert hier niet van. */
  if (GEEN_BRONMUTATIE.has(path.basename(naam))) return false;
  /* De zoekterm opgeknipt, precies zoals de patronen in regel 36 van
     scripts/check.js: voluit gespeld leest een andere keuringsregel dit als een
     require van scripts/helper.js, die niet bestaat. */
  const teken = "require('./" + "helper')";
  return fs.readFileSync(path.join(TEST, naam), 'utf8').includes(teken);
}

/* DE SERVERTOETSEN in EEN ronde: de liegpoort aan voor alle /api/-paden. Per
   bestand kijken we of hij dan omvalt. Dat is honderdvijfenveertig keer een
   server starten in plaats van honderdvijfenveertig ronden van de hele suite. */
/* DE DEUREN DIE IN DE SCHERPE RONDE OPEN BLIJVEN. Uit de toetsen zelf geteld:
   /api/auth/register (246 keer), /api/supplier/login (245), /api/login (88),
   /api/office/login (78), /api/auth/login (70). Dat zijn de paden waarlangs een
   toets binnenkomt; laat je die ook liegen, dan struikelt hij bij de voorbereiding
   en meet je niet of hij naar de INHOUD kijkt. Met de hand en niet afgeleid: een
   lijst die meeschuift met de code verandert stilletjes wat het getal betekent. */
const DEUREN = ['/api/auth/', '/api/login', '/api/supplier/login',
  '/api/supplier/mijn/login', '/api/office/login', '/api/webauthn/'].join(',');

/* DE SCHERPE RONDE (fase C). Zelfde liegpoort, maar de deuren blijven open. Een
   toets die HIER zakt, zakt omdat zijn eigen domein loog en niet omdat hij niet
   meer binnenkwam. Dat is het sterkere bewijs; fase B is de ondergrens.

   Alleen zinvol voor toetsen die in fase B zijn gezakt: wie daar al overleefde,
   overleeft dit ook. */
/* EEN TIME-OUT IS TWEE FEITEN, EN 'vastgelopen' VERSTOPTE ZE IN EEN WOORD.

   Zeven toetsen kwamen hier terug als `vastgelopen`. Bij zes daarvan bleek na
   handmatig kijken dat de ASSERTIES hun werk deden -- er stonden twee, drie, vijf,
   acht, negen roden in de uitvoer -- en dat alleen het AFSLUITEN niet lukte: een
   server die niet gestopt werd, een socket die openbleef, een nepserver die in zijn
   verzoekbehandelaar omviel. Die zes zijn gerepareerd, en dat was de goede weg:
   een toets die hangt is erger dan een toets die zakt, want een time-out kost een
   schouderophalen en niemand leest daarna nog welke bewering het was.

   Maar de uitslag `vastgelopen` zei niets over de gevoeligheid, en dat is precies
   wat deze motor moet meten. Node heeft daar gereedschap voor: met
   --test-force-exit stopt de draaier zodra de toetsen klaar zijn, ook met een
   openstaande handle. Na een time-out draaien we dus EEN keer opnieuw met die vlag
   en noteren we beide feiten: wat de asserties zeiden EN dat er iets lekt.

   Het is bewust geen standaardvlag. Zou hij altijd meedraaien, dan waren die zes
   lekken nooit gevonden -- de motor was juist de enige die ze zag. Hij hoort dus
   alleen te helpen NADAT een time-out is vastgesteld, en het lek blijft als feit
   in de uitslag staan in plaats van te verdwijnen. */
function tijdoutMaarMeetbaar(bestand, env, soort) {
  /* RUIM DE TIJD, want deze ronde is een DIAGNOSE en geen meting op tempo. De
     eerste versie gaf hem hetzelfde budget als de gewone ronde, en toen kwam
     zaakdoos terug als "ook met force-exit niet af" -- terwijl hij het met de hand
     in ruim vier minuten wel haalt. Dat was dus geen vastloper maar een te LANGZAME
     toets, en die twee door elkaar halen is precies waar deze functie voor is
     gemaakt. Vier keer het gewone budget: het draait een keer per vastloper. */
  const RUIM = WACHT_MUTATIE * 4;

  /* EERST ZONDER DE VLAG, want TRAAG en LEK zijn niet hetzelfde en het etiket
     `lekt` mag niet op een toets die alleen meer tijd nodig had.

     Dat is geen theorie: test/zaakdoos.test.js lekte een cloud-kindproces EN
     duurt onder de liegpoort ruim vier minuten. Toen het lek was gerepareerd,
     bleef hij door het budget van 90s heen gaan -- en met alleen de force-exit-weg
     zou hij voor altijd als lekkend genoteerd staan terwijl er niets meer lekt.
     Een uitslag die een opgelost gebrek blijft melden, is net zo fout als een die
     een bestaand gebrek verzwijgt.

     Dus: eerst nog eens draaien met RUIM budget en ZONDER vlag. Komt hij er dan
     uit, dan was het traagheid en niets anders. */
  const ruimZonder = draaiToets(bestand, env, RUIM);
  if (!ruimZonder.tijdout) {
    if (ruimZonder.alGeslagen) return { soort, staat: 'slaat zichzelf over', traag: true };
    return { soort, staat: ruimZonder.gezakt > 0 ? 'gezakt' : 'overleefd', gezakt: ruimZonder.gezakt, traag: true,
      reden: 'kwam er niet uit binnen het gewone budget van ' + Math.round(WACHT_MUTATIE / 1000) +
        's maar wel binnen ' + Math.round(RUIM / 1000) + 's: deze toets is TRAAG, hij lekt niets' };
  }

  const na = draaiToets(bestand, env, RUIM, true);
  if (na.tijdout) return { soort, staat: 'te langzaam', lekt: true,
    reden: 'ook met --test-force-exit niet af binnen ' + Math.round(RUIM / 1000) + 's; ' +
      'de toetsen zelf komen niet klaar, dus dit is traagheid en niet alleen een handle' };
  if (na.alGeslagen) return { soort, staat: 'slaat zichzelf over', lekt: true };
  return { soort, staat: na.gezakt > 0 ? 'gezakt' : 'overleefd', gezakt: na.gezakt, lekt: true,
    reden: 'de asserties deden hun werk, maar het proces sloot niet af: deze toets LEKT een handle. ' +
      'Uitslag gemeten met --test-force-exit; het lek is een eigen gebrek en hoort gerepareerd.' };
}

function proefServerScherp(naam) {
  const bestand = path.join(TEST, naam);
  const na = draaiToets(bestand, { RTG_LIEG: '/api/', RTG_LIEG_NIET: DEUREN }, WACHT_MUTATIE);
  if (na.tijdout) { const t = tijdoutMaarMeetbaar(bestand, { RTG_LIEG: '/api/', RTG_LIEG_NIET: DEUREN }, 'server');
    return { staat: t.staat, lekt: true, reden: t.reden }; }
  if (na.alGeslagen) return { staat: 'slaat zichzelf over' };
  return { staat: na.gezakt > 0 ? 'gezakt' : 'overleefd', gezakt: na.gezakt };
}

function proefServer(naam) {
  if (NIET_MUTEREN.has(naam)) return { soort: 'server', staat: 'muteert zelf', reden: NIET_MUTEREN.get(naam) };
  const bestand = path.join(TEST, naam);
  const nul = draaiToets(bestand);
  if (nul.tijdout) return { soort: 'server', staat: 'te langzaam' };
  if (nul.gezakt > 0) return { soort: 'server', staat: 'al rood', gezakteZonderMutatie: nul.gezakt };
  if (!nul.toetsen) return { soort: 'server', staat: 'geen toetsen gedraaid' };
  if (nul.alGeslagen) return { soort: 'server', staat: 'slaat zichzelf over', overgeslagen: nul.overgeslagen };
  const na = draaiToets(bestand, { RTG_LIEG: '/api/' }, WACHT_MUTATIE);
  if (na.tijdout) return Object.assign(tijdoutMaarMeetbaar(bestand, { RTG_LIEG: '/api/' }, 'server'),
    { operator: 'liegpoort /api/' });
  return na.gezakt > 0
    ? { soort: 'server', staat: 'gezakt', operator: 'liegpoort /api/', gezakt: na.gezakt }
    : { soort: 'server', staat: 'overleefd', operator: 'liegpoort /api/' };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const losse = args.filter(a => !a.startsWith('--'));
  const alleen = args.includes('--puur') ? 'puur' : args.includes('--server') ? 'server' : null;

  /* EERST OPRUIMEN WAT EEN VORIGE RONDE HEEFT LATEN STAAN, en het HARDOP zeggen.
     Een stille opruiming laat niemand weten dat er iets was blijven liggen, en dan
     mist iedereen het patroon dat de motor wordt afgebroken op een manier die zijn
     handlers niet halen (kill -9, of een SIGTERM tijdens spawnSync). */
  const opgeruimd = ruimEerderOp();
  if (opgeruimd.length) {
    console.log('  LET OP: een vorige ronde is afgebroken met een mutatie open. Teruggezet:');
    for (const p of opgeruimd) console.log('    ' + path.relative(WORTEL, p));
    console.log('');
  }
  if (args.includes('--opruimen')) { console.log(opgeruimd.length ? '' : '  niets om op te ruimen\n'); process.exit(0); }

  let namen = fs.readdirSync(TEST).filter(n => n.endsWith('.test.js')).sort();
  if (losse.length) namen = losse.map(a => path.basename(a));

  const puur = namen.filter(n => !isServerToets(n));
  const server = namen.filter(n => isServerToets(n));
  console.log('\nDE MUTATIEMOTOR -- ' + puur.length + ' pure toetsen (bronmutatie), ' +
    server.length + ' servertoetsen (liegpoort)\n');

  /* De vastgelegde uitslag EN de voortgang van een afgebroken ronde. De tweede
     wint bij een botsing: die is later. */
  const laad = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')).toetsen || {}; } catch (e) { return {}; } };
  const vastgelegd = laad(UITSLAG);
  const onderweg = laad(VOORTGANG);
  const uitslag = Object.assign({}, vastgelegd, onderweg);
  /* EN ZEG HET ALS DE VOORTGANG IETS ANDERS ZEGT DAN HET REGISTER.

     De voortgang staat buiten de repo (server/data/, in .gitignore) en wint bij
     een botsing, want die is later. Dat klopt -- maar hij deed het STIL, en dat
     is hoe vandaag vijf uitslagen van "gezakt" naar "overleefd" schoven zonder
     dat er een regel code veranderd was: een eerdere ronde was afgebroken tussen
     fase A en A-diep, de ondiepe tussenstand bleef in de voortgang staan, en de
     eerstvolgende ronde schreef hem als oordeel naar MUTATIES.json.

     De vlag `voorlopig` hierboven voorkomt dat nu bij de bron. Deze regel is het
     net eronder: wie een ronde start, hoort te ZIEN dat er een oude tussenstand
     meekomt en wat die verandert (LAT.md regel 5). */
  const botsingen = Object.keys(onderweg)
    .filter((k) => vastgelegd[k] && vastgelegd[k].staat !== onderweg[k].staat);
  if (botsingen.length) {
    console.log('  LET OP: een openstaande voortgang (server/data/) zegt over ' + botsingen.length +
      ' toets(en) iets anders dan MUTATIES.json, en die wint:');
    for (const k of botsingen.slice(0, 10))
      console.log('    ' + k.padEnd(42) + vastgelegd[k].staat + ' -> ' + onderweg[k].staat +
        (onderweg[k].voorlopig ? '  (voorlopig: de diepe ronde moet er nog overheen)' : ''));
    if (botsingen.length > 10) console.log('    ... en nog ' + (botsingen.length - 10));
  }
  const opnieuw = args.includes('--opnieuw');
  /* Na ELK bestand wegschrijven, en overslaan wat er al in staat. Het serverdeel
     duurt uren; een motor die alleen aan het eind wegschrijft verliest bij een
     ctrl-C alles, en dan draait niemand hem ooit af. */
  /* Op naam gesorteerd wegschrijven, en NIET met de replacer-array van
     JSON.stringify: die filtert ook de sleutels van de geneste objecten weg, dus
     dan staat er wel een nette lijst met bestandsnamen en geen enkele uitslag
     erachter. Een gesorteerde kopie bouwen is de saaie en juiste manier. */
  const schrijf = (doel) => {
    const op = {};
    for (const k of Object.keys(uitslag).sort()) op[k] = uitslag[k];
    fs.mkdirSync(path.dirname(doel), { recursive: true });
    fs.writeFileSync(doel, JSON.stringify({ toetsen: op }, null, 2) + '\n');
  };
  const bewaar = () => schrijf(VOORTGANG);      // na elk bestand: buiten de repo
  const vastleggen = () => schrijf(UITSLAG);    // na een fase: in de repo

  /* ALLEEN OPNIEUW METEN WAT VERLOPEN IS -- en dat gat was er een van tekst.

     scripts/bewijsvers.js eindigde met "Opnieuw meten: node scripts/mutatie.js
     (die stempelt de uitslag met de inhoud)". Dat was niet waar: gedaan()
     hieronder slaat alles over wat al in het register staat, dus die aanroep
     deed voor de 874 verlopen uitslagen precies niets. Wie het wel wilde had
     alleen --opnieuw, en dat is de hele suite van voren af aan -- uren voor het
     serverdeel, waarvan het grootste deel al vers was.

     --verlopen leest dezelfde regel die de METER leest (bewijsvers.meet), en
     doet over wat daar verlopen heet. Een tweede definitie van "verlopen" hier
     zou binnen een week uit de pas lopen met de meter, en dan meet de motor iets
     anders dan de ratel telt (LAT.md regel 4). */
  let verlopenNamen = null;
  if (args.includes('--verlopen')) {
    const u = require('./bewijsvers').meet({ wortel: WORTEL });
    /* Geen leesbaar register is geen lege lijst maar een kapotte vraag: dan zou
       --verlopen netjes nul bestanden draaien en klaar melden (LAT.md regel 3). */
    if (!u) { console.error('Geen leesbare MUTATIES.json; --verlopen weet dan niet wat verlopen is.'); process.exit(1); }
    verlopenNamen = new Set(u.lijst.map(x => x.naam));
    console.log('  --verlopen: ' + verlopenNamen.size + ' van de ' + u.metBewijs +
      ' bewijzen is verlopen; de rest blijft staan.');
  }

  const gedaan = (naam) => moetOverslaan(naam, { uitslag, opnieuw, verlopenNamen });

  /* OM DE VIJFENTWINTIG OOK IN DE REPO, en die regel kostte honderdtachtig
     metingen om te leren. De voortgang stond buiten de repo (server/data/, in
     .gitignore) zodat de werkboom niet uren openstond. Toen werd de container
     opnieuw opgebouwd: /tmp weg, de worktree weg, server/data/ weg. Wat er
     overbleef was wat er GECOMMIT stond -- 141 van de 320 metingen.

     Duurzaamheid komt hier dus niet van een bestand op schijf maar van pushen.
     Een fase van 399 bestanden is te lang om als eenheid te bewaren, dus legt de
     motor nu elke 25 bestanden tussentijds vast. Dat is een open werkboom van
     een paar minuten in ruil voor werk dat een herstart overleeft. */
  const OM_DE = 25;
  let sindsVastleggen = 0;

  /* WANNEER IS EEN MUTATIEBEWIJS NOG WAAR?

     MUTATIES.json zegt: "toets X zakte toen we regel Y in module Z veranderden".
     Dat is het sterkste bewijs dat er in dit huis bestaat -- het is de enige
     meting die aantoont dat een toets kan zakken (LAT-regel 9). En het stond
     zonder enige houdbaarheid opgeschreven: 924 uitslagen zonder een spoor van
     WAAROVER ze gingen. Verandert module Z daarna, dan gaat het bewijs over code
     die er niet meer is, en niets merkt dat.

     Een houdbaarheidsdatum op de KLOK zou hier fout zijn. Een module die een jaar
     niet is aangeraakt, is nog even bewezen als gisteren; een module die een uur
     geleden veranderde, niet meer. De regel hangt dus aan de INHOUD:

       een pure meting  verloopt zodra de gemuteerde module OF het toetsbestand
                        van inhoud verandert
       een servermeting verloopt zodra het toetsbestand verandert -- daar wordt
                        geen bron gemuteerd maar het ANTWOORD van een route
                        (liegpoort), en wat die meting aantoont is dat DEZE toets
                        het merkt

     scripts/bewijsvers.js rekent dat na en telt wat er verlopen is. Uitslagen van
     voor deze regel hebben geen stempel en tellen daarom als verlopen: we weten
     het niet, en dat is precies wat de meter hoort te zeggen. */
  const sha = (p) => {
    try { return require('crypto').createHash('sha256').update(fs.readFileSync(p)).digest('hex').slice(0, 12); }
    catch (e) { return null; }
  };
  const stempel = (naam, r) => {
    if (!r || typeof r !== 'object') return r;
    const uit = Object.assign({}, r);
    uit.toetsSha = sha(path.join(TEST, naam));
    if (r.module) uit.moduleSha = sha(path.join(WORTEL, r.module));
    return uit;
  };

  const doe = (lijst, proef) => {
    let n = 0;
    for (const naam of lijst) {
      n++;
      if (gedaan(naam)) { continue; }
      const r = proef(naam);
      uitslag[naam] = stempel(naam, voorlopigMaken(r));
      bewaar();
      if (++sindsVastleggen >= OM_DE) { vastleggen(); sindsVastleggen = 0; console.log('        (tussenstand vastgelegd in MUTATIES.json)'); }
      console.log('  ' + String(n).padStart(4) + '/' + lijst.length + '  ' + naam.padEnd(42) +
        r.staat + (r.operator ? '  [' + r.operator + (r.module ? ' in ' + r.module : '') + ']' : ''));
    }
  };

  if (alleen !== 'server') {
    console.log('  --- A: pure toetsen, bronmutatie (eerste plek per operator) ---');
    doe(puur, (n) => proefPuur(n, 1));
    vastleggen();
    /* DE DIEPE RONDE, alleen over de overlevers. Een overlever kan twee dingen
       betekenen -- de toets legt het gedrag niet vast, of de motor heeft geen code
       geraakt die deze toets aanroept -- en die twee mag je niet op een hoop
       gooien. Meer plekken per operator, en alleen voor de minderheid die het
       nodig heeft; anders kost de eerste ronde al uren. */
    const overlevers = puur.filter(n => uitslag[n] && uitslag[n].staat === 'overleefd');
    if (overlevers.length) {
      console.log('\n  --- A-diep: ' + overlevers.length + ' overlevers, acht plekken per operator ---');
      for (const naam of overlevers) {
        const r = proefPuur(naam, 8);
        // hier is de diepe ronde WEL gelopen, dus dit is een oordeel en geen tussenstand
        uitslag[naam] = stempel(naam, Object.assign({}, r, { voorlopig: undefined }));
        bewaar();
        console.log('        ' + naam.padEnd(42) + r.staat +
          (r.operator ? '  [' + r.operator + ' in ' + r.module + ']' : '  (' + (r.geprobeerd || 0) + ' mutaties geprobeerd)'));
      }
      vastleggen();
    }
  }
  if (alleen !== 'puur') {
    console.log('  --- B: servertoetsen, liegpoort ---');
    doe(server, proefServer);
    vastleggen();

    /* FASE C, DE SCHERPE RONDE. Fase B laat ALLES liegen, ook de deur waardoor
       een toets binnenkomt -- dan struikelt hij bij de voorbereiding en zakt de
       rest vanzelf. Dat telt als afhankelijkheid van echt gedrag, maar bij "399
       van de 399 gezakt" weet je niet meer of het de INHOUD was of de inlog.

       Hier blijven de deuren open (RTG_LIEG_NIET) en liegt alleen het domein
       zelf. Zakt hij dan nog, dan kijkt er echt iemand naar de inhoud. Alleen
       zinvol voor wie in fase B zakte: een overlever daar overleeft dit ook.

       De uitslag komt ERBIJ als `scherp` en vervangt de staat NIET. Zou hij de
       staat overschrijven, dan verdwijnt het onderscheid tussen "hangt niet af
       van echte antwoorden" en "hangt er wel van af, maar niet van zijn eigen
       domein" -- en dat onderscheid is precies waar deze ronde voor is. */
    const scherpKandidaten = server.filter(n => uitslag[n] && uitslag[n].staat === 'gezakt' && !uitslag[n].scherp);
    if (scherpKandidaten.length && !args.includes('--geen-scherp')) {
      console.log('\n  --- C: scherpe ronde, ' + scherpKandidaten.length + ' toetsen, deuren blijven open ---');
      let m = 0;
      for (const naam of scherpKandidaten) {
        const r = proefServerScherp(naam);
        uitslag[naam] = stempel(naam, Object.assign({}, uitslag[naam], { scherp: r.staat }));
        bewaar();
        if (++m % OM_DE === 0) vastleggen();
        console.log('  ' + String(m).padStart(4) + '/' + scherpKandidaten.length + '  ' +
          naam.padEnd(42) + 'scherp: ' + r.staat);
      }
      vastleggen();
    }
  }

  const per = (s) => Object.values(uitslag).filter(x => x.staat === s).length;
  const perScherp = (s) => Object.values(uitslag).filter(x => x.scherp === s).length;
  console.log('\n  gezakt (bewezen gevoelig)  ' + per('gezakt'));
  console.log('  overleefd                  ' + per('overleefd'));
  console.log('  niet te meten              ' + (Object.keys(uitslag).length - per('gezakt') - per('overleefd')));
  const scherpGemeten = perScherp('gezakt') + perScherp('overleefd');
  if (scherpGemeten) {
    console.log('\n  SCHERP (alleen het eigen domein loog, de deuren bleven open)');
    console.log('    zakt op de inhoud        ' + perScherp('gezakt'));
    console.log('    zakte alleen op de inlog ' + perScherp('overleefd'));
  }
  console.log('\n  Uitslag in MUTATIES.json; npm run bewijs zet hem in BEWIJS.md.\n');
}

module.exports = { OPERATOREN, muteer, codemasker, modulesVan, moetOverslaan, voorlopigMaken, naAfbreking, UITSLAG, VOORTGANG, NIET_MUTEREN,
  SPOOR, ruimEerderOp, schrijfSpoor, metMutatie,
  /* De opruimwacht naar buiten, want een wacht die je niet kunt AANROEPEN kun je
     ook niet toetsen -- en dan is hij een belofte. test/mutatiewacht.test.js
     meldt een bestand aan, muteert het, stuurt SIGTERM en kijkt of het terugstaat. */
  aanmelden: (pad, bron) => open.set(pad, bron),
  afmelden: (pad) => open.delete(pad),
  zetTerug };
