#!/usr/bin/env node
/* ============================================================================
   DE GRENSMELDING -- vind in EEN opstart alle gaten in GRENZEN.json.

   De domeingrens gooit bij een naam die een domein niet heeft opgeschreven, en
   dat is precies de bedoeling. Bij het AANLEGGEN van de lijst is het onhandig:
   je vindt er dan een per opstart, en met tientallen gaten is dat een middag.

   Met RTG_GRENS_MELD=1 laat de grens door en schrijft hij op wat hij zag. Dit
   script start de app met die stand, laat hem alle routers ophangen, en zet wat
   er is gemeld erbij in GRENZEN.json.

   HET IS EEN AANLEGGEREEDSCHAP EN GEEN OPLOSSING. Wat hier automatisch bijkomt,
   is wat de code VANDAAG doet -- niet wat een domein HOORT te mogen. Elke naam
   die hier verschijnt is een vraag: hoort dit domein hier echt bij, of reikt het
   te ver? Het antwoord staat in de git-historie van GRENZEN.json en niet in dit
   script.

   Draai:  node scripts/grensmeld.js          (laat zien wat er ontbreekt)
           node scripts/grensmeld.js --vul    (zet het in GRENZEN.json)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'GRENZEN.json');

/* De app in een kindproces starten met de meldstand aan, en hem vragen wat de
   grens heeft gezien. Een kindproces omdat de app bij het laden een hele wereld
   opzet; dat wil je niet in dit script hebben staan. */
/* De paden VOLUIT en niet relatief, en dat is geen smaak. Deze tekenreeks draait
   in een kindproces met de projectmap als werkmap, dus een pad dat met punt-slash
   vanaf de projectwortel begint zou daar kloppen -- maar een lezer (en de regel in
   scripts/check.js die require-paden natrekt) ziet een pad dat vanaf scripts/ niet
   bestaat. Een pad dat alleen klopt als je weet waar het straks draait, is een pad
   dat je twee keer moet uitleggen.

   Dat die regel hier eerst over mijn UITLEG klaagde in plaats van over de code,
   is geen bijzaak: een bestand dat een patroon beschrijft, bevat het patroon.
   Dezelfde val staat opgeschreven bij regel 36 in check.js, en de oplossing is
   dezelfde -- het patroon niet voluit opschrijven in plaats van de handhaver een
   uitzondering geven. */
const GRENSMODULE = JSON.stringify(path.join(WORTEL, 'server', 'opzet', 'domeingrens.js'));
const SERVERMODULE = JSON.stringify(path.join(WORTEL, 'server', 'server.js'));
const uitlezer = `
  process.env.RTG_GRENS_MELD = '1';
  process.env.RTG_STIL = '1';
  const grens = require(${GRENSMODULE});
  process.on('exit', () => {
    try { require('fs').writeFileSync(process.env.RTG_MELDUIT, JSON.stringify(grens.gemeld()) + '\\n'); } catch (e) {}
  });
  require(${SERVERMODULE});
  setTimeout(() => process.exit(0), 20000);
`;

function meet() {
  const uit = path.join(require('os').tmpdir(), 'rtg-grensmeld-' + process.pid + '.json');
  const r = spawnSync(process.execPath, ['-e', uitlezer], {
    cwd: WORTEL, encoding: 'utf8', timeout: 180000, maxBuffer: 64 * 1024 * 1024,
    env: Object.assign({}, process.env, { RTG_MELDUIT: uit, PORT: '0',
      RTG_DATA_DIR: path.join(require('os').tmpdir(), 'rtg-grensmeld-data') })
  });
  let paren = [];
  try { paren = JSON.parse(fs.readFileSync(uit, 'utf8')); } catch (e) {
    console.error('  de meldstand gaf niets terug. Startte de app wel?');
    console.error('  ' + String(r.stderr || r.stdout || '').trim().split('\n').slice(-6).join('\n  '));
    process.exit(1);
  }
  try { fs.unlinkSync(uit); } catch (e) {}
  const per = new Map();
  for (const p of paren) {
    const [domein, naam] = p.split(' ');
    if (!per.has(domein)) per.set(domein, new Set());
    per.get(domein).add(naam);
  }
  return per;
}

if (require.main === module) {
  console.log('\nDE GRENSMELDING -- de app een keer opstarten met de grens in meldstand\n');
  const per = meet();
  if (!per.size) { console.log('  geen enkel gat: elk domein blijft binnen GRENZEN.json.\n'); process.exit(0); }
  let totaal = 0;
  for (const [d, s] of [...per.entries()].sort((a, b) => b[1].size - a[1].size)) {
    totaal += s.size;
    console.log('  ' + String(s.size).padStart(4) + '  ' + d.padEnd(22) + [...s].slice(0, 6).join(', ') +
      (s.size > 6 ? ', ...' : ''));
  }
  console.log('\n  ' + totaal + ' ontbrekende namen over ' + per.size + ' domeinen');
  if (!process.argv.includes('--vul')) {
    console.log('  Zet ze erbij met: node scripts/grensmeld.js --vul\n');
    process.exit(0);
  }
  const j = JSON.parse(fs.readFileSync(DOEL, 'utf8'));
  for (const [d, s] of per) {
    const set = new Set([].concat(j.domeinen[d] || [], [...s]));
    j.domeinen[d] = [...set].sort();
  }
  const geordend = {};
  for (const d of Object.keys(j.domeinen).sort()) geordend[d] = j.domeinen[d];
  j.domeinen = geordend;
  fs.writeFileSync(DOEL, JSON.stringify(j, null, 2) + '\n');
  console.log('  GRENZEN.json aangevuld met ' + totaal + ' namen.\n');
}

module.exports = { meet };
