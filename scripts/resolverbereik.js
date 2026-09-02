#!/usr/bin/env node
/* HET BEREIK VAN DE RESOLVER -- dekking over ELKE toegestane route, niet over
   zinnen die iemand zelf koos.

   WAAROM DIT NAAST scripts/resolver.js STAAT. Die meet dekking op een corpus van
   27 met de hand geschreven zinnen, en zegt er zelf bij wat daar mis mee is: wie
   de vragen kiest, kiest het resultaat. Zolang de meting uit dezelfde pen komt
   als de code, bewijst 100% weinig.

   Deze meter draait het om. Hij GENEREERT een vraag voor elk pad dat een rol mag
   bedienen -- vandaag 176 -- en vraagt of dat pad in het werkveld overleeft. Het
   corpus groeit dus mee met het platform: een nieuwe route brengt zijn eigen
   proef mee, en niemand hoeft een lijst bij te werken.

   EN HIJ IS EERLIJK OVER ZIJN ZWAKSTE VORM. Een zin die uit de woorden van het
   pad zelf is gebouwd en dan tegen diezelfde woorden wordt gewogen, is deels een
   identiteitstest. Daarom zeven VERVORMINGEN, van zwak naar sterk bewijs:

     eigen woorden      de zwakste: dit toetst vooral de weging en de afkapgrens
     mensenwoorden      via de omgekeerde brug (`ride` -> "taxi"): raakt de bruggen
     alleen domein      alleen het eerste woord: hier bijt de afkapgrens
     alleen werkwoord   alleen het laatste: hier bijt de dunne-bewijsregel
     typefout           een omgedraaide letterpaar in elk woord
     omgekeerd          andere woordvolgorde
     veel ruis          het verzoek verstopt in een lange beleefde zin

   Per vorm apart, want een gemiddelde verbergt de vorm die zakt. DEKKING MOET
   100 ZIJN en het script eindigt met een foutcode als dat niet zo is: een gemist
   vermogen laat de AI "dat kan ik niet" zeggen over iets dat de gebruiker mag.

   WAT ER AL DOOR GEVONDEN IS: op "alleen domein" zakte de dekking naar 90%. Niet
   door de weging maar door de afkapgrens van vijftien, die midden in een GELIJKE
   score sneed -- dertig bankpaden scoren even hard, en de andere helft viel op
   alfabet af. Sindsdien gaat alles wat gelijk staat aan de laatste mee.

   Draaien: npm run resolverbereik */
'use strict';
const fs = require('fs');
const path = require('path');
const { stempel } = require('./lib/stempel');
const { toegestanePaden } = require('../server/kern/stuur/beleid');
const { resolveer } = require('../server/kern/stuur/resolver');
const { SYNONIEMEN } = require('../server/kern/stuur/resolver-woorden');

const ROLLEN = ['member', 'supplier', 'staff'];
const WORTEL = path.join(__dirname, '..');

/* De omgekeerde brug: van het woord dat in een pad staat naar het woord dat een
   mens gebruikt. Zo is de gegenereerde zin niet het pad zelf. */
const OMGEKEERD = {};
for (const [menselijk, doel] of Object.entries(SYNONIEMEN))
  for (const d of (Array.isArray(doel) ? doel : [doel])) if (!OMGEKEERD[d]) OMGEKEERD[d] = menselijk;
const mens = w => OMGEKEERD[w] || w;

const woordenVan = pad => pad.split('/')
  .filter(s => s && s !== 'api' && !ROLLEN.includes(s))
  .flatMap(s => s.split('-'));

/* Twee letters omdraaien: de goedkoopste typefout die een mens echt maakt. */
function tik(w) { return w.length < 5 ? w : w.slice(0, 2) + w[3] + w[2] + w.slice(4); }

const VORMEN = {
  'eigen woorden': p => 'kun je de ' + woordenVan(p).slice(-2).join(' van ') + ' doen',
  'mensenwoorden': p => 'kun je de ' + woordenVan(p).slice(-2).map(mens).join(' van ') + ' doen',
  'alleen domein': p => 'ik wil iets met de ' + mens(woordenVan(p)[0]) + ' doen alsjeblieft',
  'alleen werkwoord': p => 'kun je even ' + mens(woordenVan(p).slice(-1)[0]) + ' voor mij regelen',
  'typefout': p => 'kun je de ' + woordenVan(p).slice(-2).map(w => tik(mens(w))).join(' van ') + ' doen',
  'omgekeerd': p => 'de ' + woordenVan(p).slice(-2).map(mens).reverse().join(' en de ') + ' wil ik graag zien',
  'veel ruis': p => 'hallo ik heb een vraag want ik zat te denken of je misschien de ' +
    woordenVan(p).slice(-2).map(mens).join(' van ') + ' zou kunnen doen voor mij vandaag'
};

function routesUitRegister() {
  let reg;
  try { reg = require('../IDEMPROEF.json'); } catch (e) { return null; }
  return [...new Set((reg.perRoute || [])
    .filter(r => r && r.methode === 'POST' && typeof r.pad === 'string').map(r => r.pad))].sort();
}

function bouw() {
  const alle = routesUitRegister();
  if (!alle || !alle.length) return { fout: 'IDEMPROEF.json ontbreekt of is leeg -- draai eerst: npm run idemproef' };
  const perRol = {};
  for (const rol of ROLLEN) perRol[rol] = toegestanePaden(alle, rol);
  const paden = ROLLEN.flatMap(rol => perRol[rol].map(pad => ({ rol, pad })));
  const vormen = {};
  for (const [naam, maak] of Object.entries(VORMEN)) {
    let gevonden = 0, versmald = 0, veldSom = 0;
    const gemist = [];
    for (const { rol, pad } of paden) {
      const r = resolveer(maak(pad), perRol[rol]);
      veldSom += r.paden.length;
      if (r.versmald) versmald++;
      if (r.paden.includes(pad)) gevonden++;
      else gemist.push({ rol, pad, zin: maak(pad), kreeg: r.versmald ? r.paden.length : 'alles' });
    }
    vormen[naam] = {
      gevonden, totaal: paden.length,
      dekking: Math.round(1000 * gevonden / paden.length) / 10,
      versmaldPct: Math.round(100 * versmald / paden.length),
      gemiddeldWerkveld: Math.round(10 * veldSom / paden.length) / 10,
      gemist
    };
  }
  const laagste = Math.min(...Object.values(vormen).map(v => v.dekking));
  return { paden: paden.length, perRol: Object.fromEntries(ROLLEN.map(r => [r, perRol[r].length])), vormen, laagste };
}

function main() {
  const r = bouw();
  if (r.fout) { console.error(r.fout); process.exit(2); }
  console.log('HET BEREIK VAN DE CAPABILITY-RESOLVER\n');
  console.log('  ' + r.paden + ' toegestane paden (' +
    ROLLEN.map(x => x + ' ' + r.perRol[x]).join(', ') + '), elk met zeven vervormingen\n');
  console.log('  vorm                dekking   versmald   werkveld');
  for (const [naam, v] of Object.entries(r.vormen))
    console.log('  ' + naam.padEnd(18) + (v.gevonden + '/' + v.totaal).padStart(8) +
      ('  ' + v.versmaldPct + '%').padStart(10) + ('  ' + v.gemiddeldWerkveld).padStart(10));
  const gemist = Object.entries(r.vormen).filter(([, v]) => v.gemist.length);
  if (gemist.length) {
    console.log('\nGEMISTE VERMOGENS:');
    for (const [naam, v] of gemist)
      for (const g of v.gemist.slice(0, 8))
        console.log('  [' + naam + '] ' + g.pad + '\n      "' + g.zin + '" -> ' + g.kreeg + ' paden');
  }
  console.log('\nDe zwakste vorm is "eigen woorden": die zin komt uit het pad zelf en toetst');
  console.log('vooral de weging en de afkapgrens. De sterkste zijn "alleen domein" (de');
  console.log('afkapgrens) en "typefout" (de dunne-bewijsregel).');
  Object.assign(r, { stempel: stempel(),
    uitleg: 'Per toegestaan pad een gegenereerde vraag in zeven vervormingen; gemeten of de resolver dat pad dan in zijn werkveld houdt.',
    grens: 'Zegt alleen of het pad in het werkveld BLIJFT (dekking), niet of het bovenaan staat; en de zinnen zijn gegenereerd, geen echte vragen van leden.' });
  fs.writeFileSync(path.join(WORTEL, 'RESOLVERBEREIK.json'), JSON.stringify(r, null, 1) + '\n');
  console.log('\nRESOLVERBEREIK.json geschreven. Laagste dekking: ' + r.laagste + '%');
  if (r.laagste < 100) { console.error('NIET OK: de resolver verbergt een vermogen.'); process.exit(1); }
}

if (require.main === module) main();
module.exports = { bouw, VORMEN, woordenVan };
