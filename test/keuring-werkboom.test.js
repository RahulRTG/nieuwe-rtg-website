/* DE KEURING TELT EEN GENESTE WERKBOOM NIET MEE.

   `git worktree add` legt een volledige kopie van de bron neer, met een
   `.git`-BESTAND in de wortel van die kopie (een echte wortel heeft een
   `.git`-map). Agenten van Claude Code zetten zulke bomen in .claude/worktrees/
   binnen het huis. De wandelaar van scripts/keuring.js sloeg node_modules, .git,
   data en work/ over -- en liep zo'n werkboom dus gewoon in.

   GEMETEN op 10 september 2026, met twee van zulke bomen in het huis en geen
   regel code veranderd: keuringDubbeling 178 -> 4966, keuringOmvang 324 -> 966,
   keuringScheef 17 -> 57. De norm zakte op vier meters tegelijk om een
   meetartefact. Dezelfde fout als de `work/`-kandidaat die de wandelaar al
   kende, alleen zonder vaste naam: daarom wordt hier de VORM herkend (een map
   met een `.git`-bestand) en niet een mapnaam.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - `if (geNesteWerkboom(p)) continue;` weggehaald
     -> "een map met een .git-bestand wordt overgeslagen" ZAKT (RAAK)
   - geNesteWerkboom laten kijken naar een .git-MAP in plaats van -bestand
     -> "een echte wortel met een .git-map wordt gewoon gelezen" ZAKT (RAAK)

   Los: node --test test/keuring-werkboom.test.js */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

/* keuring.js loopt bij het laden het echte huis door (const alle = loop(WORTEL));
   dat is eenmalig en hoort bij zijn ontwerp. Deze toets gebruikt daarna alleen
   de geexporteerde wandelaar op een eigen tijdelijke boom. */
const { loop, geNesteWerkboom } = require('../scripts/keuring');

function boom(vorm) {
  const wortel = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-werkboom-'));
  for (const [rel, inhoud] of Object.entries(vorm)) {
    const p = path.join(wortel, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    if (inhoud !== null) fs.writeFileSync(p, inhoud);
    else fs.mkdirSync(p, { recursive: true });
  }
  return wortel;
}
const relatief = (wortel, lijst) => lijst.map(p => path.relative(wortel, p)).sort();

test('een map met een .git-bestand wordt overgeslagen', () => {
  const w = boom({
    'server/kern/echt.js': '// echt',
    '.claude/worktrees/wf-1/.git': 'gitdir: /ergens/anders/.git/worktrees/wf-1\n',
    '.claude/worktrees/wf-1/server/kern/kopie.js': '// kopie',
    'elders/kopie2/.git': 'gitdir: /ergens/anders\n',
    'elders/kopie2/server/kern/kopie2.js': '// kopie',
  });
  try {
    assert.deepEqual(relatief(w, loop(w)), ['server/kern/echt.js'],
      'alles onder een map met een .git-bestand is een tweede bronboom en hoort niet in de telling');
  } finally { fs.rmSync(w, { recursive: true, force: true }); }
});

test('een echte wortel met een .git-map wordt gewoon gelezen', () => {
  /* De positieve controle: het huis zelf heeft een .git-MAP, en die map wordt
     overgeslagen zonder dat de wortel als werkboom telt. Zonder deze toets zou
     een wacht die op elke `.git` afgaat de hele keuring leeg laten lopen -- en
     een lege keuring is groen. */
  const w = boom({ '.git/HEAD': 'ref: refs/heads/main\n', 'server/kern/echt.js': '// echt' });
  try {
    assert.equal(geNesteWerkboom(w), false, 'een .git-map maakt geen werkboom van de wortel');
    assert.deepEqual(relatief(w, loop(w)), ['server/kern/echt.js']);
  } finally { fs.rmSync(w, { recursive: true, force: true }); }
});
