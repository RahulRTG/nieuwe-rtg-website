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
  { naam: 'return-weg', zoek: /\breturn ([a-zA-Z_$][\w$.]*);/, zet: 'return undefined;' }
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
  const masker = codemasker(bron);
  const re = new RegExp(op.zoek.source, 'g');
  let m, n = 0;
  while ((m = re.exec(bron))) {
    if (!masker[m.index]) continue;
    if (n++ < (index || 0)) continue;
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

function draaiToets(bestand, env, wacht) {
  const r = spawnSync('node', ['--experimental-sqlite', '--test', bestand], {
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

/* Welke SERVERMODULE toetst dit bestand? Uit zijn eigen requires: een pure toets
   noemt de module die hij onderzoekt. Meerdere kandidaten: we nemen ze allemaal
   en muteren in die volgorde -- de eerste die de toets laat zakken is genoeg. */
function modulesVan(bestand) {
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
          if (na.tijdout) return { soort: 'puur', staat: 'vastgelopen', module: rel,
            operator: op.naam + '#' + i, geprobeerd };
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
  /* De zoekterm opgeknipt, precies zoals de patronen in regel 36 van
     scripts/check.js: voluit gespeld leest een andere keuringsregel dit als een
     require van scripts/helper.js, die niet bestaat. */
  const teken = "require('./" + "helper')";
  return fs.readFileSync(path.join(TEST, naam), 'utf8').includes(teken);
}

/* DE SERVERTOETSEN in EEN ronde: de liegpoort aan voor alle /api/-paden. Per
   bestand kijken we of hij dan omvalt. Dat is honderdvijfenveertig keer een
   server starten in plaats van honderdvijfenveertig ronden van de hele suite. */
function proefServer(naam) {
  if (NIET_MUTEREN.has(naam)) return { soort: 'server', staat: 'muteert zelf', reden: NIET_MUTEREN.get(naam) };
  const bestand = path.join(TEST, naam);
  const nul = draaiToets(bestand);
  if (nul.tijdout) return { soort: 'server', staat: 'te langzaam' };
  if (nul.gezakt > 0) return { soort: 'server', staat: 'al rood', gezakteZonderMutatie: nul.gezakt };
  if (!nul.toetsen) return { soort: 'server', staat: 'geen toetsen gedraaid' };
  if (nul.alGeslagen) return { soort: 'server', staat: 'slaat zichzelf over', overgeslagen: nul.overgeslagen };
  const na = draaiToets(bestand, { RTG_LIEG: '/api/' }, WACHT_MUTATIE);
  if (na.tijdout) return { soort: 'server', staat: 'vastgelopen', operator: 'liegpoort /api/' };
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
  const uitslag = Object.assign(laad(UITSLAG), laad(VOORTGANG));
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
  const gedaan = (naam) => !opnieuw && uitslag[naam] && uitslag[naam].staat !== 'geen toetsen gedraaid';

  const doe = (lijst, proef) => {
    let n = 0;
    for (const naam of lijst) {
      n++;
      if (gedaan(naam)) { continue; }
      const r = proef(naam);
      uitslag[naam] = r;
      bewaar();
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
  }

  const per = (s) => Object.values(uitslag).filter(x => x.staat === s).length;
  console.log('\n  gezakt (bewezen gevoelig)  ' + per('gezakt'));
  console.log('  overleefd                  ' + per('overleefd'));
  console.log('  niet te meten              ' + (Object.keys(uitslag).length - per('gezakt') - per('overleefd')));
  console.log('\n  Uitslag in MUTATIES.json; npm run bewijs zet hem in BEWIJS.md.\n');
}

module.exports = { OPERATOREN, muteer, codemasker, modulesVan, UITSLAG, VOORTGANG, NIET_MUTEREN,
  SPOOR, ruimEerderOp, schrijfSpoor, metMutatie,
  /* De opruimwacht naar buiten, want een wacht die je niet kunt AANROEPEN kun je
     ook niet toetsen -- en dan is hij een belofte. test/mutatiewacht.test.js
     meldt een bestand aan, muteert het, stuurt SIGTERM en kijkt of het terugstaat. */
  aanmelden: (pad, bron) => open.set(pad, bron),
  afmelden: (pad) => open.delete(pad),
  zetTerug };
