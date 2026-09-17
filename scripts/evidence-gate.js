#!/usr/bin/env node
'use strict';

/* De beschermde check houdt één vaste naam, ongeacht welke uitvoeringsweg het
   bewijs leverde. Skipped is alleen toegestaan voor de weg die NIET gekozen is. */
const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const i = a.indexOf('='); return [a.slice(2, i), a.slice(i + 1)];
}));
const mode = args.mode;
const verwacht = mode === 'incremental' ? args.incremental : args.full;
if (!['incremental', 'full'].includes(mode)) {
  console.error('onbekende bewijsmodus: ' + mode); process.exit(1);
}
if (verwacht !== 'success') {
  console.error('de gekozen ' + mode + '-uitvoering was ' + verwacht + ', niet success'); process.exit(1);
}
console.log('beschermd oordeel: ' + mode + '-bewijs is volledig groen');
