#!/usr/bin/env node
/* ============================================================================
   ROMMELIGE MENSENTAAL DOOR DE BESTAANDE RESOLVER.

   WAAROM DIT SCRIPT ER IS

   `npm run resolver` en `npm run resolverbereik` meten de resolver met zinnen
   die uit de PADEN zijn afgeleid: een vraag per toegestaan pad, in zeven
   vervormingen. Dekking 100%, en dat klopt -- maar die zinnen dragen per
   constructie de woorden van hun eigen route. De kop van scripts/resolver.js
   zegt dat zelf al met zoveel woorden: *"WAT DIT NIET MEET: of echte gebruikers
   zo typen. Wie de vragen kiest, kiest het resultaat."*

   Dit script kiest de vragen anders. Het zijn zinnen zoals mensen ze werkelijk
   uitspreken -- kort, vaag, verwijzend, verkeerd gespeld, emotioneel -- en ze
   staan hier met opzet ZONDER verwachte uitkomst. Dit is geen poort en geen
   ratel: het is een spiegel. Wie er een norm van maakt voordat er een laag is
   die deze zinnen hoort te begrijpen, meet een gebrek als een fout.

   WAT DE EERSTE RONDE VOND (12 september 2026, rol member, 120 paden):

     - 5 van de 18 zinnen versmalden; 13 vielen terug op de volle lijst;
     - van die 5 versmalden er DRIE naar het verkeerde domein, en alle drie op
       een woordbotsing: "Kan ik vrijdag weg?" kwam uit op /api/site/foto-weg
       (weg als VERWIJDERD in plaats van AFWEZIG), "zet die later" op
       /api/bank/terugkerend/zet, "waar blijft ie" op /api/locatie/*;
     - zelfs de nette controlezin "Ik wil een vlucht boeken naar Parijs" vers-
       malde niet: een woord raakt een pad, en de eigen grendel `dun bewijs is
       geen bewijs` houdt hem dan tegen.

   DE CONCLUSIE IS NIET DAT DE RESOLVER STUK IS. Hij is veilig: terugvallen op
   de volle lijst is precies wat hij hoort te doen bij dun bewijs, want een
   versmalling die het gevraagde vermogen verbergt is de gevaarlijkste faalvorm
   van die laag (EXECUTIE.md blok 0). Hij is alleen niet BEGRIJPEND, en dat is
   iets anders. De dertien die niet versmallen falen bovendien niet op taal maar
   op VERWIJZING: "die", "dat ding", "daar", "hetzelfde als vorige keer" dragen
   nul lexicaal signaal. Geen enkel taalmodel lost dat op zonder context.

   De drie verkeerde versmallingen zijn een tweede soort en horen bij
   SEMANTIEK.json: een woord met twee betekenissen, nu in de woordenschat van
   de resolver in plaats van in twee modules.

   Draaien: npm run rommeltaal
   ========================================================================== */
'use strict';
const path = require('path');
const { toegestanePaden } = require('../server/kern/stuur/beleid');
const { resolveer } = require('../server/kern/stuur/resolver');

const WORTEL = path.join(__dirname, '..');

/* De zinnen. Geen `moet` en geen `nooit`: zie de kop -- dit is een spiegel en
   geen poort. Wat een mens hier BEDOELT staat er wel bij, in gewone taal, zodat
   een lezer zelf kan zien of de uitslag ergens op slaat. */
const ZINNEN = [
  { zin: 'Parijs volgende week.', bedoeling: 'een reis plannen' },
  { zin: 'Kan ik vrijdag weg?', bedoeling: 'kan ik die dag reizen' },
  { zin: 'Regel iets leuks met Sophie.', bedoeling: 'een afspraak met iemand' },
  { zin: 'Mijn vlucht is kut, fix dit.', bedoeling: 'een vlucht wijzigen' },
  { zin: 'Waar blijft dat ding?', bedoeling: 'een bestelling volgen' },
  { zin: 'Doe hetzelfde als vorige keer.', bedoeling: 'een eerdere handeling herhalen' },
  { zin: 'Ik wil daarheen.', bedoeling: 'naar de bestemming op het scherm' },
  { zin: 'Kan dat goedkoper?', bedoeling: 'een alternatief zoeken' },
  { zin: 'Nee die andere.', bedoeling: 'de andere optie uit de vergelijking' },
  { zin: 'parijs vrijda 2 mense', bedoeling: 'een reis plannen, met typefouten' },
  { zin: 'regel ff hotel', bedoeling: 'een verblijf boeken' },
  { zin: 'zet die later', bedoeling: 'iets verplaatsen in de tijd' },
  { zin: 'doe maar', bedoeling: 'bevestigen wat er openstaat' },
  { zin: 'ik kan morgen niet', bedoeling: 'een afspraak afzeggen of verzetten' },
  { zin: 'waar blijft ie', bedoeling: 'een bestelling volgen' },
  { zin: 'fix vlucht', bedoeling: 'een vlucht wijzigen' },
  /* Twee ijkzinnen die WEL expliciet zijn. Zonder die twee weet je niet of een
     lage uitslag aan de zinnen ligt of aan de resolver. */
  { zin: 'Ik wil een vlucht boeken naar Parijs.', bedoeling: 'ijkzin: expliciet' },
  { zin: 'Betaal mijn openstaande factuur.', bedoeling: 'ijkzin: expliciet' }
];

function routesUitRegister() {
  let reg;
  try { reg = require(path.join(WORTEL, 'IDEMPROEF.json')); } catch (e) { return null; }
  return [...new Set((reg.perRoute || [])
    .filter(r => r && r.methode === 'POST' && typeof r.pad === 'string')
    .map(r => r.pad))].sort();
}

const alle = routesUitRegister();
if (!alle || !alle.length) {
  console.error('IDEMPROEF.json ontbreekt of is leeg -- draai eerst: npm run idemproef');
  process.exit(2);
}
const toegestaan = toegestanePaden(alle, 'member');
if (!toegestaan.length) {
  console.error('Geen toegestane paden voor rol member; er is NIETS gemeten.');
  process.exit(2);
}

console.log('ROMMELTAAL -- ' + ZINNEN.length + ' menselijke zinnen, rol member, ' +
            toegestaan.length + ' toegestane paden.');
console.log('Dit is een spiegel en geen poort: er is geen norm en dit script zakt nergens op.\n');

let versmald = 0;
for (const z of ZINNEN) {
  const r = resolveer(z.zin, toegestaan);
  if (r.versmald) versmald++;
  const uit = r.versmald
    ? String(r.paden.length).padStart(3) + ' paden  ' + r.paden.slice(0, 3).join(' ')
    : '  volle lijst  (' + String(r.reden || '').slice(0, 58) + ')';
  console.log(('"' + z.zin + '"').padEnd(42) + uit);
  console.log(' '.repeat(42) + 'bedoeling: ' + z.bedoeling);
}
console.log('\nversmald: ' + versmald + ' van ' + ZINNEN.length +
            ', volle lijst: ' + (ZINNEN.length - versmald) + '.');
console.log('Een versmalling is hier geen succes: lees per regel of het pad iets met de bedoeling te maken heeft.');
