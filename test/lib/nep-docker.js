'use strict';
/* Een nep-`docker` voor de toetsen: geen daemon nodig. De toets schrijft dit
   bestand als `bin/docker` vooraan het PATH van het kindproces. Gedrag via omgeving:
   NEP_DIGEST       het digest dat `image inspect` teruggeeft (standaard: wat gevraagd werd)
   NEP_PULL_FAALT   `pull` mislukt
   NEP_TOETS_FAALT  de toets in het image mislukt
   NEP_LOG          bestand waar elke aanroep in komt, zodat toetsen kunnen zien dat er
                    NOOIT `build` werd aangeroepen */
const fs = require('fs');
const a = process.argv.slice(2);
if (process.env.NEP_LOG) fs.appendFileSync(process.env.NEP_LOG, a.join(' ') + '\n');
const ref = a.find(x => /@sha256:/.test(x)) || '';
if (a[0] === 'pull') { if (process.env.NEP_PULL_FAALT) { console.error('manifest unknown'); process.exit(1); } console.log('Digest: ' + ref); process.exit(0); }
if (a[0] === 'image' && a[1] === 'inspect') { const d = process.env.NEP_DIGEST || ref.split('@')[1]; console.log(ref.split('@')[0] + '@' + d); process.exit(0); }
if (a[0] === 'run') {
  if (a.includes('--test')) { if (process.env.NEP_TOETS_FAALT) { console.log('# pass 0\n# fail 1'); process.exit(1); } console.log('# pass 3\n# fail 0'); process.exit(0); }
  console.log('bewijs ok'); process.exit(0);
}
if (a[0] === 'build') { console.error('NEP: build is in dit pad verboden'); process.exit(99); }
process.exit(0);
