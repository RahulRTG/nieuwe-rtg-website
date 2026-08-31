/* ============================================================================
   HET STEMPEL -- WANNEER IS DIT GEMETEN, EN WAARTEGEN?

   Een register zonder tijdstempel is niet na te lopen. Je ziet er de getallen
   in, je ziet niet of ze van vanochtend zijn of van drie maanden geleden, en je
   ziet al helemaal niet of de code sindsdien is veranderd. Gemeten: van de
   vierentwintig registers in de wortel droegen er DRIE een datum, en maar EEN
   (DEKKING.json) ook de commit waarop hij is gemaakt.

   Dat is precies het soort stilte waar dit huis al vaker last van had. Een
   verouderd register ziet er identiek uit aan een verse -- geruststellend, en
   onwaar. De poortwacht liep 196 routes achter zonder dat iemand het kon zien;
   dat kostte een halve sessie om te ontdekken.

   WAT ER IN HET STEMPEL ZIT, en waarom elk veld:

     op          wanneer. Zonder dit is "vers" een gevoel.
     commit      waartegen. Twee registers van verschillende commits zijn niet
                 met elkaar te vergelijken, en een register van een oudere commit
                 dan HEAD is per definitie achterhaald.
     boomVuil    stond er ongecommit werk in de CODE tijdens het meten? Zo ja,
                 dan hoort die meting NIET bij die commit -- hij hoort bij iets
                 wat nergens is vastgelegd. Dat is geen detail: precies zo
                 ontstaat een register dat niemand kan reproduceren.
     boomAnders   hoeveel ongecommitte bestanden er BUITEN de code stonden. Nul
                 of niet, het staat er -- een uitzondering die je niet kunt
                 tellen, is een uitzondering die je niet kunt narekenen.

   WAT "CODE" HIER IS, en waarom dat een grens is en geen versoepeling.
   `versheid()` verderop besloot dit al: een commit die alleen registers of
   documentatie aanraakt, maakt een meting niet ongeldig -- alleen server/,
   scripts/ en public/ doen dat. Het vooraf-oordeel (`boomVuil`) hanteerde een
   ANDERE grens: elk gewijzigd bestand telde. Twee regels over dezelfde vraag,
   en de strengste van de twee sloeg toe op zijn eigen uitvoer: de meetronde
   schrijft in stap 1 POORTWACHT.json, en daarna weigerden stap 2 tot en met 7
   omdat de boom vuil was -- door hun eigen ronde. Zes van de negen registers
   zijn zo nooit in een volle ronde bijgewerkt.

   Nu is er EEN regel (`CODEPADEN`), en die staat aan de kant van de reden: een
   meting is reproduceerbaar als de CODE eronder is vastgelegd. Een register is
   uitvoer en geen invoer.
     instrument   WELK script deze meting heeft geschreven, als pad in de repo.
                 Niet om het na te vertellen: hiermee is uit te rekenen welke
                 wijzigingen onder scripts/ deze meting werkelijk raken. Zie
                 `sluiting()` verderop.
     node        welke node. Een meting op een andere runtime is een andere
                 meting; scripts/norm.js maakt dat onderscheid al voor prestatie.

   BEWUST NIET: de duur, het aantal geslaagde stappen, of iets anders wat je uit
   het register zelf kunt herrekenen. Een stempel dat gaat samenvatten wordt een
   tweede waarheid (LAT.md regel 4). */
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..', '..');

/* De drie mappen waarin een wijziging een meting ongeldig maakt. Dezelfde
   drie die `versheid()` gebruikt -- en met opzet dezelfde constante, want twee
   lijsten die hetzelfde horen te zeggen lopen uiteen (LAT.md regel 4). */
const CODEPADEN = ['server', 'scripts', 'public'];

function git(args) {
  try {
    return execFileSync('git', args, { cwd: WORTEL, encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch (e) { return ''; }
}

/* `extra` komt er ONGEWIJZIGD bij, voor wat alleen dit instrument weet -- het
   aantal routes van dat moment, de gebruikte seed, de opstelling. Zie
   scripts/poortwacht.js, die zijn omgevingsvlaggen meegeeft. */
function gitRuw(args) {
  try {
    return execFileSync('git', args, { cwd: WORTEL, encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (e) { return ''; }
}

/* Welk script draait hier? process.argv[1] en niet een naam die het instrument
   zelf opgeeft: een naam die je moet intikken, gaat afwijken van het bestand
   dat werkelijk meet. Buiten de repo (of geen script) -> null, en dan valt de
   versheid terug op de strengste regel. */
function instrumentPad() {
  const a = process.argv[1];
  if (!a) return null;
  const rel = path.relative(WORTEL, a).replace(/\\/g, '/');
  return (rel && !rel.startsWith('..')) ? rel : null;
}

/* ============================================================================
   DE SLUITING VAN EEN INSTRUMENT -- welke scripts leest dit script mee?

   WAAROM DIT NODIG WAS. De versheid rekende elke wijziging onder scripts/ aan
   elk register toe. Een reparatie in de staatproef verklaarde daarmee ook de
   poortwacht, de ketenronde en de sabotageronde verouderd, en na de volgende
   reparatie weer. Alle registers tegelijk vers was daarmee onbereikbaar, en een
   meter die nooit groen kan worden meet niets (LAT.md regel 9). Die regel staat
   ook nog eens in dit bestand zelf, twintig regels verderop.

   WAT DIT WEL EN NIET VERSOEPELT. server/ en public/ blijven onverkort tellen:
   dat is de code die gemeten WORDT. Onder scripts/ telt voortaan alleen wat dit
   instrument werkelijk inleest -- zichzelf en alles wat het via require()
   bereikt, hoe diep ook. `scripts/lib/routes.js` raakt daarmee nog steeds bijna
   elk register, en terecht.

   EN WAT ER GEBEURT ALS HET NIET LUKT. Een require die niet statisch te lezen
   is (een naam uit een variabele), een bestand dat niet bestaat, of een register
   zonder `instrument` in zijn stempel: dan is de sluiting ONBEKEND en geldt de
   oude, strengste regel. Onbekend als "raakt mij niet" lezen is precies de fout
   die dit bestand elders bestrijdt. */
function sluiting(startPad) {
  const start = path.join(WORTEL, startPad);
  if (!fs.existsSync(start)) return null;
  const gezien = new Set();
  const wachtrij = [start];
  while (wachtrij.length) {
    const f = wachtrij.shift();
    const rel = path.relative(WORTEL, f).replace(/\\/g, '/');
    if (gezien.has(rel)) continue;
    gezien.add(rel);
    let bron;
    try { bron = fs.readFileSync(f, 'utf8'); } catch (e) { return null; }
    /* Alleen RELATIEVE requires: een pakket uit node_modules staat niet in deze
       boom en kan een meting dus niet verouderen. Een require met iets anders
       dan een letterlijke tekst erin maakt de sluiting onbekend -- dan weet dit
       niet wat er wordt ingelezen, en dat mag geen stilte worden. */
    for (const m of bron.matchAll(/\brequire\(\s*([^)]*?)\s*\)/g)) {
      const arg = m[1].trim();
      const lit = /^'([^']*)'$|^"([^"]*)"$/.exec(arg);
      if (!lit) {
        /* EEN BEREKENDE REQUIRE MAAKT DE SLUITING ONBEKEND -- tenzij er geen
           enkel PAD in kan zitten. scripts/lib/scherm.js doet
           `require(p ? require.resolve('playwright', ...) : 'playwright')`: dat
           laadt een pakket uit node_modules, en dat kan deze boom niet
           verouderen. Staat er wel een relatieve tekst in de uitdrukking, dan
           weet dit niet wat er wordt ingelezen, en dan is onbekend het enige
           eerlijke antwoord. */
        if (/['"]\.{1,2}\//.test(arg)) return null;
        continue;
      }
      const naam = lit[1] !== undefined ? lit[1] : lit[2];
      if (!naam.startsWith('.')) continue;
      let doel = path.resolve(path.dirname(f), naam);
      if (!fs.existsSync(doel) || fs.statSync(doel).isDirectory()) {
        const kandidaten = [doel + '.js', path.join(doel, 'index.js'), doel + '.json'];
        doel = kandidaten.find(k => fs.existsSync(k)) || null;
      }
      if (!doel) return null;
      wachtrij.push(doel);
    }
  }
  return gezien;
}

function stempel(extra) {
  const commit = git(['rev-parse', '--short', 'HEAD']) || null;
  /* --porcelain geeft een regel per gewijzigd bestand; leeg = schone boom.
     Faalt git (geen repo, geen git), dan is het ONBEKEND en niet 'schoon':
     onbekend als schoon lezen is precies de fout die dit veld moet voorkomen. */
  const vuil = commit === null ? null : vuileBoom();
  return Object.assign({
    op: new Date().toISOString(),
    commit,
    boomVuil: vuil === null ? null : vuil.code.length > 0,
    boomAnders: vuil === null ? null : vuil.anders.length,
    instrument: instrumentPad(),
    node: process.version
  }, extra || {});
}

/* Wat er ongecommit staat, gesplitst in code en de rest. Faalt git, dan null:
   onbekend als schoon lezen is precies de fout die dit veld moet voorkomen. */
function vuileBoom() {
  /* ONGETRIMD opvragen. `git()` trimt zijn uitvoer, en daarmee verdwijnt de
     spatie waarmee " M pad" begint -- een vaste positie tellen gaf dan een pad
     dat een letter miste, en elk gewijzigd codebestand belandde stilzwijgend
     bij "buiten de code". Precies de kant op die niemand wil. */
  const status = gitRuw(['status', '--porcelain']);
  if (status === '' && !git(['rev-parse', '--short', 'HEAD'])) return null;
  const regels = status.split('\n').filter(r => r.trim());
  const code = [], anders = [];
  for (const r of regels) {
    /* --porcelain: twee tekens status, een spatie, dan het pad. Bij een
       hernoeming staat er "oud -> nieuw"; dan tellen beide kanten mee. */
    const pad = r.slice(3);   // XY + spatie; de regel is hier nog ongetrimd
    const delen = pad.split(' -> ');
    (delen.some(d => CODEPADEN.some(c => d === c || d.startsWith(c + '/'))) ? code : anders).push(r.trim());
  }
  return { code, anders };
}

/* ============================================================================
   DE POORT VOORAF -- weiger te beginnen aan een meting die toch niet telt.

   HET PROBLEEM. `stempel()` wordt aan het EIND van een ronde genomen. Staat er
   dan ongecommit werk in de boom, dan draagt het register `boomVuil: true` en
   is de hele meting waardeloos: hij hoort bij een stand die nergens is
   vastgelegd. Dat is precies wat het veld moet melden, en het meldt het te
   laat -- de tien minuten zijn dan al op.

   Gemeten in één zitting: drie rondes verspild. Twee keer omdat ik tijdens de
   ronde een script bewerkte, een keer omdat een ander instrument ondertussen
   een register wegschreef. Aan de uitvoer was tot het einde niets te zien.

   WAT DEZE POORT DOET. Hij kijkt VOORAF of de boom schoon is en laat het
   instrument stoppen voordat het begint. `sta toe` is geen vlag maar een
   uitgeschreven besluit: RTG_METEN_OP_VUILE_BOOM=1 zegt "ik weet dat deze
   uitslag niet telt" -- bijvoorbeeld bij het uitproberen van een nieuwe familie,
   waar de vorige meting toch al wordt weggegooid.

   WAT HIJ NIET DOET. Hij kijkt niet of de boom schoon BLIJFT. Wie halverwege
   een bestand aanraakt, krijgt nog steeds `boomVuil: true` aan het eind -- en
   dat hoort ook zo, want dat is wat er dan echt aan de hand is. Deze poort
   voorkomt de verspilling die vooraf te zien was, niet die van later. */
function eisSchoneBoom(naam) {
  const commit = git(['rev-parse', '--short', 'HEAD']);
  if (!commit) return { ok: true, reden: 'geen git; er valt niets te ijken' };
  if (process.env.RTG_METEN_OP_VUILE_BOOM === '1') {
    return { ok: true, reden: 'toegestaan met RTG_METEN_OP_VUILE_BOOM=1; deze uitslag telt niet als bewijs' };
  }
  const vuil = vuileBoom();
  if (!vuil || vuil.code.length === 0) {
    return { ok: true, buitenDeCode: vuil ? vuil.anders.length : 0,
      reden: 'geen ongecommitte code op ' + commit +
        (vuil && vuil.anders.length ? ' (' + vuil.anders.length + ' bestand(en) buiten server/scripts/public; die maken een meting niet onreproduceerbaar)' : '') };
  }
  return { ok: false, commit, bestanden: vuil.code.slice(0, 8),
    reden: (naam || 'deze meting') + ' zou een uitslag opleveren met boomVuil: true, en die telt nergens mee. ' +
      vuil.code.length + ' codebestand(en) niet gecommit. Commit ze eerst, of zet RTG_METEN_OP_VUILE_BOOM=1 ' +
      'als u weet dat deze ronde niet als bewijs hoeft te tellen.' };
}

/* Is dit stempel nog van deze code? Geeft een REDEN terug en niet alleen een
   ja/nee, want "verouderd" zonder waarom leidt tot een tweede onderzoek. */
function versheid(gemeten, huidigeCommit) {
  if (!gemeten || !gemeten.op) return { vers: false, reden: 'geen stempel: dit register zegt niet wanneer het is gemeten' };
  if (!gemeten.commit) return { vers: false, reden: 'gemeten zonder commit; niet te herleiden tot een versie van de code' };
  if (gemeten.boomVuil) return { vers: false, reden: 'gemeten met ongecommit werk in de boom (commit ' + gemeten.commit + '); niet reproduceerbaar' };
  const nu = huidigeCommit || git(['rev-parse', '--short', 'HEAD']);
  if (!nu) return { vers: false, reden: 'de huidige commit is niet vast te stellen' };
  if (gemeten.commit === nu) return { vers: true, reden: 'gemeten op de huidige commit (' + nu + ')' };

  /* NIET "ANDERE COMMIT" MAAR "ANDERE CODE", en dat verschil is het verschil
     tussen een bruikbare meter en een die altijd rood staat.

     De eerste versie vergeleek de commit van de meting met HEAD. Dat klinkt
     streng en het is onwerkbaar: zodra je de verse registers COMMIT, verspringt
     HEAD en verklaart de meter zijn eigen meting van een minuut oud verouderd.
     Vers was daarmee onbereikbaar -- een meter die nooit groen kan worden, meet
     niets (LAT.md regel 9).

     Wat telt is of er sinds de meting CODE is veranderd. Een commit die alleen
     registers, documentatie of een tekstbestand aanraakt, maakt een meting niet
     ongeldig. Een commit in server/, scripts/ of public/ wel. */
  const gewijzigd = git(['diff', '--name-only', gemeten.commit + '..' + nu, '--'].concat(CODEPADEN));
  /* De wijzigingen onder scripts/ die dit instrument niet inleest, tellen niet
     mee -- zie `sluiting()`. Lukt de sluiting niet, dan blijft alles tellen. */
  let raakt = gewijzigd.split('\n').filter(Boolean);
  let buiten = 0;
  if (raakt.length && gemeten.instrument) {
    const sl = sluiting(gemeten.instrument);
    if (sl) {
      const voor = raakt.length;
      raakt = raakt.filter(f => !f.startsWith('scripts/') || sl.has(f));
      buiten = voor - raakt.length;
    }
  }
  if (raakt.length === 0) {
    /* Lege uitvoer betekent OOK "de vergelijking mislukte" (onbekende commit na
       een rebase, of geen git). Daarom apart nagaan of de commit bestaat: een
       mislukte vergelijking als "geen wijzigingen" lezen zou een meting van een
       verdwenen commit vers noemen. */
    const bestaat = git(['cat-file', '-e', gemeten.commit + '^{commit}']) === '' &&
      git(['rev-parse', '--quiet', '--verify', gemeten.commit + '^{commit}']) !== '';
    if (!bestaat) return { vers: false, reden: 'gemeten op commit ' + gemeten.commit + ', die hier niet meer bestaat' };
    return { vers: true, reden: 'gemeten op ' + gemeten.commit + '; sindsdien is er geen code gewijzigd' +
      (buiten ? ' die dit instrument raakt (' + buiten + ' wijziging(en) in scripts die het niet inleest)' : '') };
  }
  return { vers: false, reden: 'gemeten op ' + gemeten.commit + ', sindsdien zijn ' + raakt.length +
    ' codebestand(en) gewijzigd' + (buiten ? ' (' + buiten + ' andere buiten dit instrument gelaten)' : '') };
}

const nuCommit = () => git(['rev-parse', '--short', 'HEAD']) || null;

module.exports = { stempel, eisSchoneBoom, versheid, vuileBoom, sluiting, nuCommit, CODEPADEN, WORTEL };
