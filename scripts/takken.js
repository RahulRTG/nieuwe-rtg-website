#!/usr/bin/env node
/* ============================================================================
   DE TAKKEN -- welke remote tak voegt niets meer toe, en mag dus weg.

   AANLEIDING. Er stonden 181 remote takken, waarvan de meeste van juli en
   augustus. Ze zijn niet gevaarlijk, maar ze maken de takkenlijst onleesbaar:
   wie zoekt waar iets aan gewerkt wordt, ziet honderdveertig doodlopende
   namen eerst. Handmatig opruimen is 128 keer klikken, en dat gebeurt dus nooit.

   WAAROM DIT GEEN LIJST IS DIE IEMAND BIJHOUDT. Een opgeschreven lijst is bij
   de volgende merge alweer verouderd, en een verouderde lijst die takken
   verwijdert is precies de fout die je niet wilt maken. Daarom bewijst dit
   script per tak OPNIEUW dat hij overbodig is, op het moment dat het ertoe
   doet. De uitkomst van gisteren telt niet.

   HET BEWIJS, en het is er maar een: voegt samenvoegen met de hoofdtak nog
   iets toe? Twee manieren waarop het antwoord nee is:

     1. de tak ligt nul commits voor op de hoofdtak -- hij zit er al helemaal in;
     2. samenvoegen levert EXACT dezelfde boom op als de hoofdtak. Dan staat
        de inhoud er al, ook al hebben de commits andere sha's (dat gebeurt bij
        een squash, een rebase, of werk dat langs een andere weg binnenkwam).

   Bij 2 mogen conflicten in GEGENEREERDE REGISTERS op de kant van de hoofdtak
   worden gezet -- die bestanden worden immers uit de bron herschreven, dus de
   versie van een oude tak is per definitie achterhaald. Dat mag ALLEEN voor de
   tien bestanden in REGISTERS hieronder, en elk daarvan heeft een generator.
   Botst er iets anders, dan is er echte inhoud in het geding en blijft de tak
   staan. Komt er ooit een register bij dat hier niet staat, dan wordt dit
   script strenger en niet losser: die tak overleeft gewoon.

   WAT ER NOOIT WEGGAAT, ongeacht het bewijs:
     - de hoofdtak;
     - elke tak met een OPEN pull request (daar wordt nog over gesproken);
     - alles in BESCHERMD hieronder.

   En als niet vast te stellen is welke PR's openstaan, verdwijnt er niets.
   Een opruimer die bij twijfel doorzet, is een opruimer die je een keer je
   werk kost.

   GEBRUIK
     node scripts/takken.js                 toont het oordeel, verwijdert niets
     node scripts/takken.js --verwijder     verwijdert wat aantoonbaar weg mag
     node scripts/takken.js --max=40        hoogstens zoveel in een ronde

   Verwijderen kan alleen waar de omgeving push-recht heeft (in de praktijk:
   .github/workflows/takken.yml). Lokaal draait hij prima als meting.
   ========================================================================== */
'use strict';
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

/* De bestanden die dit huis uit de bron HERSCHRIJFT. Een conflict hierin zegt
   niets over de inhoud van een tak, want de winnaar wordt toch opnieuw
   gegenereerd. Alles wat hier NIET staat, telt als echte inhoud. */
const REGISTERS = new Set([
  'ARCHITECTUUR.md',        // npm run kaart
  'BEWIJS.md',              // npm run bewijs
  'FUNCTIES.md',            // npm run functielijst
  'BUNDELS.md',             // npm run deelindex
  'MUTATIES.json',          // scripts/mutatie.js
  'TOETSDUUR.json',         // npm run toetsduur
  'CAPABILITEIT.json',      // npm run capabilities:vast
  'DEKKING.json',           // npm run dekking:vast
  'MUTATIECONTRACT.json',   // npm run mutatiecontract
  'MUTATIEINVENTARIS.json'  // npm run mutatieinventaris
]);

/* Takken die blijven staan wat het bewijs ook zegt. Leeg is goed; dit is de
   plek voor een tak die om een andere reden moet blijven bestaan.

   BESCHERM=tak1,tak2 zet er per aanroep nog wat bij. Dat is er voor de tak
   waar op dat moment aan gewerkt wordt: die is na een merge namelijk ook
   "leeg", en hem onder iemands handen weghalen is technisch juist en
   praktisch vervelend. */
const BESCHERMD = new Set(
  String(process.env.BESCHERM || '').split(',').map(s => s.trim()).filter(Boolean)
);

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1 << 28 }).trim();
const gitStil = (...args) => {
  try { return { ok: true, uit: git(...args) }; }
  catch (e) { return { ok: false, uit: String((e && e.stdout) || '') + String((e && e.stderr) || '') }; }
};

/* De hoofdtak wordt gevraagd en niet aangenomen: een repo die morgen van
   `main` naar iets anders gaat, hoort dit script niet stil zijn hoofdtak te
   laten verliezen. */
function hoofdtak() {
  if (process.env.HOOFDTAK) return process.env.HOOFDTAK;
  const r = gitStil('symbolic-ref', '--short', 'refs/remotes/origin/HEAD');
  if (r.ok && r.uit) return r.uit.replace(/^origin\//, '');
  return 'main';
}

/* WELKE TAKKEN HEBBEN EEN OPEN PR. Lukt dat niet, dan is de uitkomst `null` en
   verwijdert de aanroeper niets -- niet een lege lijst, want dat zou als "geen
   enkele PR staat open" lezen en alles vrijgeven. */
function takkenMetOpenPr(repo) {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token || !repo) return null;
  const namen = new Set();
  for (let bladzijde = 1; bladzijde <= 10; bladzijde++) {
    let tekst;
    try {
      tekst = execFileSync('curl', ['-sS', '-H', 'Authorization: Bearer ' + token,
        '-H', 'Accept: application/vnd.github+json',
        `https://api.github.com/repos/${repo}/pulls?state=open&per_page=100&page=${bladzijde}`],
      { encoding: 'utf8', maxBuffer: 1 << 26 });
    } catch (e) { return null; }
    let lijst;
    try { lijst = JSON.parse(tekst); } catch (e) { return null; }
    if (!Array.isArray(lijst)) return null;
    for (const pr of lijst) if (pr && pr.head && pr.head.ref) namen.add(pr.head.ref);
    if (lijst.length < 100) break;
  }
  return namen;
}

/* HET BEWIJS PER TAK. Geeft 'leeg' (voegt niets toe), 'inhoud' (voegt wel iets
   toe) of 'onbeslist' (de proef kon niet draaien) -- en die laatste is met
   opzet geen synoniem van 'leeg'. */
function oordeel(werkmap, hoofd, tak) {
  const vooruit = gitStil('rev-list', '--count', `origin/${hoofd}..origin/${tak}`);
  if (!vooruit.ok) return { stand: 'onbeslist', waarom: 'kon de commits niet tellen' };
  if (vooruit.uit === '0') return { stand: 'leeg', waarom: 'nul commits voor op ' + hoofd };

  const hoofdBoom = git('rev-parse', `origin/${hoofd}^{tree}`);
  const inWerkmap = (...args) => {
    try { return { ok: true, uit: execFileSync('git', ['-C', werkmap, ...args], { encoding: 'utf8', maxBuffer: 1 << 28 }).trim() }; }
    catch (e) { return { ok: false, uit: String((e && e.stdout) || '') }; }
  };

  inWerkmap('reset', '--hard', `origin/${hoofd}`);
  inWerkmap('clean', '-qfd');
  inWerkmap('merge', '--no-commit', '--no-ff', `origin/${tak}`);

  const botsend = (inWerkmap('diff', '--name-only', '--diff-filter=U').uit || '')
    .split('\n').map(s => s.trim()).filter(Boolean);
  const buitenRegisters = botsend.filter(f => !REGISTERS.has(f));
  if (buitenRegisters.length) {
    inWerkmap('merge', '--abort');
    return { stand: 'inhoud', waarom: 'botst op ' + buitenRegisters[0] + (buitenRegisters.length > 1 ? ` (+${buitenRegisters.length - 1})` : '') };
  }
  for (const f of botsend) { inWerkmap('checkout', '--ours', '--', f); inWerkmap('add', '--', f); }

  const rest = (inWerkmap('diff', '--name-only', '--diff-filter=U').uit || '').split('\n').filter(Boolean);
  if (rest.length) { inWerkmap('merge', '--abort'); return { stand: 'onbeslist', waarom: 'conflict bleef staan' }; }

  const boom = inWerkmap('write-tree');
  inWerkmap('merge', '--abort');
  if (!boom.ok) return { stand: 'onbeslist', waarom: 'kon de boom niet schrijven' };
  return boom.uit === hoofdBoom
    ? { stand: 'leeg', waarom: 'samenvoegen levert exact de boom van ' + hoofd }
    : { stand: 'inhoud', waarom: 'samenvoegen zou ' + hoofd + ' veranderen' };
}

function main() {
  const verwijderen = process.argv.includes('--verwijder');
  const maxArg = (process.argv.find(a => a.startsWith('--max=')) || '').split('=')[1];
  const maximum = Number(maxArg) > 0 ? Number(maxArg) : 150;
  const repo = process.env.GITHUB_REPOSITORY || '';
  const hoofd = hoofdtak();

  git('fetch', '--prune', '--quiet', 'origin');

  const openPr = takkenMetOpenPr(repo);
  if (verwijderen && openPr === null) {
    console.error('Kon niet vaststellen welke pull requests openstaan, dus er wordt niets verwijderd.');
    console.error('Zonder die lijst zou een tak kunnen sneuvelen waar nog over gesproken wordt.');
    process.exit(1);
  }

  const takken = git('for-each-ref', '--format=%(refname:strip=3)', 'refs/remotes/origin')
    .split('\n').map(s => s.trim()).filter(t => t && t !== 'HEAD' && t !== hoofd);

  const werkmap = fs.mkdtempSync(path.join(os.tmpdir(), 'takken-'));
  git('worktree', 'add', '--quiet', '--detach', werkmap, `origin/${hoofd}`);

  const weg = [], blijft = [], onbeslist = [];
  try {
    for (const tak of takken) {
      if (BESCHERMD.has(tak)) { blijft.push([tak, 'beschermd']); continue; }
      if (openPr && openPr.has(tak)) { blijft.push([tak, 'heeft een open pull request']); continue; }
      const o = oordeel(werkmap, hoofd, tak);
      if (o.stand === 'leeg') weg.push([tak, o.waarom, git('rev-parse', '--short', `origin/${tak}`)]);
      else if (o.stand === 'inhoud') blijft.push([tak, o.waarom]);
      else onbeslist.push([tak, o.waarom]);
    }
  } finally {
    gitStil('worktree', 'remove', '--force', werkmap);
  }

  console.log(`\nHoofdtak: ${hoofd}. Onderzocht: ${takken.length} takken.\n`);
  console.log(`VOEGT NIETS TOE (${weg.length}):`);
  for (const [t, waarom, sha] of weg) console.log(`  ${t.padEnd(52)} ${sha}  ${waarom}`);
  console.log(`\nBLIJFT (${blijft.length}):`);
  for (const [t, waarom] of blijft) console.log(`  ${t.padEnd(52)} ${waarom}`);
  if (onbeslist.length) {
    console.log(`\nNIET VAST TE STELLEN (${onbeslist.length}) -- deze blijven staan:`);
    for (const [t, waarom] of onbeslist) console.log(`  ${t.padEnd(52)} ${waarom}`);
  }

  if (!verwijderen) {
    console.log(`\nDit was een droogloop. Met --verwijder gaan die ${weg.length} takken weg.`);
    return;
  }
  if (weg.length > maximum) {
    console.error(`\n${weg.length} takken is meer dan het maximum van ${maximum}. Verhoog --max als dit klopt.`);
    process.exit(1);
  }

  let mislukt = 0;
  for (let i = 0; i < weg.length; i += 40) {
    const groep = weg.slice(i, i + 40).map(x => x[0]);
    const r = gitStil('push', 'origin', '--delete', ...groep);
    if (!r.ok) for (const t of groep) { const los = gitStil('push', 'origin', '--delete', t); if (!los.ok) { mislukt++; console.error(`  niet verwijderd: ${t}`); } }
  }
  console.log(`\nVerwijderd: ${weg.length - mislukt}. Mislukt: ${mislukt}.`);
  if (mislukt) process.exit(1);
}

if (require.main === module) main();
module.exports = { REGISTERS, BESCHERMD, oordeel, hoofdtak };
