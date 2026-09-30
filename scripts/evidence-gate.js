#!/usr/bin/env node
'use strict';

/* De beschermde check houdt één vaste naam, ongeacht welke uitvoeringsweg het
   bewijs leverde. Skipped is alleen toegestaan voor de weg die NIET gekozen is. */
function leesArgs(argv) {
  return Object.fromEntries(argv.map((a) => {
  const i = a.indexOf('='); return [a.slice(2, i), a.slice(i + 1)];
  }));
}

function controleer(args) {
  const mode = args.mode;
  if (mode === 'adversarial') {
    const gezakt = ['ladder', 'roles', 'gluur-self', 'gluur'].filter((naam) => args[naam] !== 'success');
    if (gezakt.length) throw new Error('adversarial bewijs niet volledig groen: ' +
      gezakt.map((naam) => naam + '=' + args[naam]).join(', '));
    return 'adversarial bewijs: aanval, rollen en horizontale isolatie zijn groen';
  }
  if (mode === 'merge') {
    const volledig = args.route === 'full';
    if (!['full', 'incremental'].includes(args.route)) throw new Error('onbekende bewijsroute: ' + args.route);
    if (!['constitution', 'sensitive', 'product', 'light'].includes(args.risk)) {
      throw new Error('onbekende risicobaan: ' + args.risk);
    }
    const vereist = [['norm', true], ['security', true],
      ['dependency', args.event === 'pull_request'],
      ['adversarial', volledig || ['constitution', 'sensitive'].includes(args.risk)],
      ['container', volledig || args.risk !== 'light']];
    const gezakt = vereist.filter(([naam, nodig]) => nodig
      ? args[naam] !== 'success'
      : !['success', 'skipped'].includes(args[naam]));
    if (gezakt.length) throw new Error('mergecontract niet volledig groen: ' +
      gezakt.map(([naam]) => naam + '=' + args[naam]).join(', '));
    return 'RTG Merge Gate: route, risico en ondersteunend bewijs zijn groen';
  }
  if (mode === 'split') {
    const gezakt = ['unit', 'browser'].filter((naam) => {
      const aantal = Number(args[naam + '-count']);
      if (!Number.isInteger(aantal) || aantal < 0) return true;
      return aantal === 0 ? !['success', 'skipped'].includes(args[naam]) : args[naam] !== 'success';
    });
    if (gezakt.length) throw new Error('incrementeel bewijs niet volledig groen: ' +
      gezakt.map((naam) => naam + '=' + args[naam]).join(', '));
    return 'incrementeel bewijs: unit en browser zijn onafhankelijk groen';
  }
  const verwacht = mode === 'incremental' ? args.incremental : args.full;
  if (!['incremental', 'full'].includes(mode)) throw new Error('onbekende bewijsmodus: ' + mode);
  if (verwacht !== 'success') throw new Error('de gekozen ' + mode + '-uitvoering was ' +
    verwacht + ', niet success');
  return 'beschermd oordeel: ' + mode + '-bewijs is volledig groen';
}

if (require.main === module) {
  try { console.log(controleer(leesArgs(process.argv.slice(2)))); }
  catch (e) { console.error(e.message); process.exitCode = 1; }
}

module.exports = { leesArgs, controleer };
