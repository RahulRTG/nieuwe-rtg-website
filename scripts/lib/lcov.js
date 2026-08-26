'use strict';

/* LCOV LEZEN EN SAMENVOEGEN -- het rekenwerk onder scripts/dekkingsvloer.js.

   Dit staat apart van de vloer omdat het twee dingen zijn: hier wordt GEMETEN,
   daar wordt GEOORDEELD. Zo kan test/delen.test.js de samenvoeging toetsen
   zonder een vloer aan te roepen, en blijft geen van beide bestanden tegen de
   10 kB-grens van de keuring aan groeien.

   Wat er te weten valt over de meting zelf staat bij de functies hieronder; de
   vloeren en de metingen waarop ze staan, staan in scripts/dekkingsvloer.js. */

const fs = require('fs');
const path = require('path');

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

module.exports = { lcovBestanden, voegSamen, tel, meet };
