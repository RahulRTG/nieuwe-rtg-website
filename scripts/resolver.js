#!/usr/bin/env node
/* HOEVEEL VERSMALT DE RESOLVER ECHT? -- de meter onder EXECUTIE.md blok 0.

   Het document beweert dat een gewone opdracht een werkveld van een handvol
   paden overhoudt in plaats van alles wat een rol mag. Zo'n getal hoort na te
   rekenen te zijn, anders is het een mening met een cijfer erin (dezelfde regel
   die kern/command/simulatie.js op zichzelf toepast).

   DE PADEN KOMEN NIET UIT DIT BESTAND. Ze komen uit IDEMPROEF.json, het
   register dat de echte POST-routes van dit huis draagt, en gaan daarna door
   dezelfde toegestanePaden() als het stuur. Een tweede routelijst hier zou
   precies de fout zijn die de resolver zelf vermijdt.

   DE VRAGEN WEL. Dit zijn zestien gewone opdrachten in drie rollen, met de hand
   geschreven omdat er geen register van echte gebruikersvragen bestaat. Dat is
   de zwakte van deze meting en hij staat in de uitslag: wie de vragen kiest,
   kiest het resultaat. Hij meet dus of de weging WERKT, niet hoe goed hij het
   bij echte gebruikers zou doen.

   Draaien: node scripts/resolver.js */
'use strict';
const { toegestanePaden } = require('../server/kern/stuur/beleid');
const { resolveer } = require('../server/kern/stuur/resolver');

const VRAGEN = {
  member: [
    'zet een afspraak in mijn agenda voor morgenmiddag',
    'maak 200 euro over naar mijn spaarrekening',
    'hoe staat mijn saldo ervoor',
    'zet mijn website live',
    'boek een tafel voor twee vanavond',
    'deel mijn locatie met Sam',
    'vraag krediet aan van 5000 euro',
    'schrijf me in voor het nieuwe schooljaar',
    'koop dat asset en zet hem in mijn collectie',
    'annuleer mijn reservering van vrijdag'
  ],
  supplier: [
    'stuur de btw-herinnering naar mijn klanten',
    'zet de kamer op schoongemaakt',
    'publiceer de nieuwe pagina op onze site',
    'laat me de inkoop van deze week zien'
  ],
  staff: [
    'meld me aan voor de dienst',
    'geef de storing door op lijn 4'
  ]
};

function routesUitRegister() {
  let reg;
  try { reg = require('../IDEMPROEF.json'); }
  catch (e) { return null; }
  return [...new Set((reg.perRoute || [])
    .filter(r => r && r.methode === 'POST' && typeof r.pad === 'string')
    .map(r => r.pad))].sort();
}

function main() {
  const alle = routesUitRegister();
  if (!alle || !alle.length) {
    // Niet gemeten mag nooit als "in orde" langskomen (BESTUUR.md).
    console.error('IDEMPROEF.json ontbreekt of is leeg -- er valt niets te meten. Draai eerst: npm run idemproef');
    process.exit(2);
  }
  console.log('DE VERSMALLING VAN DE CAPABILITY-RESOLVER');
  console.log('  bron: IDEMPROEF.json, ' + alle.length + ' POST-routes\n');
  const rijen = [];
  for (const rol of Object.keys(VRAGEN)) {
    const toe = toegestanePaden(alle, rol);
    console.log(rol + ' -- ' + toe.length + ' toegestane paden');
    for (const vraag of VRAGEN[rol]) {
      const r = resolveer(vraag, toe);
      const na = r.versmald ? r.paden.length : toe.length;
      rijen.push({ rol, voor: toe.length, na, versmald: r.versmald });
      console.log('  ' + String(na).padStart(3) + '  ' + vraag + (r.versmald ? '' : '   [NIET VERSMALD]'));
    }
    console.log('');
  }
  const vs = rijen.filter(r => r.versmald);
  const gem = vs.length ? vs.reduce((a, r) => a + r.na, 0) / vs.length : 0;
  const krimp = vs.length ? 100 - 100 * vs.reduce((a, r) => a + r.na / r.voor, 0) / vs.length : 0;
  console.log(rijen.length + ' vragen, ' + vs.length + ' versmald, ' + (rijen.length - vs.length) + ' niet versmald');
  console.log('gemiddeld werkveld bij versmalling: ' + gem.toFixed(1) + ' paden (' + krimp.toFixed(0) + '% kleiner)');
  const kleinste = vs.length ? Math.min(...vs.map(r => r.na)) : 0;
  console.log('kleinste werkveld: ' + kleinste + ' pad(en) -- daarom kan het model in stuur/lus.js altijd om de volledige lijst vragen');
  console.log('\nWat dit NIET meet: of het model met dat werkveld de juiste keuze maakt,');
  console.log('en of echte gebruikers zulke zinnen typen. De vragen komen uit dit bestand.');
}

if (require.main === module) main();
module.exports = { VRAGEN, routesUitRegister };
