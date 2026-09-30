#!/usr/bin/env node
/* ============================================================================
   DE VERVALPROEF -- loopt het bewijsverval echt rond, op een echte route, met
   een echt instrument?

   WAT HIJ BEWIJST (PROOF.md par. 2a), in een wegwerp-worktree op HEAD:

     0. VOOR     de AUTH-cel van route R is bewezen (door de poortwacht) en actueel;
                 die van route A ook.
     1. NEGATIEF het handlerbestand van A verandert (een commit). R blijft
                 onaangetast -- en A's cel veroudert wel, anders bewijst het
                 negatieve geval niets (een meter die nooit uitslaat is ook stil).
     2. POSITIEF het handlerbestand van R verandert. R's cel veroudert, en de
                 uitlegketen noemt: welk bestand, via welke gemeten koppeling,
                 welk bewijs (cel, register, commit), en wat opnieuw moet draaien.
     3. HERMETING de opdracht die de KETEN noemt wordt uitgevoerd -- niet een die
                 deze proef zelf kiest; zo is ook bewezen dat de keten klopt.
     4. NA       R's cel is weer bewezen en actueel, gemeten op de nieuwe commit.

   WAT HIJ NIET BEWIJST, en waarom: de ROUTE gaat hier niet van BEWEZEN naar
   VERSCHAALD en terug, want op 28 september 2026 heeft geen enkele route alle
   elf cellen bewezen (VERTROUWEN.json: elke route mist er minstens een). De
   routestand blijft dus `verzwakt`; wat er wel beweegt is het veld
   `verouderd` op die route. De overgang op routeniveau staat als toets met de
   echte staatVan() in test/routeversheid.test.js (3a, 3b). De wijziging is een
   regel commentaar: het verval kijkt naar BESTANDEN en niet naar betekenis, dus
   ook commentaar laat bewijs vervallen. Dat is grof, en het is de veilige kant.

   Draai:  npm run vervalproef              (~5 minuten: de poortwacht draait echt)
           node scripts/vervalproef.js --route "POST /api/..." --ander "POST /api/..."
   UITGANG 0 alle stappen gehouden, 1 een stap zakte, 2 niet uit te voeren
   ========================================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const WORTEL = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i > -1 ? argv[i + 1] : d; };
const R = arg('--route', 'POST /api/office/voogdij/besluit');
const A = arg('--ander', 'POST /api/office/bewaarverzoek');

/* Een meting in de worktree, in een eigen proces zodat elke stap de code en de
   registers leest zoals ze DAAR nu zijn. */
function meet(dir) {
  /* De modules worden via de werkmap geladen en niet met een letterlijk pad:
     dit is code die IN de worktree draait, en een letterlijke require hier
     leest de keuring als een require vanuit scripts/ (kapot). */
  const code = `
    const laad = (n) => require(require('path').join(process.cwd(), 'scripts', n));
    const rv = laad('routeversheid');
    const { staatVan } = laad('vertrouwen');
    const b = rv.bouwer();
    const m = laad('bewijsmatrix').bouw();
    const uit = {};
    for (const route of ${JSON.stringify([R, A])}) {
      const rij = m.rijen.find((r) => r.methode + ' ' + r.pad === route);
      if (!rij) { uit[route] = null; continue; }
      const cel = rij.cellen.AUTH;
      const v = b.verval(route, { AUTH: cel });
      uit[route] = { cel: cel && cel.staat, bron: cel && cel.bron, handler: b.afhankelijkheden(route).handler,
        verouderd: v.verouderd.map((c) => ({ ...c, uitleg: rv.uitleg(route, c) })),
        vermoed: v.vermoed.length, onbekend: v.onbekend.map((c) => c.reden),
        routestand: staatVan(rij.cellen, 1, 30, [], b.verval(route, rij.cellen)).staat };
    }
    process.stdout.write('\\n@@' + JSON.stringify(uit));`;
  const r = spawnSync(process.execPath, ['-e', code], { cwd: dir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 600000 });
  const i = (r.stdout || '').lastIndexOf('@@');
  if (i < 0) throw new Error('meting in de worktree gaf geen uitslag: ' + (r.stderr || '').split('\n').slice(-3).join(' '));
  return JSON.parse(r.stdout.slice(i + 2));
}

const git = (dir, args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
function wijzigEnCommit(dir, bestand, wat) {
  fs.appendFileSync(path.join(dir, bestand), '\n// vervalproef: ' + wat + '\n');
  git(dir, ['-c', 'user.name=vervalproef', '-c', 'user.email=vervalproef@localhost', 'commit', '-q', '-am', 'vervalproef: ' + wat]);
  return git(dir, ['rev-parse', '--short=8', 'HEAD']);
}

function main() {
  const stappen = [];
  const houd = (naam, ok, detail) => { stappen.push({ naam, ok: !!ok, detail }); console.log('  ' + (ok ? 'gehouden ' : 'GEZAKT   ') + naam + (detail ? '\n           ' + detail : '')); };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vervalproef-'));
  try {
    git(WORTEL, ['worktree', 'add', '-q', '--detach', dir, 'HEAD']);
    fs.symlinkSync(path.join(WORTEL, 'node_modules'), path.join(dir, 'node_modules'));
  } catch (e) { console.error('  worktree niet te maken: ' + e.message); return 2; }
  try {
    console.log('\n  DE VERVALPROEF  R = ' + R + '   A = ' + A + '\n');
    const m0 = meet(dir);
    if (!m0[R] || !m0[A]) { console.error('  route onbekend in de bewijsmatrix'); return 2; }
    houd('0. voor: de AUTH-cel van R is bewezen en actueel',
      m0[R].cel === 'bewezen' && !m0[R].verouderd.length && !m0[R].onbekend.length, 'bron ' + m0[R].bron + ', handler ' + m0[R].handler);
    houd('0. voor: de AUTH-cel van A is bewezen en actueel',
      m0[A].cel === 'bewezen' && !m0[A].verouderd.length && !m0[A].onbekend.length, 'handler ' + m0[A].handler);

    const c1 = wijzigEnCommit(dir, m0[A].handler, 'niet-gerelateerd aan R');
    const m1 = meet(dir);
    houd('1. negatief: een wijziging aan A laat R onaangetast', !m1[R].verouderd.length && m1[R].cel === 'bewezen',
      'commit ' + c1 + '; R verouderd: ' + m1[R].verouderd.length);
    houd('1. tegenproef: dezelfde wijziging laat A wel verouderen', m1[A].verouderd.length === 1,
      m1[A].verouderd[0] ? m1[A].verouderd[0].uitleg[0].bestand : 'niets');

    const c2 = wijzigEnCommit(dir, m0[R].handler, 'relevant voor R');
    const m2 = meet(dir);
    const v = m2[R].verouderd[0];
    const u = v && v.uitleg[0];
    houd('2. positief: een wijziging aan R laat de AUTH-cel van R verouderen', !!u, u ? '' : 'niets verouderd');
    if (u) {
      houd('2. de uitlegketen is volledig',
        u.bestand === m0[R].handler && /gemeten/.test(u.koppeling) && /AUTH uit POORTWACHT\.json/.test(u.bewijs) && !!u.herdraai,
        'bestand ' + u.bestand + '\n           koppeling ' + u.koppeling + '\n           bewijs ' + u.bewijs +
        '\n           herdraai ' + u.herdraai);
      houd('2. de routestand blijft een bestaande stand', ['bewezen', 'verschaald', 'verzwakt', 'geschorst', 'ongemeten'].includes(m2[R].routestand),
        'routestand ' + m2[R].routestand + ' (ontbrekend gaat in de rangorde voor verouderd)');

      console.log('\n  hermeting: ' + u.herdraai + '  (de opdracht uit de keten)\n');
      const r = spawnSync('bash', ['-c', u.herdraai], { cwd: dir, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: 30 * 60 * 1000 });
      houd('3. de herdraai-opdracht uit de keten draaide', r.status === 0,
        'uitgang ' + r.status + (r.status ? ': ' + String(r.stderr || r.stdout).split('\n').filter(Boolean).slice(-2).join(' ') : ''));

      const m4 = meet(dir);
      const pw = JSON.parse(fs.readFileSync(path.join(dir, 'POORTWACHT.json'), 'utf8'));
      houd('4. na: de AUTH-cel van R is weer bewezen en actueel', m4[R].cel === 'bewezen' && !m4[R].verouderd.length,
        'POORTWACHT.json gemeten op ' + (pw.gemeten && pw.gemeten.commit) + ' (HEAD ' + c2 + ')');
      houd('4. en A is ook weer actueel: dezelfde hermeting dekt hem', !m4[A].verouderd.length, '');
    }
  } catch (e) {
    console.error('  de proef kon niet verder: ' + e.message);
    return 2;
  } finally {
    try { git(WORTEL, ['worktree', 'remove', '--force', dir]); } catch (e) { /* opruimen mag falen */ }
  }
  const gezakt = stappen.filter((s) => !s.ok).length;
  console.log('\n  ' + (stappen.length - gezakt) + ' van ' + stappen.length + ' stappen gehouden\n');
  return gezakt ? 1 : 0;
}

if (require.main === module) process.exitCode = main();
