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

/* Is dit stempel nog van deze code? Geeft een REDEN terug en niet alleen een
   ja/nee, want "verouderd" zonder waarom leidt tot een tweede onderzoek. */
function versheid(gemeten, huidigeCommit) {
  if (!gemeten || !gemeten.op) return { vers: false, reden: 'geen stempel: dit register zegt niet wanneer het is gemeten' };
  if (!gemeten.commit) return { vers: false, reden: 'gemeten zonder commit; niet te herleiden tot een versie van de code' };
  if (gemeten.boomVuil) return { vers: false, reden: 'gemeten met ongecommit werk in de boom (commit ' + gemeten.commit + '); niet reproduceerbaar' };
  const nu = huidigeCommit || git(['rev-parse', '--short', 'HEAD']);
  if (!nu) return { vers: false, reden: 'de huidige commit is niet vast te stellen' };
  if (gemeten.commit !== nu) {
    return { vers: false, reden: 'gemeten op ' + gemeten.commit + ', de code staat op ' + nu };
  }
  return { vers: true, reden: 'gemeten op de huidige commit (' + nu + ')' };
}

const nuCommit = () => git(['rev-parse', '--short', 'HEAD']) || null;

module.exports = { stempel, versheid, nuCommit, WORTEL };
