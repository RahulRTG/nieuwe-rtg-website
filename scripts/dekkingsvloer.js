#!/usr/bin/env node
'use strict';

/* ============================================================================
   DE DEKKINGSVLOER OVER MEERDERE DELEN.

   WAAROM DIT ER IS

   De dekkingsvloer stond in de vlaggen van `npm run test:gate`:
   --test-coverage-lines=78 --test-coverage-branches=78 --test-coverage-functions=65.
   Die vlaggen rekenen PER PROCES. Zodra de suite over vier runners wordt
   verdeeld, meet elk deel alleen zijn eigen kwart en zakt elke vloer -- of erger,
   iemand verlaagt de vloer tot een kwart hem haalt, en dan bewaakt hij niets meer.

   Daarom rekent de vloer nu buiten de testrun: elk deel schrijft een lcov-bestand
   (--test-reporter=lcov), en dit script telt die bestanden bij elkaar op voordat
   het oordeelt. Een regel die in deel 3 geraakt is, telt ook als deel 1 hem
   nooit heeft geladen. Dat is precies wat de vlaggen deden toen alles nog in een
   proces liep.

   WAT ER GEMETEN WORDT, EN WAT NIET

   Node meet de dekking van wat er IN HET TESTPROCES ZELF is geladen. De
   kindservers die de toetsen starten zijn eigen processen en tellen hier niet
   mee -- dat was voor deze verdeling ook al zo, en het is dus geen verlies. Wat
   die servers werkelijk hebben afgehandeld, staat in het routejournaal en wordt
   door scripts/dekking.js gemeten. De twee meters kijken bewust naar iets anders.

   DE VLOEREN

   GEMETEN OP 17 AUGUSTUS 2026, volledige suite (6520 toetsen) in EEN proces:
     regels 80,63   takken 80,60   functies 67,73   -> vloer 78 / 78 / 65
   NAGEMETEN OP 26 AUGUSTUS 2026, dezelfde suite over vier delen, opgeteld:
     regels 78,91   takken 80,04   functies 65,07
   De vloeren blijven dus staan waar ze stonden -- het opdelen kost ze niets.
   Wat wel opvalt en hier hoort te staan: de lucht boven de vloer is dun
   geworden, en op functies is hij zeven honderdsten. De eerstvolgende tak die
   een handvol functies toevoegt zonder toets maakt deze stap rood. Dat is de
   ratel die werkt, geen defect -- maar wie hem tegenkomt weet nu waarom.
   Bij de volgende meting hoort de vloer mee op te schuiven; dat is dezelfde
   ratel als NORM.json.

   Gebruik:
     node scripts/dekkingsvloer.js <map-of-lcov-bestand> [...meer]
     node scripts/dekkingsvloer.js dekking --json
   ========================================================================== */

const fs = require('fs');
const path = require('path');

const VLOER = { regels: 78, takken: 78, functies: 65 };

function lcovBestanden(paden) {
  const uit = [];
  for (const p of paden) {
    let st;
    try { st = fs.statSync(p); } catch (e) { continue; }
    if (st.isDirectory()) {
      for (const naam of fs.readdirSync(p).sort()) uit.push(...lcovBestanden([path.join(p, naam)]));
    } else if (/\.(info|lcov)$/.test(p)) {
      uit.push(p);
    }
  }
  return uit;
}

/* Een lcov-bestand inlezen en optellen bij wat er al ligt. Elke aanroep is EEN
   deel; de sleutel per bestand is het pad zoals lcov het noemt.

   REGELS EN FUNCTIES zijn eenvoudig: een teller die in het ene deel nul is en in
   het andere niet, telt als geraakt. Nagemeten tegen node's eigen dekkingstabel
   op twee steekproeven: dezelfde percentages tot op de honderdste. Let op dat de
   functiesleutel de NAAM is en niet regel+naam -- dat is niet slordigheid maar
   de meting: met regel+naam kwamen er functies bij die node zelf niet telt
   (56,45 tegen node's 55,59), met de naam alleen komt het cijfer exact uit.

   TAKKEN VRAGEN MEER, en dat is een echte eigenschap van lcov en niet van ons.
   Een BRDA-regel heet `regel,blok,tak`, en die blok- en taknummers zijn PER
   PROCES toegekend: wat in deel 1 blok 0 heet, kan in deel 2 blok 1 heten. Wie
   die drie zomaar als sleutel gebruikt, krijgt er bij het samenvoegen takken bij
   die niet bestaan -- de noemer groeit harder dan de teller en de dekking zakt
   zonder dat er iets veranderd is.

   GEMETEN OP 26 AUGUSTUS 2026, op dezelfde 244 toetsbestanden, een keer in een
   proces en een keer in twee:
     sleutel regel:blok:tak   77,15%  ->  74,17%   (bijna drie punten verlies)
     per regel het maximum    77,15%  ->  76,40%
     noemer max + vereniging  77,15%  ->  76,96%   <- deze
   Daarom: de NOEMER van een regel is het grootste aantal takken dat een deel op
   die regel zag, en de TELLER is de vereniging van de takken die ergens genomen
   zijn, afgetopt op die noemer. In een enkel proces geeft dat exact hetzelfde
   getal als de simpele sleutel; over delen blijft het verschil onder een halve
   punt, en het verschil dat overblijft valt de veilige kant op (te laag). */
function voegSamen(kaart, tekst) {
  let huidig = null;
  let takkenVanDitDeel = null;      // per bestand: regelnr -> aantal takken in DIT deel
  const sluitBestand = () => {
    if (!huidig || !takkenVanDitDeel) return;
    for (const [nr, aantal] of takkenVanDitDeel) {
      const tak = huidig.takken.get(nr);
      if (!tak) huidig.takken.set(nr, { noemer: aantal, genomen: new Set() });
      else tak.noemer = Math.max(tak.noemer, aantal);
    }
    takkenVanDitDeel = null;
  };
  for (const regel of String(tekst).split(/\r?\n/)) {
    if (regel.startsWith('SF:')) {
      sluitBestand();
      const naam = regel.slice(3).trim().split(path.sep).join('/');
      huidig = kaart.get(naam);
      if (!huidig) { huidig = { regels: new Map(), functies: new Map(), takken: new Map() }; kaart.set(naam, huidig); }
      takkenVanDitDeel = new Map();
      continue;
    }
    if (!huidig) continue;
    if (regel === 'end_of_record') { sluitBestand(); huidig = null; continue; }
    if (regel.startsWith('DA:')) {
      const [nr, aantal] = regel.slice(3).split(',');
      huidig.regels.set(nr, (huidig.regels.get(nr) || 0) + Number(aantal || 0));
    } else if (regel.startsWith('FNDA:')) {
      const komma = regel.indexOf(',');
      const aantal = Number(regel.slice(5, komma) || 0);
      const naam = regel.slice(komma + 1);
      huidig.functies.set(naam, (huidig.functies.get(naam) || 0) + aantal);
    } else if (regel.startsWith('FN:')) {
      const komma = regel.indexOf(',');
      const naam = regel.slice(komma + 1);
      if (!huidig.functies.has(naam)) huidig.functies.set(naam, 0);
    } else if (regel.startsWith('BRDA:')) {
      const [nr, blok, tak, genomen] = regel.slice(5).split(',');
      takkenVanDitDeel.set(nr, (takkenVanDitDeel.get(nr) || 0) + 1);
      if (genomen !== '-' && Number(genomen || 0) > 0) {
        let bekend = huidig.takken.get(nr);
        if (!bekend) { bekend = { noemer: 0, genomen: new Set() }; huidig.takken.set(nr, bekend); }
        bekend.genomen.add(blok + ':' + tak);
      }
    }
  }
  sluitBestand();
  return kaart;
}

function tel(kaart) {
  const som = { regels: [0, 0], takken: [0, 0], functies: [0, 0] };
  for (const bestand of kaart.values()) {
    for (const soort of ['regels', 'functies']) {
      for (const aantal of bestand[soort].values()) {
        som[soort][1]++;
        if (aantal > 0) som[soort][0]++;
      }
    }
    for (const tak of bestand.takken.values()) {
      som.takken[1] += tak.noemer;
      som.takken[0] += Math.min(tak.genomen.size, tak.noemer);
    }
  }
  const pct = (a) => a[1] ? (a[0] / a[1]) * 100 : 100;
  return {
    bestanden: kaart.size,
    regels: pct(som.regels), takken: pct(som.takken), functies: pct(som.functies),
    ruw: som
  };
}

function meet(paden) {
  const bestanden = lcovBestanden(paden);
  const kaart = new Map();
  for (const b of bestanden) voegSamen(kaart, fs.readFileSync(b, 'utf8'));
  return Object.assign(tel(kaart), { delen: bestanden.length, delenNamen: bestanden });
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const jsonUit = argv.includes('--json');
  const paden = argv.filter(a => !a.startsWith('--'));
  if (!paden.length) {
    console.error('Geef minstens een lcov-bestand of een map met lcov-bestanden mee.');
    process.exit(2);
  }
  const uitslag = meet(paden);

  /* GEEN LCOV IS GEEN UITSLAG. Zonder deze regel zou een deel dat zijn bestand
     niet heeft weggeschreven -- een gevallen runner, een verkeerd pad -- hier
     als 100% dekking van nul regels binnenkomen, en dan meldt de vloer groen
     over een meting die nooit heeft plaatsgevonden. Dat is precies de vorm waar
     LAT.md regel 10 voor waarschuwt. */
  if (!uitslag.delen || !uitslag.bestanden) {
    console.error('Geen lcov-gegevens gevonden in: ' + paden.join(', ') +
      ' -- dan stelt deze vloer niets vast.');
    process.exit(1);
  }

  if (jsonUit) {
    console.log(JSON.stringify({ vloer: VLOER, gemeten: uitslag }, null, 2));
  } else {
    console.log('\nDE DEKKINGSVLOER -- ' + uitslag.delen + ' deel/delen samengeteld over ' +
      uitslag.bestanden + ' bronbestanden\n');
    for (const [soort, waarde] of [['regels', uitslag.regels], ['takken', uitslag.takken], ['functies', uitslag.functies]]) {
      const vloer = VLOER[soort];
      const merk = waarde + 1e-9 >= vloer ? '  ' : '<-';
      console.log('  ' + soort.padEnd(10) + waarde.toFixed(2).padStart(6) + '%   vloer ' +
        String(vloer).padStart(3) + '   ' + merk);
    }
    console.log('');
  }

  const gezakt = ['regels', 'takken', 'functies'].filter(s => uitslag[s] + 1e-9 < VLOER[s]);
  if (gezakt.length) {
    console.error('DEKKING GEZAKT op: ' + gezakt.map(s => s + ' ' + uitslag[s].toFixed(2) + '% < ' + VLOER[s] + '%').join(', '));
    process.exit(1);
  }
  if (!jsonUit) console.log('De dekking haalt elke vloer.');
}

module.exports = { VLOER, meet, voegSamen, tel, lcovBestanden };
