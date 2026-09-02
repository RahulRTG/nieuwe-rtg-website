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
           node scripts/mutatie.js --puur        (alleen A)
           node scripts/mutatie.js --server      (alleen B)
           node scripts/mutatie.js --opruimen    (zet een blijven staan mutatie terug)
           node scripts/mutatie.js test/pdf.test.js   (een bestand)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const WORTEL = path.join(__dirname, '..');
const TEST = path.join(WORTEL, 'test');
/* Wanneer gemeten en waartegen; zonder stempel is een register niet na te
   lopen (scripts/lib/stempel.js). */
const { stempel } = require('./lib/stempel');
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
  /* De spiegel van +->-. Zonder hem was elke bewering over een AFTREK
     onraakbaar: de resolutie-correctie in server/meting-lus.js (n/1e6 - 10)
     kon niet omgedraaid worden, en test/eventloop.test.js heette 'overleefd'
     terwijl zijn kernassertie die aftrek juist vastspijkert. */
  { naam: '-->+', zoek: /(\w) - (\w)/, zet: '$1 + $2' },
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
   tekst leest. We bouwen een masker van de bron en muteren alleen op posities
   die daarin "code" zijn. */
function codemasker(bron) {
  const masker = new Array(bron.length).fill(true);
  let i = 0;
  const uit = (a, b) => { for (let k = a; k < b && k < masker.length; k++) masker[k] = false; };
  while (i < bron.length) {
    const twee = bron.slice(i, i + 2);
    if (twee === '/*') { const e = bron.indexOf('*/', i + 2); const z = e < 0 ? bron.length : e + 2; uit(i, z); i = z; continue; }
    if (twee === '//') { const e = bron.indexOf('\n', i); const z = e < 0 ? bron.length : e; uit(i, z); i = z; continue; }
    const c = bron[i];
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < bron.length && bron[j] !== c) { if (bron[j] === '\\') j++; j++; }
      uit(i, j + 1); i = j + 1; continue;
    }
    /* EN EEN REGEXLITERAL, want die kan een aanhalingsteken bevatten.

       Zonder dit las de masker de apostrof in `/url\\(\\s*(['"]?)...\\)/i` als het
       begin van een tekenreeks, en gold alles tot het VOLGENDE aanhalingsteken
       als tekst. In server/middleware/stijlafsplitsing.js sloeg dat 1796 tekens
       echte code over -- de hele magVerhuizen(), met zijn return true en return
       false. De motor meldde dan "geen bruikbare mutatie", en dat leest als
       "hier valt niets te meten" terwijl het "ik kon de code niet zien" was.
       Over server/ gemeten: 5 modules, 13 mutatieplekken onzichtbaar, waaronder
       functies/toegang.js.

       WANNEER IS EEN / EEN REGEX EN WANNEER EEN DEELSTREEP. Daar bestaat geen
       waterdichte regel zonder een echte ontleder, maar wel een die het in
       gewone code altijd goed heeft: een regex kan alleen staan waar een
       WAARDE wordt verwacht. Dus kijken we naar het laatste betekenisvolle
       teken ervoor. Is dat een operator, een haakje-open, een komma of het eind
       van een sleutelwoord als return, dan begint hier een waarde en dus een
       regex. Is het een naam, een cijfer of een haakje-dicht, dan stond er iets
       waar je door KUNT delen. Bij twijfel doen we niets -- dan blijft het
       gedrag zoals het was. */
    if (c === '/') {
      let k = i - 1;
      while (k >= 0 && /\s/.test(bron[k])) k--;
      const vorige = k >= 0 ? bron[k] : '';
      const woord = /[A-Za-z_$]/.test(vorige) ? (bron.slice(0, k + 1).match(/[A-Za-z_$][A-Za-z0-9_$]*$/) || [''])[0] : '';
      const WAARDEWOORD = /^(return|typeof|instanceof|case|in|of|new|delete|void|do|else|yield|await)$/;
      const waardePlek = vorige === '' || '(,=:[!&|?{};+-*%~^<>'.includes(vorige) || WAARDEWOORD.test(woord);
      if (waardePlek) {
        let j = i + 1, inKlasse = false, gesloten = false;
        while (j < bron.length) {
          const t = bron[j];
          if (t === '\\') { j += 2; continue; }
          if (t === '\n') break;                 // een regex loopt nooit over een regeleinde
          if (inKlasse) { if (t === ']') inKlasse = false; j++; continue; }
          if (t === '[') { inKlasse = true; j++; continue; }
          if (t === '/') { gesloten = true; break; }
          j++;
        }
        if (gesloten) {
          let e = j + 1;
          while (e < bron.length && /[gimsuyd]/.test(bron[e])) e++;
          uit(i, e); i = e; continue;
        }
      }
    }
    i++;
  }
  return masker;
}

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

/* TWEE VERSCHILLENDE WACHTTIJDEN, en het verschil komt uit een vastloper.

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
  const vlaggen = ['--test', '--test-reporter=tap'];
  if (forceer) vlaggen.push('--test-force-exit');
  const r = spawnSync('node', vlaggen.concat([bestand]), {
    cwd: WORTEL, encoding: 'utf8', timeout: wacht || WACHT_NUL, maxBuffer: 64 * 1024 * 1024,
    /* SIGKILL EN NIET HET STANDAARD SIGTERM, en dat is geen ruwheid maar een
       lek dat ik heb zien ontstaan. Bij een time-out stuurt spawnSync SIGTERM,
       en juist de toetsen die hier vastlopen (test/redis.test.js) blijven hangen
       op een handle die niet meer opruimt -- die negeren dat sein. Ik zag twee
       kindprocessen van dezelfde toets naast elkaar draaien terwijl spawnSync er
       maar EEN kan hebben: de eerste was een wees van een afgelopen time-out.
       Over een ronde van uren stapelen die zich op, houden ze poorten en geheugen
       vast, en vervuilen ze de metingen die erna komen. */
    killSignal: 'SIGKILL',
    env: Object.assign({}, process.env, env || {})
  });
  const uit = String(r.stdout || '');
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
  /* De Workspace-platformtoets laadt browsermodules bewust in een VM en heeft
     daardoor geen statische require die modulesVan() kan vinden. Dit is wel
     degelijk zijn bron: de SDK-validatie omkeren laat de eerste en tweede
     bewering zakken. De expliciete koppeling voorkomt dat een echte VM-toets
     als "geen module gevonden" buiten de mutatiemeting blijft. */
  ['workspace-platform.test.js', ['public/shared/interface/module-sdk.js']],
  /* DE TENANTLAAG: twee toetsen die de server als kindproces starten en dus
     geen require van hun module dragen. Beide regels zijn met een mutatie
     nagetrokken en niet gegokt.

     tenant.test.js -> kern/tenant/index.js: de merkcontrole eruit halen
     (`if (t.merk) return t.merk`) laat toets 4 zakken, en de groepsafbeelding
     zonder tenant toestaan laat toets 5 zakken. -> kern/tenant/bootstrap.js:
     een lege `quotas: {}` in het antwoord zetten laat toets 6 zakken.

     werkmerk.e2e.js -> public/apps/werk/merk.js: de herkomstregel uit de voet
     laten laat hem zakken. De grenscontrole zelf (de kleur die buiten de
     merkbalk lekt) zit in de CSS en niet in een module -- die mutatie is met
     de hand gedaan en staat in TENANT.md, niet hier. */
  ['tenant.test.js', ['server/kern/tenant/index.js', 'server/kern/tenant/bootstrap.js']],
  ['werkmerk.e2e.js', ['public/apps/werk/merk.js']],
  /* tenantuitgang.test.js start de server als kindproces. Nagetrokken: de
     GEHEIM-lijst leegmaken laat toets 1 zakken, de invoer over een bestaande
     werkruimte laten schrijven laat toets 3 zakken, en de bewaringsplicht
     negeren laat toets 6 zakken. */
  ['tenantuitgang.test.js', ['server/kern/tenant/uitgang.js', 'server/kern/tenant/levensloop.js']],
  /* tenantcontract.test.js start de server EN draait daarnaast de teller los.
     Nagetrokken: de grens op het aantal werkruimtes weghalen laat toets 1
     zakken, en de teller niet laten bijten laat toets 5 zakken. */
  ['tenantcontract.test.js', ['server/kern/tenant/contract.js']],
  /* tenantbewijs.test.js: nagetrokken met drie mutaties -- de SLA zonder zijn
     voorwaarden op ja, het auditspoor als vast vinkje, en een bron die blijft
     staan als de bewering vervalt. Alle drie raak. */
  ['tenantbewijs.test.js', ['server/kern/tenant/bewijs.js']],
  /* scimgroepen.test.js praat SCIM tegen de kindserver. Nagetrokken: de
     nesting-weigering weghalen laat toets 2 zakken, en de org-grens in
     groepen.js weghalen laat toets 3 zakken. */
  ['scimgroepen.test.js', ['server/scim/groepen.js']],
  /* werkcommandbalk.e2e.js draait in een browser tegen de kindserver.
     Nagetrokken: de rechtenscheiding in public/apps/werk/kern.js weghalen (elke
     403 weer als "uw sleutel deugt niet" lezen) laat hem zakken. */
  ['werkcommandbalk.e2e.js', ['public/apps/werk/kern.js', 'public/apps/werk/command.js']],
  /* werkhandeling.test.js: nagetrokken met drie mutaties -- de
     bevestigingscontrole weghalen, het recht niet opnieuw rekenen bij de
     uitvoering, en een plan van een ander uitvoerbaar maken. Alle drie raak. */
  ['werkhandeling.test.js', ['server/bedrijf/handeling.js']],
  /* werkgevolg.test.js: nagetrokken met vijf mutaties, alle vijf raak -- de
     wachtende taken van anderen weglaten (toets 2), het rechtenhek op de
     servicekant weghalen (toets 3), een bijwerking in de simulatie zetten
     (toets 1, en dan vallen er vijf om), de taken BUITEN een gestopt project
     niet meer tellen (toets 4), en nietGerekend leegmaken (toets 5). */
  ['werkgevolg.test.js', ['server/bedrijf/gevolg.js']],
  /* DE SAML-DEUR. Dertien mutaties met de hand geprobeerd, dertien raak -- en
     een veertiende die NIET raak was omdat hij niet muteerde: de zin
     `if (!X.isNazaatVan(assertie, gecontroleerd))` staat ook in de KOP van
     antwoord.js, dus de eerste vervanging trof het commentaar en de code bleef
     staan. Dat zag eruit als een overlevende toets terwijl er niets was
     veranderd. Vandaar dat deze motor op de code-regel muteert en niet op een
     losse zin, en vandaar dat het hier staat: een mutatie die je niet hebt zien
     landen, is geen mutatie.

     samlxsw -> antwoord.js: de isNazaatVan-regel eruit (toets 3), het publiek
     niet controleren (8), het verlopen niet controleren (7), meer dan een
     assertie toestaan (2). -> handtekening.js: de ouder-koppeling eruit (4),
     dubbele IDs toestaan (10), de digestvergelijking altijd goed (6), sha1
     alsnog toestaan (11).
     samlc14n -> c14n.js: de attributen niet sorteren, de naamruimten niet
     sorteren. Beide zakken tegen libxml2 en niet tegen onszelf.
     samlpoort -> sso/saml/index.js: een verzoek niet verwijderen bij gebruik,
     de org-controle op een verzoek eruit, een assertie zonder ID toelaten. */
  ['samlxsw.test.js', ['server/sso/saml/antwoord.js', 'server/sso/saml/handtekening.js']],
  ['samlc14n.test.js', ['server/sso/saml/c14n.js', 'server/sso/saml/xml.js']],
  ['samlpoort.test.js', ['server/sso/saml/index.js']],
  /* DE MERKKERN als enige bron. Zes mutaties, zes raak -- maar niet allemaal
     tegen dezelfde toets, en dat is met opzet. merkkern.test.js kent de
     WAARDEREGELS en de STRUCTUUR (de drie consumenten lezen de definitie en
     dragen er geen kopie meer van); dat de drie er ook echt doorheen LOPEN, is
     alleen te zien aan hun eigen servertoetsen. De rechtencontrole van webmerk
     uitzetten laat merkkern.test.js dus groen -- en webplatform.test.js zakken.
     Zo hoort het: een structuurtoets die runtime-gedrag claimt, claimt te veel.

     merkkern -> tenant/merkkern.js: de hexcontrole eruit, de themalijst eruit,
     `huidig` muteren in plaats van kopieren. Alle drie raak.
     webplatform -> kern/webmerk.js, huisstijl -> kern/theater/huisstijl.js,
     journalistiek-redactie -> kern/journalistiek.js: elk de weigering
     overslaan, en elk raak. */
  ['merkkern.test.js', ['server/kern/tenant/merkkern.js']],
  /* DE ORGANISATIESTAND OP HET SCHERM. Vijf mutaties, vijf raak: alleen de
     groene vinkjes tonen (dan is het weer een badgemuur), de rechtencontrole
     op /api/tenant/status weghalen, een beschikbaarheidscijfer in het
     platformblok zetten, de extra weergaven niet sluiten bij een tabwissel, en
     Ververs weer laten gokken welk scherm er open staat. */
  ['werkstatus.e2e.js', ['public/apps/werk/status.js', 'public/apps/werk/app.js']],
  /* DE METING PER CAPABILITY. Vier mutaties, vier raak: de vloer eruit (dan
     krijgt drie verzoeken een geruststellende 0,0%), routes zonder functie
     weglaten (dan klopt het totaal terwijl er iets ontbreekt), een 4xx als
     storing meetellen (dan telt elke verkeerde inlog als downtime), en een
     gooiende functiekaart laten doorslaan (dan is een fout in de CATALOGUS een
     storing in de METING). */
  ['metingcapaciteit.test.js', ['server/meting-capaciteit.js']],
  /* DE HERSTELPROEF. Vijf mutaties, vijf raak -- maar DRIE ervan overleefden
     eerst, en dat was terecht: ze gaan over dingen die via de API niet waar te
     nemen zijn. De tijdelijke werkruimte laten staan is onzichtbaar zolang er
     geen leespad naar de werkruimtebak is; `gelukt: true` hardcoderen valt niet
     op zolang elke echte proef slaagt; en een proef die nooit verloopt merk je
     pas over een halfjaar. Met een nagemaakte uitgang (toets 8, 9 en 10) zijn
     ze alle drie wel te zien. Een toets die alleen kijkt waar het licht is,
     dekt niet wat hij lijkt te dekken. Vijfde: een mislukte proef alsnog als
     bewijs tellen. */
  ['tenantherstelproef.test.js', ['server/kern/tenant/herstelproef.js', 'server/kern/tenant/bewijs-sla.js']],
  /* DE BACK-UPSTAND. Vijf mutaties, vijf raak: alles compleet noemen (dat IS de
     oude toestand -- de bewering hing aan een mapnaam), de leegtecontrole eruit,
     db.json niet openen, een leeg -wal toch als fout tellen (het valse alarm dat
     de meter waardeloos maakt), en de oudste in plaats van de nieuwste back-up
     pakken. */
  ['backupstand.test.js', ['server/backupstand.js']],
  /* Nagemeten: RTG_DOMAINS negeren laat hem zakken op de 404 van supplier, en
     nul domeinen ophangen laat hem zakken op de 401 van member. Beide in deze
     module, en beide gezakt. */
  ['domeinalleen.test.js', ['server/opzet/routes.js']],
  /* VIER TOETSEN DIE DE LIEGPOORT OVERLEEFDEN OMDAT HIJ ZE NIET RAAKT, en dat
     is precies waar de uitleg hierboven over gaat: het overleven zei niets over
     de toets en alles over de verkeerde proef. Alle vier bevatten een require
     van de helper (dus vielen ze in het servervak), maar geen van vieren leest
     iets van /api/ -- ze beproeven een module die ze zelf binnenhalen. */
  ['strenge-poort.test.js', ['test/helper.js']],
  /* DE TWEE SCHERMEN VAN RTG LINK. Ze stonden in BEWIJS.md als "overleefd", en
     dat was net als hierboven een uitspraak over de PROEF en niet over de toets:
     allebei laden ze een BROWSERmodule uit public/shared/ met een require, en de
     modulezoeker hieronder kijkt alleen naar server-paden. Er is dus nooit een
     mutatie op geschoten. Nu wel. */
  ['linkkaart.test.js', ['public/shared/linkkaart.js']],
  ['linkkoppelingenui.test.js', ['public/shared/linkkoppelingen.js']],
  /* DE TEKSTBAAN EN DE HERKENNER ERONDER (TAKEN.md 4.31). Zelfde vorm als de
     twee hierboven: ze laden een BROWSERmodule met readFileSync in plaats van
     met een require, dus de modulezoeker vindt hem niet en er schiet nooit een
     mutatie op. Zonder deze twee regels tellen ze als "niet gemeten" terwijl er
     wel een toets op staat -- en dat is precies de meter die het goede zou
     bestraffen. */
  ['meelezen.test.js', ['public/shared/meelezen.js']],
  ['spraaktekst.test.js', ['public/shared/spraaktekst.js']],
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
  /* DE TRANSACTIE- EN SAMENVOEGTOETSEN, en waarom ze "overleefden".

     Deze vier stonden als overlever in MUTATIES.json, en dat is het zwaarste
     verwijt dat deze motor kan maken: de toets legt het gedrag niet vast. Hier
     was dat niet waar. Ze laden alle vier `require('../server/db')` -- de
     ORKESTRATOR -- terwijl hun onderwerp een laag dieper woont: het afkappen en
     archiveren in db/tx/index.js, de index in db/tx/ledger.js, en de
     driewegsamenvoeging in db/merge.js. De motor muteerde dus achtentwintig keer
     een bestand waar deze toetsen niets over beweren, en noteerde vervolgens dat
     ZIJ tekortschoten.

     Dat is exact de fout die vier regels hierboven al eens is gemaakt en
     opgeschreven ("dat is de toets de schuld geven van iets wat hij niet heeft
     gedaan"). Een overlever is pas een bevinding als de mutatie het juiste
     bestand raakte; anders is het een bevinding over de toewijzing.

     Nagemeten na deze verhuizing: alle vier zakken op een echte bronmutatie in
     hun eigen module. */
  ['txkap.test.js', ['server/db/tx/index.js']],
  ['txindex.test.js', ['server/db/tx/index.js']],
  ['txgeld.test.js', ['server/db/tx/index.js', 'server/db/tx/collecties.js']],
  ['merge3.property.test.js', ['server/db/merge.js']],
  /* Zelfde soort misgreep: server/db/gidsen.js is een samenvoeglaag van
     zevenendertig regels die twee registers tot een API smeedt. Wat deze toets
     bewaakt -- de synchrone omgekeerde cache (ledenRev) die een net actief lid
     meteen op codenaam vindbaar maakt, ook voordat de INSERT geland is -- woont
     in ./ledengids.js. */
  ['ledengids-race.test.js', ['server/db/ledengids.js']],
  /* Zelfde vorm nog eens: server/kern/concern/index.js is de orkestrator van
     negentien bestanden en 2522 regels. De drie beweringen van concern.test.js
     wonen elders -- de bronplicht bij een juridisch gegeven in ./bron.js, de
     tijdmachine (een feit wordt nooit overschreven) in ./tijd.js, en de
     bestuurderswissel in ./verandering.js en ./entiteit.js. */
  ['concern.test.js', ['server/kern/concern/bron.js', 'server/kern/concern/tijd.js',
    'server/kern/concern/verandering.js', 'server/kern/concern/entiteit.js']],
  /* En nog eens: server/kern/comm/index.js voegt negentien bestanden samen.
     comm-deelnemer.test.js gaat over het correctievenster, over wie er aan een
     bericht mag komen en over intrekken -- dat woont in ./deelnemer.js en
     ./bericht.js. */
  ['comm-deelnemer.test.js', ['server/kern/comm/deelnemer.js', 'server/kern/comm/bericht.js']],
  /* DE GELDMOTOR. Deze twee toetsen laden server/kern/pay/motorklant.js, en dat
     is sinds de samenvoeging een schil van dertig regels: twee paden, twee
     namen, klaar. De motor vond daar terecht "geen bruikbare mutatie" -- niet
     omdat de toetsen niets vastleggen, maar omdat het gedrag een laag dieper
     woont. Dat is precies waar dit register voor is.

     Nagemeten met de hand, en alle tien raak: bij motorzekering.test.js slaan de
     verwisselde storingsdrempel (elke niet-2xx als storing), een zekering die
     nooit opent, een half-open die de hele wachtrij doorlaat, een ontbrekend dak
     op de antwoordgrootte en een ontbrekende gelijktijdigheidsgrens allemaal
     aan; bij motorverbinding.test.js de verwisselde grootboekpaden, het niet
     afronden van centen, een weigering die als geslaagd telt, en het weghalen
     van de fail-closed op een ontbrekende URL. */
  ['motorzekering.test.js', ['server/kern/motorzekering.js']],
  ['motorverbinding.test.js', ['server/kern/motorverbinding.js', 'server/kern/motorzekering.js']],
  /* DE ROLLENVRAAG, vier bestanden. Deze toetsen zijn servertoetsen -- ze zetten
     twee echte partijen op en laten de een bij de ander proberen -- en de
     liegpoort kan er dus niets over zeggen. De module waar hun bewering woont is
     per bestand een andere:

       geld-rollen-school.test.js  de schoolpoort (het token wordt tegen de
                                   GEVONDEN school gehouden, niet andersom) en de
                                   twee financiele lagen die alles door g.sch
                                   opzoeken;
       geld-rollen-zaken.test.js   de horeca-rekening, waar de zaak uit de sessie
                                   komt (H(req.supplier.code)) en het rekening-id
                                   uit de body;
       geld-rollen-buiten-bank.test.js  de rechterhand, waar de scope req.session.key
                                   is en het meegestuurde id BINNEN dat dossier
                                   wordt gezocht.

     Met de hand nagemeten, alle drie raak: `if (beheer)` in plaats van
     `if (beheer && sch.token === beheer)` laat school B met de code van A binnen
     (toets 2 zakt); de factuur- en leerlingopzoeking over ALLE scholen heen laat
     B op de factuur van A boeken en die op 'voldaan' zetten (toets 3 zakt); en
     rekVan over alle zaken heen laat zaak B bij de omzet van A (toets 2 zakt). */
  ['geld-rollen-school.test.js', ['server/school/rollen.js', 'server/school/financien.js', 'server/school/financien-beheer.js']],
  ['geld-rollen-zaken.test.js', ['server/routes/supplier/horeca/rekening.js', 'server/routes/supplier/horeca/betalen.js']],
  ['geld-rollen-buiten-bank.test.js', ['server/routes/member/rechterhand.js']],
  ['geld-rollen-werkruimte.test.js', ['server/bedrijf/index.js', 'server/bedrijf/it.js']],
  /* De noodrem. De toets zet echte inlogpogingen op een echte server, dus de
     liegpoort kan er niets over zeggen; het gedrag woont in de teller van
     server/beveiliging.js en in de bron die server/server.js meegeeft.
     Met de hand nagemeten, beide raak: `.map(m => m.sleutel)` terugzetten laat
     toets 2 zakken (een aanvaller sluit het huis weer), en de drempel
     onbereikbaar hoog zetten laat toets 3 zakken (dan is de noodrem weg). */
  ['noodrem-bron.test.js', ['server/beveiliging.js', 'server/server.js']],
  /* De zesde rollenvraag. De grendel is profielVan() -- een token wordt BINNEN
     het gezin gezocht -- en de rem tegen het raden van een gezinscode staat in
     foundation/basis.js. Met de hand nagemeten en raak: profielVan over alle
     gezinnen heen laten zoeken laat toets 2 zakken. */
  ['geld-rollen-gezin.test.js', ['server/foundation/gezinshulp.js', 'server/foundation/basis.js']],
  /* De dekkingsmeter start als KINDPROCES (hij is een CLI, geen module), dus zijn
     toets noemt hem nergens in een require en de motor meldde "geen module
     gevonden". Dat is dezelfde grens als bij de schermtoetsen hieronder. */
  ['dekking.test.js', ['scripts/dekking.js']],
  /* TLS aan of uit, in de hele server en in de poortwachter. Drie mutaties met
     de hand nagetrokken en alle drie raak: het schema in de opstartmelding
     (luister.js), het maken van de TLS-server (web/index.js) en de schakelaar van
     de poortwachter (trio.js). web/index.js staat vooraan omdat die de zwaarste
     bewering draagt -- praat hij echt https. */
  ['tls-boot.test.js', ['server/web/index.js', 'server/opzet/luister.js', 'server/trio.js']],
  /* DE GEVEL-OVERLEVERS. Deze toetsen laden een index.js die alleen delen aan
     elkaar knoopt of her-exporteert; de logica die ze vastleggen woont in de
     delen ernaast, en die zag de motor dus nooit. Per toets staat hier de
     module die hij echt op de proef stelt, in de volgorde van de zwaarste
     bewering -- en elke regel is daarna door de motor BEVESTIGD (gezakt), naar
     de afspraak hierboven: een geraden module geeft de toets de schuld van de
     lijst. */
  ['concern.test.js', ['server/kern/concern/tijd.js', 'server/kern/concern/graaf.js', 'server/kern/concern/scope.js', 'server/kern/concern/readiness.js', 'server/kern/concern/uitnodiging.js', 'server/kern/concern/index.js']],
  ['comm-deelnemer.test.js', ['server/kern/comm/deelnemer.js', 'server/kern/comm/index.js']],
  ['scriptbundel.test.js', ['server/middleware/scriptbundel-rij.js', 'server/middleware/scriptbundel.js']],
  /* Vier servertoetsen die de liegpoort overleefden omdat hun bewering niet
     over API-antwoorden gaat: het genre-register en de toegangsstand (een
     waarheid in seed/kern), de loghygiene (wat er in het LOG staat) en de
     strenge poort (de bewaker in test/helper.js zelf). Een eigen module wint
     van de liegpoort -- zie de kop van isServerToets. */
  ['genreregister.test.js', ['server/seed/genres.js']],
  ['genretoegang.test.js', ['server/kern/aanmeldingen/bedrijf.js', 'server/seed/genres.js']],
  ['loghygiene.test.js', ['server/log.js', 'server/routelog.js']],
  ['ledengids-race.test.js', ['server/db/ledengids.js', 'server/db/gidsen.js']],
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
  /* Het randenstelsel wordt als browsercode en tekstuele ontwerpcontracten
     geladen. De require-scanner kan die productbronnen daarom niet zelf zien;
     deze drie modules dragen de wereldcatalogus, bediening en functiebibliotheek. */
  ['edge-system.test.js', [
    'public/shared/rtg-edge-worlds.js',
    'public/shared/rtg-edge-system.js',
    'public/shared/rtg-edge-library.js'
  ]],
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
  /* Deze ratel staat op NUL, en dat is precies wat hem onmeetbaar maakt voor de
     motor: meet() leest de echte testmap, telt daar nul wachten, en elke
     gedragsmatige mutatie in scripts/klokwacht.js laat dat nul. Nul in, nul uit.
     Twee mutaties geprobeerd, allebei overleefd -- en dat is hier geen uitspraak
     over de toets.

     De juiste mutatie zit in de TELLING zelf (het commentaar niet strippen, de
     haak uit het patroon halen), en dat zijn wijzigingen aan een reguliere
     expressie; die operator heeft deze motor niet. Daarom is de telling apart
     gezet als telIn() en met de HAND op beide fouten nagetrokken: het
     commentaar niet strippen laat alle vier de beweringen zakken, de haak
     weghalen laat de vierde zakken. Zonder die twee zou "de schuld staat op nul"
     een bewering zijn over een meter die niemand ooit heeft zien uitslaan. */
  ['klokwacht.test.js', 'overleefde 2 mutaties in scripts/klokwacht.js, en dat kan niet anders: de ratel staat op nul, dus een gedragsmatige mutatie in de teller laat de uitkomst nul. De telling zelf is apart gezet (telIn) en met de hand op twee echte fouten nagetrokken -- commentaar niet strippen, en de haak uit het patroon -- die allebei raak zijn'],
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
  /* DE TWEE SCHERMEN VAN RTG LINK, na drie en een mutaties in EIGEN_MODULE (zie
     daar waarom ze eerst NUL mutaties kregen). Ze overleven, en dat is hier een
     uitspraak over de OPERATOREN: het zijn opbouwmodules die tekst en markup
     samenstellen, en geen enkele bronoperator raakt een letterlijke string of
     een filter dat een lege lijst oplevert.

     De foutklassen die ze WEL bewaken zijn met de hand nagetrokken, en alle
     vier RAAK:
       linkkaart        de knop-zonder-weg-rem weghalen (`i.weg &&` uit de
                        filter) -> toets 3 zakt. `gegevens` stilletjes leeg
                        teruggeven -> toets 1 en 5 zakken.
       linkkoppelingen  `esc` de ruwe tekst laten teruggeven -> toets 7 zakt.
                        Alleen het AANHALINGSTEKEN uit de ontsmetter halen ->
                        toets 7 zakt sinds die toets ook de attribuut-sink
                        (data-trek="...") beproeft; daarvoor bleef hij groen, en
                        dat was een echt gat.
     De passende operator zou een hernoemer van stringliteralen zijn, of een die
     een filterconditie omkeert; die heeft deze motor niet. */
  ['linkkaart.test.js', 'overleefde 3 mutaties in public/shared/linkkaart.js. Een opbouwmodule: geen rekenend gedrag dat een bronoperator raakt. Met de hand nagetrokken op de foutklassen die hij wel bewaakt (de knop-zonder-weg-rem, en "welke gegevens" stilzwijgend leeg): driemaal raak'],
  ['linkkoppelingenui.test.js', 'overleefde 1 mutatie in public/shared/linkkoppelingen.js. Idem: opbouwmodule. Met de hand nagetrokken op het ontsmetten -- ruw teruggeven en alleen het aanhalingsteken weglaten laten hem allebei zakken; dat tweede pas sinds de toets ook de attribuut-sink beproeft'],
  ['boot-smoke.test.js', 'overleefde 45 mutaties in server/server.js, en terecht: deze toets is bewust ONDIEP -- de server komt op en de wortel geeft de ROS-poort, meer beweert hij niet. De juiste mutatie zit in de wortelroute of in de pagina, niet in de bron'],
  ['poortrace.test.js', 'overleefde 45 mutaties in server/server.js. De bewering gaat over hoe een EADDRINUSE wordt BENOEMD in het log, niet over rekenend gedrag; een operator raakt dat niet'],
  ['eu-naleving.test.js', 'overleefde 5 mutaties. Deze toets vergelijkt beweringen uit EU.md met code die er nog STAAT; een operator verandert wat code doet en niet dat hij bestaat. De juiste mutatie is de code weghalen of het document laten liegen'],
  ['randen.test.js', 'overleefde 42 mutaties in public/shared/randen.js en rahul-mond.js. Hij toetst of PAGINA\'S de bladen laden en dat er geen zwevende knop terugsluipt -- structuur van de markup, niet gedrag van de module'],
  /* Twee keer dezelfde les als hierboven, en allebei met de hand nagetrokken.

     rahul-hart: de motor muteerde server/kern/rahul.js, want daar staat de
     EXPORT van RAHUL_BASIS. De tekst zelf woont in server/kern/rahul-hart.js.
     Ik heb hem eerst in het verkeerde bestand gemuteerd en kreeg groen -- wat
     precies laat zien hoe overtuigend een verkeerde toewijzing liegt. In het
     JUISTE bestand is hij tweemaal raak: 'Frenna' uit de passies halen laat
     toets 1 zakken, en scrypt -> md5 laat toets 2 zakken (het security-verhaal
     dat met de code moet kloppen). Wat hij vastlegt is TEKST; geen enkele
     bronoperator raakt een letterlijke string. */
  ['rahul-hart.test.js', 'de tekst staat in server/kern/rahul-hart.js en niet in de module die de export draagt; wat hij vastlegt zijn woorden in een system prompt, en geen bronoperator raakt een letterlijke string. Met de hand tweemaal raak: een passie weghalen laat toets 1 zakken, scrypt -> md5 laat toets 2 zakken'],
  /* consent-dekking is een CENSUS over de broncode: hij zoekt modules met de
     toestemmingsvorm en eist dat elk in het register staat of een reden heeft.
     Een operator verandert wat code DOET, niet welke bestanden er zijn -- de
     juiste mutatie is een module toevoegen of uit het register halen. En die
     ijkt de toets al zelf: zijn derde bewering is "de scan kan een nieuwe laag
     ook echt vinden", dus hij toont zijn eigen gevoeligheid. */
  ['consent-dekking.test.js', 'een census over de broncode (welke modules bestaan en staan ze in het register), niet over rekenend gedrag; een bronoperator kan daar niet bij. De toets ijkt zichzelf al: zijn derde bewering laat de scan een nieuwe laag vinden'],
  /* Nagetrokken: een aanroep verzinnen die niet bestaat (accounts.bestaatNietXX)
     laat toets 1 zakken, en verifyToken uit de users-export halen laat beide
     toetsen zakken. Wat hij vergelijkt is een EXPORTLIJST tegen aanroepen in de
     bron; geen enkele operator (true->false, een vergelijking omdraaien) raakt
     dat. Let op de vorm: de eerste bewering groeit en krimpt mee met de code,
     dus alleen de harde ondergrens in toets 2 vangt een verdwenen export. */
  ['wiring-contract.test.js', 'vergelijkt de accounts-exportlijst met de aanroepen in de bron; geen bronoperator raakt een exportlijst. Met de hand tweemaal raak: een verzonnen aanroep laat toets 1 zakken, verifyToken uit de export halen laat beide toetsen zakken'],
  /* bundeldelen ijkt zichzelf al, en beter dan deze motor kan: zijn tweede
     bewering trekt een ECHT bundelbestand scheef op schijf en eist dat de
     meting uitslaat, met een finally die het terugzet. Een bronoperator op
     scripts/bundel.js raakt de vergelijking niet die hij maakt. */
  ['bundeldelen.test.js', 'ijkt zichzelf: de tweede bewering trekt een echt bundelbestand op schijf scheef en eist dat de meting uitslaat. Een bronoperator op scripts/bundel.js raakt die vergelijking niet'],
  /* rtfcampus leest APPS en CATEGORIEEN, die uit ./rtfappcatalogus-data.js
     komen -- een bestand met louter literalen. De betekenisvolle mutatie is
     "haal een categorie weg", en daar heeft deze motor geen operator voor
     (net als bij voertuigscherm.e2e.js hierboven).

     Die mutatie bracht hier wel een ECHT gat aan het licht, en dat is de reden
     dat deze regel er staat in plaats van een schouderophalen. Toets 2 eiste
     dat elke categorie een Campuswereld heeft, maar niet dat elke wereld een
     BESTAANDE categorie aanwijst. Een categorie weghalen liet dus een wereld
     naar het niets wijzen en bleef groen. De tegenkant staat er nu bij, en
     precies dezelfde handmutatie zakt sindsdien. */
  ['rtfcampus.test.js', 'leest een catalogus van literalen; de betekenisvolle mutatie is een categorie weghalen en daar heeft de motor geen operator voor. Met de hand raak sinds de tegenkant erbij staat: een categorie uit rtfappcatalogus-data.js halen laat toets 2 zakken (daarvoor bleef dat onopgemerkt -- dat was het gat)'],
  /* DRIE SERVERTOETSEN DIE DE LIEGPOORT NIET KAN BEOORDELEN, en om een reden
     die het opschrijven waard is: ze beweren allemaal iets over AFWEZIGHEID.

     De liegpoort laat elk endpoint een geldig maar LEEG antwoord geven, en een
     toets die groen blijft kijkt dus niet naar de inhoud. Dat werkt zolang de
     bewering is "hier hoort iets te staan". Maar "hier hoort GEEN token, GEEN
     stack, GEEN persoonsgegeven te staan" wordt door een leeg antwoord juist
     BEVESTIGD. De mutatie duwt precies de goede kant op, en dan zegt overleven
     niets over de toets.

     Alle drie met de hand nagetrokken op hun eigen foutklasse, alle drie raak. */
  ['loghygiene.test.js', 'beweert AFWEZIGHEID (geen querystring, geen stack, geen persoonsgegeven in het log) en een leeg antwoord bevestigt dat juist; bovendien roept hij de middleware rechtstreeks aan, buiten de poort om. Met de hand raak: req.path vervangen door req.originalUrl in server/log.js zet de querystring met token en e-mailadres in de log en laat toets 1 zakken. Hij heeft ook de positieve tegenhanger, dus hij kan niet leeg slagen: "het pad staat er wel in"'],
  ['strenge-poort.test.js', 'toetst de POORT zelf (test/helper.js), niet een endpoint -- de liegpoort zit een laag lager dan zijn onderwerp. Met de hand raak: de FATAAL-regex onherkenbaar maken laat beide toetsen zakken, want dan telt een crash niet meer mee'],
  ['genretoegang.test.js', 'beweert dat een gesloten genre wordt GEWEIGERD en nooit stil een ander genre wordt; een leeg antwoord is ook geen ander genre, dus de liegpoort bevestigt de bewering in plaats van hem te breken'],
  /* eventloop ijkt zichzelf beter dan deze motor kan, en dat is precies wat
     LAT.md regel 10 van een meter vraagt: hij BLOKKEERT echt 200 ms en eist dat
     de meter dat ziet, met een ondergrens (>=150) en een bovengrens (<1000), en
     met de eis dat de MEDIAAN juist niet meebeweegt -- anders zou een meter die
     alles op de max plakt er ook doorheen komen. Nagetrokken: lusVertraging()
     alles op nul laten melden laat drie van de vier toetsen zakken.
     Dit is bovendien het instrument waarmee de prestatiewinst van deze hele
     ronde is beoordeeld; dat het niet stilletjes nul kan melden is dus geen
     detail maar de bodem onder dat bewijs. */
  ['eventloop.test.js', 'ijkt zichzelf met een echte blokkade van 200 ms, met onder- en bovengrens en de eis dat de mediaan niet meebeweegt. Nagetrokken: lusVertraging() nul laten melden laat drie van de vier toetsen zakken'],
  /* scriptbundel bouwt zijn foutisolatie op als STRING (try/catch per bestand,
     met de bestandsnaam in de melding) en voert die in de toets echt uit. Een
     bronoperator raakt een stringliteraal niet; de betekenisvolle mutatie is de
     omwikkeling weghalen. Nagetrokken en raak: dan sleept een gooiend script
     het volgende wel mee en zakt de kernbelofte. */
  ['scriptbundel.test.js', 'de foutisolatie is een stringliteraal (try/catch per bestand) die de toets echt uitvoert; geen bronoperator raakt dat. Met de hand raak: de omwikkeling weghalen laat toets 1 zakken, en dat is de enige reden dat samenvoegen daar mag'],
  /* wereldtaal toetst DATA: dertig kernwoorden in elke registertaal, compact
     opgeslagen als |-gescheiden regels in wereld1..wereld8. De motor muteert
     wereld.js -- de uitpakker -- waar niets te halen valt. De betekenisvolle
     mutatie is een woord uit een taalregel halen, en daar bestaat geen operator
     voor. Nagetrokken en raak: een regel van veertien woorden naar dertien
     brengen laat toets 1 zakken op "het kernwoord ontbreekt". */
  ['wereldtaal.test.js', 'toetst dertig kernwoorden per taal, opgeslagen als |-gescheiden regels in wereld1..8; de motor muteert de uitpakker en niet de data. Met de hand raak: een woord uit een taalregel halen laat toets 1 zakken'],
  /* i18n-auto is een PAGINASCAN over public/: hij leest ieder blijvend appscherm
     en eist dat het de gedeelde taalrail laadt. Zijn onderwerp is dus welke
     bestanden wat bevatten, niet wat een module rekent -- dezelfde klasse als
     consent-dekking hierboven. */
  ['i18n-auto.test.js', 'een paginascan over public/: leest ieder blijvend appscherm en eist dat het de taalrail laadt. Zijn onderwerp is de inhoud van bestanden, niet rekenend gedrag van een module'],
  /* genreregister is dezelfde soort census, nu over de genre-definities: niemand
     definieert een genre buiten het register, elk genre heeft een bestaande
     sector. Een liegpoort die antwoorden leegmaakt raakt een registervergelijking
     niet. */
  ['genreregister.test.js', 'een census over de genre-definities (staat elk genre in het register, heeft elke sector genres); een leeggemaakt antwoord raakt een registervergelijking niet']
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
          if (na.tijdout) return Object.assign(
            tijdoutMaarMeetbaar(bestand, null, 'puur'),
            { module: rel, operator: op.naam + '#' + i, geprobeerd });
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

  /* HET AFBOUWSLOT, EN WAAROM HET HIER ONTBRAK.

     Dit is het meest bronmuterende script in huis: het verandert echte
     bestanden in server/ en zet ze in een finally terug. Precies waar
     scripts/afbouw-slot.js voor bedoeld is ("een tijdelijk ijkbestand mag nooit
     een geldige scan vervuilen") -- maar het slot werd alleen gepakt door
     test-runner.js, release-gate.js en staging-repetitie.js. Draaide iemand
     `npm run mutatie` naast `npm test`, dan las de suite gemuteerde bron en
     zakten er toetsen op code die niemand had geschreven.

     Twee dingen die dit voorkomt, en de tweede is de ergste:
       1. een andere lezer ziet halverwege een gemuteerd bestand;
       2. ruimEerderOp() hieronder zet de LEVENDE mutaties van een tweede
          mutatieronde terug -- die denkt dan dat hij zijn eigen bron muteert
          terwijl er al iets anders in staat, en de uitslag is onzin.

     Daarom vóór ruimEerderOp(), en binnen require.main: test/mutatiewacht.test.js
     IMPORTEERT deze module, en een slot dat bij het laden dichtklapt zou die
     toets het slot laten grijpen zonder ooit iets te muteren. */
  const geefAfbouwSlotVrij = require('./afbouw-slot').pak('mutatiemotor');
  void geefAfbouwSlotVrij; // pak() hangt zichzelf al aan exit/SIGINT/SIGTERM

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
  /* Een gerichte herproef mag geen half afgemaakte VOLLEDIGE ronde uit de
     voortgangscache mee vastleggen. Bij losse bestanden is MUTATIES.json daarom
     de basis; de uitkomst van die losse proef ververst daarna de cache vanzelf. */
  const uitslag = Object.assign(laad(UITSLAG), losse.length ? {} : laad(VOORTGANG));
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
    fs.writeFileSync(doel, JSON.stringify({ stempel: stempel(),
      uitleg: 'Per toetsbestand: kan hij zakken? Pure toetsen krijgen een bronmutatie in de ' +
        'module die ze laden; servertoetsen krijgen de liegpoort (RTG_LIEG). scherp = de deuren ' +
        'bleven open, dus hij zakte op de INHOUD en niet op de inlog.',
      grens: 'een toets die zakt is bewezen GEVOELIG, niet bewezen GOED -- hij kan op de ' +
        'verkeerde reden zakken. Een toets die groen blijft is niet bewezen waardeloos: de ' +
        'operatoren zijn mechanisch en er zijn fouten die ze niet maken.',
      toetsen: op }, null, 2) + '\n');
  };
  const bewaar = () => schrijf(VOORTGANG);      // na elk bestand: buiten de repo
  const vastleggen = () => schrijf(UITSLAG);    // na een fase: in de repo
  const gedaan = (naam) => !opnieuw && uitslag[naam] && uitslag[naam].staat !== 'geen toetsen gedraaid';

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

  const doe = (lijst, proef) => {
    let n = 0;
    for (const naam of lijst) {
      n++;
      if (gedaan(naam)) { continue; }
      const r = proef(naam);
      uitslag[naam] = r;
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
      /* ALLE plekken, niet acht. De acht was een tijdsbesparing, en hij
         produceerde valse beschuldigingen: in server/db/ledengids.js woont de
         geteste logica voorbij de achtste ===, dus de motor stopte met meten
         precies voordat hij raak kon schieten -- en noteerde 'overleefd' alsof
         de TOETS niets vastlegde. Een pure toets kost seconden; de eerlijke
         meting is er dus gewoon te betalen. */
      console.log('\n  --- A-diep: ' + overlevers.length + ' overlevers, elke plek per operator ---');
      for (const naam of overlevers) {
        const r = proefPuur(naam, 1000);
        uitslag[naam] = r;
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
        uitslag[naam] = Object.assign({}, uitslag[naam], { scherp: r.staat });
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

module.exports = { OPERATOREN, muteer, codemasker, modulesVan, UITSLAG, VOORTGANG, NIET_MUTEREN,
  SPOOR, ruimEerderOp, schrijfSpoor, metMutatie, DEUREN,
  /* draaiToets naar buiten, zodat scripts/outputproef.js hem kan gebruiken in
     plaats van namaken. Hij weet dingen die je niet twee keer wilt leren: de
     reporter moet op TAP staan (anders leest niemand de uitslag op Node 24), en
     een time-out krijgt SIGKILL en geen SIGTERM (anders blijven er wezen achter
     die poorten vasthouden en latere metingen vervuilen). */
  draaiToets,
  /* De opruimwacht naar buiten, want een wacht die je niet kunt AANROEPEN kun je
     ook niet toetsen -- en dan is hij een belofte. test/mutatiewacht.test.js
     meldt een bestand aan, muteert het, stuurt SIGTERM en kijkt of het terugstaat. */
  aanmelden: (pad, bron) => open.set(pad, bron),
  afmelden: (pad) => open.delete(pad),
  zetTerug };
