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
     boomVuil    stond er ongecommit CODE in de boom tijdens het meten? Zo ja,
                 dan hoort die meting NIET bij die commit -- hij hoort bij iets
                 wat nergens is vastgelegd. Dat is geen detail: precies zo
                 ontstaat een register dat niemand kan reproduceren.

                 CODE, EN NIET DE HELE BOOM. Hier stond `git status --porcelain`
                 over alles, en daarmee was een schone stand onbereikbaar --
                 exact de fout die tien regels lager bij `versheid()` al een keer
                 is gemaakt en gerepareerd. De reden is dezelfde en de vorm ook:
                 zodra de eerste meetronde zijn register WEGSCHRIJFT, is de boom
                 vuil, en stempelt elke volgende meting van diezelfde ronde
                 zichzelf als onreproduceerbaar. Gemeten op 2 september 2026:
                 van drie generatoren achter elkaar kwam alleen de EERSTE schoon
                 binnen, en de andere twee niet -- niet omdat er iets mis was,
                 maar omdat hun voorganger net een bestand had geschreven.

                 Een register dat naast je ligt is een UITKOMST en geen invoer
                 van de code. Wat een meting onreproduceerbaar maakt, is
                 ongecommitte CODE: server, scripts, public, test, de motor en
                 de pakketlijst. Vandaar dat de status daar nu op wordt gevraagd
                 en niet op de hele boom. Wie deze lijst uitbreidt: neem er
                 alleen iets in op dat een MEETUITKOMST kan veranderen.
     node        welke node. Een meting op een andere runtime is een andere
                 meting; scripts/norm.js maakt dat onderscheid al voor prestatie.

   BEWUST NIET: de duur, het aantal geslaagde stappen, of iets anders wat je uit
   het register zelf kunt herrekenen. Een stempel dat gaat samenvatten wordt een
   tweede waarheid (LAT.md regel 4). */
'use strict';
const { execFileSync } = require('child_process');
const path = require('path');

const WORTEL = path.join(__dirname, '..', '..');

function git(args) {
  try {
    return execFileSync('git', args, { cwd: WORTEL, encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch (e) { return ''; }
}

/* `extra` komt er ONGEWIJZIGD bij, voor wat alleen dit instrument weet -- het
   aantal routes van dat moment, de gebruikte seed, de opstelling. Zie
   scripts/poortwacht.js, die zijn omgevingsvlaggen meegeeft. */
/* WAT ALS CODE TELT. Alles waarvan een wijziging een MEETUITKOMST kan
   veranderen -- en verder niets. Registers (*.json in de wortel) en documenten
   zijn uitkomsten; die maken een meting niet onreproduceerbaar.

   `test` staat er wel bij en dat is geen slordigheid: de mutatiemotor MEET de
   toetsen, dus een ongecommitte toets verandert daar de uitslag. Hetzelfde
   geldt voor de pakketlijst -- de meter `dependencies` leest hem rechtstreeks,
   en juist daar is deze sessie een keuring op omgevallen. */
const CODE = ['server', 'scripts', 'public', 'test', 'motor', 'package.json', 'package-lock.json'];

function stempel(extra) {
  const commit = git(['rev-parse', '--short', 'HEAD']) || null;
  /* --porcelain geeft een regel per gewijzigd bestand; leeg = schone code.
     Faalt git (geen repo, geen git), dan is het ONBEKEND en niet 'schoon':
     onbekend als schoon lezen is precies de fout die dit veld moet voorkomen. */
  const status = commit === null ? null : git(['status', '--porcelain', '--'].concat(CODE));
  return Object.assign({
    op: new Date().toISOString(),
    commit,
    boomVuil: status === null ? null : status.length > 0,
    node: process.version
  }, extra || {});
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
  const gewijzigd = git(['diff', '--name-only', gemeten.commit + '..' + nu, '--',
    'server', 'scripts', 'public']);
  if (gewijzigd === '') {
    /* Lege uitvoer betekent OOK "de vergelijking mislukte" (onbekende commit na
       een rebase, of geen git). Daarom apart nagaan of de commit bestaat: een
       mislukte vergelijking als "geen wijzigingen" lezen zou een meting van een
       verdwenen commit vers noemen. */
    const bestaat = git(['cat-file', '-e', gemeten.commit + '^{commit}']) === '' &&
      git(['rev-parse', '--quiet', '--verify', gemeten.commit + '^{commit}']) !== '';
    if (!bestaat) return { vers: false, reden: 'gemeten op commit ' + gemeten.commit + ', die hier niet meer bestaat' };
    return { vers: true, reden: 'gemeten op ' + gemeten.commit + '; sindsdien is er geen code gewijzigd' };
  }
  const n = gewijzigd.split('\n').filter(Boolean).length;
  return { vers: false, reden: 'gemeten op ' + gemeten.commit + ', sindsdien zijn ' + n +
    ' codebestand(en) gewijzigd' };
}

const nuCommit = () => git(['rev-parse', '--short', 'HEAD']) || null;

module.exports = { stempel, versheid, nuCommit, WORTEL, CODE };
