#!/usr/bin/env node
/* DE TWEE METERS VAN DE CAPABILITY-RESOLVER -- EXECUTIE.md blok 0.

   VERSMALLING   hoeveel kleiner werd de toolruimte?
   DEKKING       bleef het gevraagde vermogen erin zitten?

   Ze staan bewust naast elkaar en niet in een cijfer, want ze trekken de
   andere kant op. Versmalling verbeter je door strenger te filteren; dekking
   verbeter je door eerlijker te zijn. Een enkel getal zou de tweede door de
   eerste laten opeten, en dat is precies de fout die scripts/zekerheid.js in
   dit huis al eerder beschreef.

   DEKKING IS DE VEILIGHEIDSMETER EN DIE MOET OP 100. Waar de twee botsen wint
   dekking: liever veertien relevante paden dan drie waarvan de juiste
   ontbreekt. Een gemist vermogen laat de AI zeggen "dat kan ik niet" over iets
   dat de gebruiker gewoon mag, en dat is een leugen met een technische oorzaak.
   Dit script eindigt daarom met een foutcode zodra de dekking onder de 100%
   komt -- een meter die alleen praat, verandert niets.

   DE PADEN KOMEN NIET UIT DIT BESTAND. Ze komen uit IDEMPROEF.json, het
   register met de echte POST-routes, en gaan door dezelfde toegestanePaden()
   als het stuur. De zinnen komen uit ./resolver-corpus.js, dat ook de toets
   voedt: een tweede corpus zou de meter en de toets uit elkaar laten lopen.

   WAT DIT NIET MEET: of het model met dat werkveld de juiste keuze maakt, en of
   echte gebruikers zo typen. De zinnen zijn met de hand geschreven omdat er
   geen register van echte vragen is. Wie de vragen kiest, kiest het resultaat.

   Draaien: npm run resolver */
'use strict';
const { toegestanePaden } = require('../server/kern/stuur/beleid');
const { resolveer } = require('../server/kern/stuur/resolver');
const { CORPUS } = require('./resolver-corpus');

function routesUitRegister() {
  let reg;
  try { reg = require('../IDEMPROEF.json'); } catch (e) { return null; }
  return [...new Set((reg.perRoute || [])
    .filter(r => r && r.methode === 'POST' && typeof r.pad === 'string')
    .map(r => r.pad))].sort();
}

/* Eén zin door de resolver, met beide meters eraan. */
function meet(zin, toegestaan) {
  const r = resolveer(zin.zin, toegestaan);
  const inSet = new Set(r.paden);
  const gemist = (zin.moet || []).filter(p => !inSet.has(p));
  const gesmokkeld = (zin.nooit || []).filter(p => inSet.has(p));
  return { zin, uitslag: r, na: r.paden.length, voor: toegestaan.length,
    versmald: r.versmald, gemist, gesmokkeld, dekt: gemist.length === 0 };
}

function rapport() {
  const alle = routesUitRegister();
  if (!alle || !alle.length) return { fout: 'IDEMPROEF.json ontbreekt of is leeg -- draai eerst: npm run idemproef' };
  const perRol = {};
  const rijen = [];
  for (const zin of CORPUS) {
    if (!perRol[zin.rol]) perRol[zin.rol] = toegestanePaden(alle, zin.rol);
    rijen.push(meet(zin, perRol[zin.rol]));
  }
  const metEis = rijen.filter(r => (r.zin.moet || []).length);
  const dekkend = metEis.filter(r => r.dekt);
  const versmald = rijen.filter(r => r.versmald);
  return {
    routes: alle.length, rijen, perRol,
    dekking: metEis.length ? Math.round(1000 * dekkend.length / metEis.length) / 10 : 100,
    metEis: metEis.length, dekkend: dekkend.length,
    gemistDoor: metEis.filter(r => !r.dekt),
    gesmokkeld: rijen.filter(r => r.gesmokkeld.length),
    versmalling: versmald.length
      ? Math.round(100 - 100 * versmald.reduce((a, r) => a + r.na / r.voor, 0) / versmald.length) : 0,
    gemiddeldWerkveld: versmald.length
      ? Math.round(10 * versmald.reduce((a, r) => a + r.na, 0) / versmald.length) / 10 : 0
  };
}

function main() {
  const r = rapport();
  if (r.fout) { console.error(r.fout); process.exit(2); }
  console.log('DE TWEE METERS VAN DE CAPABILITY-RESOLVER');
  console.log('  bron: IDEMPROEF.json, ' + r.routes + ' POST-routes\n');

  const soorten = [...new Set(CORPUS.map(z => z.soort))];
  console.log('  soort           zinnen   dekking   werkveld');
  for (const soort of soorten) {
    const groep = r.rijen.filter(x => x.zin.soort === soort);
    const eis = groep.filter(x => (x.zin.moet || []).length);
    const ok = eis.filter(x => x.dekt).length;
    const velden = groep.map(x => x.na).join('/');
    console.log('  ' + soort.padEnd(15) + String(groep.length).padStart(4) +
      '   ' + (eis.length ? (ok + '/' + eis.length) : '  -  ').padStart(6) +
      '   ' + velden);
  }

  console.log('\nDEKKING (de veiligheidsmeter): ' + r.dekkend + '/' + r.metEis + ' = ' + r.dekking + '%');
  for (const g of r.gemistDoor)
    console.log('  GEMIST  [' + g.zin.soort + '] "' + g.zin.zin + '"\n          mist: ' + g.gemist.join(' ') +
      '\n          kreeg: ' + (g.versmald ? g.uitslag.paden.join(' ') : '(niet versmald)'));
  for (const g of r.gesmokkeld)
    console.log('  GESMOKKELD [' + g.zin.soort + '] "' + g.zin.zin + '" -> ' + g.gesmokkeld.join(' '));

  console.log('\nVERSMALLING: ' + r.versmalling + '% kleiner, gemiddeld werkveld ' +
    r.gemiddeldWerkveld + ' paden (' + r.versmalling + '% van ' + CORPUS.length + ' zinnen versmald: ' +
    r.rijen.filter(x => x.versmald).length + ')');
  console.log('\nWaar de twee botsen wint dekking: liever veertien relevante paden dan drie');
  console.log('waarvan de juiste ontbreekt. Wat dit NIET meet: of het model met dat werkveld');
  console.log('de juiste keuze maakt, en of echte gebruikers zo typen.');

  if (r.dekking < 100 || r.gesmokkeld.length) {
    console.error('\nNIET OK: de dekking is niet volledig' +
      (r.gesmokkeld.length ? ' en er kwam een pad bij dat er niet in hoort' : '') + '.');
    process.exit(1);
  }
  console.log('\nDekking volledig.');
}

if (require.main === module) main();
module.exports = { rapport, meet, routesUitRegister };
