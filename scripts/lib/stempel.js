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
     boomVuil    stond er ongecommit werk in de boom tijdens het meten? Zo ja,
                 dan hoort die meting NIET bij die commit -- hij hoort bij iets
                 wat nergens is vastgelegd. Dat is geen detail: precies zo
                 ontstaat een register dat niemand kan reproduceren.
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
function stempel(extra) {
  const commit = git(['rev-parse', '--short', 'HEAD']) || null;
  /* --porcelain geeft een regel per gewijzigd bestand; leeg = schone boom.
     Faalt git (geen repo, geen git), dan is het ONBEKEND en niet 'schoon':
     onbekend als schoon lezen is precies de fout die dit veld moet voorkomen. */
  const status = commit === null ? null : git(['status', '--porcelain']);
  return Object.assign({
    op: new Date().toISOString(),
    commit,
    boomVuil: status === null ? null : status.length > 0,
    node: process.version
  }, extra || {});
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
  const status = git(['status', '--porcelain']);
  if (!status) return { ok: true, reden: 'schone boom op ' + commit };
  const regels = status.split('\n').filter(Boolean);
  return { ok: false, commit, bestanden: regels.slice(0, 8).map(r => r.trim()),
    reden: (naam || 'deze meting') + ' zou een uitslag opleveren met boomVuil: true, en die telt nergens mee. ' +
      regels.length + ' bestand(en) niet gecommit. Commit ze eerst, of zet RTG_METEN_OP_VUILE_BOOM=1 ' +
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

module.exports = { stempel, eisSchoneBoom, versheid, nuCommit, WORTEL };
