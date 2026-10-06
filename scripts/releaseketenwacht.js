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
];
// Wat dit workflow met opzet NIET mag doen: promoveren of uitrollen.
const VERBODEN = [
  { id: 'geen-latest-tag', patroon: /docker\s+(tag|push)[^\n]*:latest/, reden: 'een kandidaat mag geen officiële tag krijgen' },
  { id: 'geen-uitrol', patroon: /(kubectl|ssh\s|rsync\s|docker\s+compose\s+up|docker\s+stack\s+deploy)/, reden: 'dit workflow rolt niets uit' },
];

function beoordeel(tekst) {
  const schakels = SCHAKELS.map(s => ({ id: s.id, staat: s.eis.test(tekst), reden: s.reden }));
  const verboden = VERBODEN.filter(v => v.patroon.test(tekst)).map(v => ({ id: v.id, reden: v.reden }));
  return { schakels, verboden, rond: schakels.every(s => s.staat) && verboden.length === 0 };
}

function main() {
  const bestand = process.argv[2] || path.join(__dirname, '..', '.github', 'workflows', 'release-image.yml');
  const uitslag = beoordeel(fs.readFileSync(bestand, 'utf8'));
  for (const s of uitslag.schakels) console.log((s.staat ? 'ok      ' : 'ONTBREEKT') + ' ' + s.id + (s.staat ? '' : ' -- ' + s.reden));
  for (const v of uitslag.verboden) console.log('VERBODEN  ' + v.id + ' -- ' + v.reden);
  console.log('Niet bewezen door deze wacht: herstel/rollback op dezelfde bytes en promotie van alleen dit digest (zie RELEASEKETEN.md).');
  process.exit(uitslag.rond ? 0 : 1);
}
if (require.main === module) main();
module.exports = { beoordeel, SCHAKELS, VERBODEN };
