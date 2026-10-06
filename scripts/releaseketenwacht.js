#!/usr/bin/env node
'use strict';
// A-P0-01: bewaakt de releaseketen. Leest .github/workflows/release-image.yml
// en zegt per schakel of hij er staat. Hij bouwt, publiceert en promoveert
// NIETS; een ontbrekende schakel is een uitslag mét reden en nooit stil groen.
// Zie RELEASEKETEN.md.
const fs = require('fs');
const path = require('path');

const SCHAKELS = [
  { id: 'exacte-commit', eis: /RTG_RELEASE_COMMIT=\$GITHUB_SHA/, reden: 'het image moet aan de exacte commit gebonden worden' },
  { id: 'onveranderlijke-tag', eis: /candidate-\$\{GITHUB_SHA::12\}-\$\{GITHUB_RUN_ID\}/, reden: 'de tag moet commit en run dragen, zodat hij niet herbruikt wordt' },
  { id: 'volledige-tests', eis: /npm run afbouw:software/, reden: 'de volledige afbouw moet draaien voordat er gepubliceerd wordt' },
  { id: 'digest-binding', eis: /imageherkomst\.js --binden[\s\S]*--digest=/, reden: 'bewijs moet aan het registry-digest hangen en niet aan een tag' },
  { id: 'digest-controle', eis: /imageherkomst\.js --controle --eis-kandidaat/, reden: 'het gepubliceerde digest moet tegen het bewijs worden nagekeken' },
  { id: 'sbom', eis: /imageherkomst\.js --sbom/, reden: 'een stuklijst uit het gepubliceerde image' },
  { id: 'ondertekening-vooraf', eis: /--sleutelcontrole[\s\S]*docker push/, reden: 'ondertekening moet voor de publicatie bewezen zijn' },
  { id: 'artefact-vastgelegd', eis: /docker push[\s\S]*artefactketen\.js gebouwd[\s\S]*--digest=/, reden: 'het gebouwde digest moet in de ondertekende artefactketen' },
  { id: 'test-op-digest', eis: /artefactketen\.js gebouwd[\s\S]*artefactketen\.js testen[\s\S]*--digest=/, reden: 'de tests moeten tegen exact het gepubliceerde digest draaien en dat vastleggen' },
  { id: 'ketenbewijs-bewaard', eis: /artefactketen\.json/, reden: 'de artefactketen moet als bewijs mee naar de promotie' },
];
// Wat dit workflow met opzet NIET mag doen: promoveren of uitrollen.
const VERBODEN = [
  { id: 'geen-latest-tag', patroon: /docker\s+(tag|push)[^\n]*:latest/, reden: 'een kandidaat mag geen officiële tag krijgen' },
  { id: 'geen-bouw-na-test', patroon: /artefactketen\.js testen[\s\S]*docker\s+(buildx\s+)?build\b/, reden: 'na de test mag er niets meer gebouwd worden: dan is wat gepromoveerd wordt niet wat getest is' },
  { id: 'geen-uitrol', patroon: /(kubectl|ssh\s|rsync\s|docker\s+compose\s+up|docker\s+stack\s+deploy)/, reden: 'dit workflow rolt niets uit' },
];

/* PROMOTIE EN ROLLBACK. Deze bestanden vormen het pad waarlangs een artefact live
   gaat of teruggaat. Wat hier NIET in mag staan: een build (een herbouw is een
   ander artefact). Wat er WEL in moet staan: de poort op de artefactketen.
   Elk bestand heeft zijn eigen eisen; een ontbrekend bestand is een uitslag. */
const PROMOTIEPAD = [
  { bestand: 'scripts/docker/live.sh', eist: [
    ['rollback-benoemt-digest', /case "\$doel" in sha256:\*\)/, 'rollback benoemt een digest'],
    ['rollback-keten', /artefactketen\.js eis-rollback/, 'rollback vraagt de ketenpoort'],
    ['rollback-lokaal-id', /--format='\{\{\.Id\}\} \{\{json \.RepoDigests\}\}' "\$doel_image_id"/, 'rollback controleert het exacte lokale image-id'],
    ['draaiend-bewezen', /artefactketen\.js eis-actief/, 'het draaiende image moet bewezen zijn'],
    ['uitrol-auditregel', /noteer-uitgevoerd --soort=promotie/, 'de uitrol landt in het auditboek'],
    ['rollback-auditregel', /noteer-uitgevoerd --soort=rollback/, 'de rollback landt in het auditboek'],
  ] },
  { bestand: 'scripts/lib/productie-promotie.js', eist: [['promotie-poort', /if \(!isNative\) eisKetenbesluit\(root, commit, kandidaat, env\)/, 'het promotiedocument vraagt de ketenpoort']] },
  { bestand: 'scripts/live-vrijgave.js', eist: [['deploy-poort', /eisKetenbesluit\(/, 'de uitrol vraagt de ketenpoort']] },
  { bestand: 'scripts/lib/live-kandidaat.js', eist: [] },
  { bestand: 'scripts/promotie-teken.js', eist: [] },
  { bestand: 'scripts/lib/artefactketen.js', eist: [] },
  { bestand: 'scripts/artefactketen.js', eist: [] },
];
const BOUWPATRONEN = [/\bdocker\s+(buildx\s+)?build\b/, /\bdocker\s+compose\b[^\n]*\s(build|--build)(\s|$)/, /\bcompose\s+build\b/, /\bkaniko\b/];
function beoordeelPromotiepad(lees) {
  const problemen = [];
  for (const { bestand, eist } of PROMOTIEPAD) {
    let t;
    try { t = lees(bestand); } catch (e) { problemen.push({ id: 'bestand-ontbreekt', bestand, reden: 'het promotiepad kan niet gelezen worden' }); continue; }
    const code = t.split('\n').filter(r => !/^\s*(#|\/\/|\*|\/\*)/.test(r)).join('\n');
    for (const p of BOUWPATRONEN) if (p.test(code)) problemen.push({ id: 'bouw-in-promotiepad', bestand, reden: 'promotie en rollback bouwen nooit: ' + p });
    for (const [id, re, reden] of eist) if (!re.test(t)) problemen.push({ id, bestand, reden });
  }
  return { problemen, rond: problemen.length === 0 };
}

function beoordeel(tekst) {
  const schakels = SCHAKELS.map(s => ({ id: s.id, staat: s.eis.test(tekst), reden: s.reden }));
  const verboden = VERBODEN.filter(v => v.patroon.test(tekst)).map(v => ({ id: v.id, reden: v.reden }));
  return { schakels, verboden, rond: schakels.every(s => s.staat) && verboden.length === 0 };
}

function main() {
  const bestand = process.argv[2] || path.join(__dirname, '..', '.github', 'workflows', 'release-image.yml');
  const uitslag = beoordeel(fs.readFileSync(bestand, 'utf8'));
  const wortel = path.join(__dirname, '..');
  const pad = beoordeelPromotiepad(b => fs.readFileSync(path.join(wortel, b), 'utf8'));
  for (const x of pad.problemen) console.log('PROMOTIEPAD ' + x.id + ' (' + x.bestand + ') -- ' + x.reden);
  if (!pad.rond) uitslag.rond = false;
  for (const s of uitslag.schakels) console.log((s.staat ? 'ok      ' : 'ONTBREEKT') + ' ' + s.id + (s.staat ? '' : ' -- ' + s.reden));
  for (const v of uitslag.verboden) console.log('VERBODEN  ' + v.id + ' -- ' + v.reden);
  console.log('Deze wacht leest bronnen; dat de keten werkt bewijzen test/artefactketen.test.js en een echte CI-run. Zie RELEASEKETEN.md.');
  process.exit(uitslag.rond ? 0 : 1);
}
if (require.main === module) main();
module.exports = { beoordeel, beoordeelPromotiepad, PROMOTIEPAD, SCHAKELS, VERBODEN };
