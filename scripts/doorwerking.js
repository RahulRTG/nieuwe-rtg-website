#!/usr/bin/env node
/* ============================================================================
   DE DOORWERKINGSMETER -- werkt een gegeven dat één keer is opgegeven, door?

   MAATSTAF.md U10 zegt: "vraag een gegeven maar één keer, en hergebruik alleen
   met DOEL, TOESTEMMING, BRON en ACTUALITEIT." De tabel noemde die doorwerking
   "niet gebouwd en niet gemeten". De helft daarvan was mis: zij IS gebouwd. Het
   zorgprofiel (allergenen, dieet, medische aandachtspunten) staat op één plek
   (db.data.zorgProfielen, kern/gastzorg.js) en reist mee naar bestellingen,
   ritten, tickets, bezorging, charter, autohuur, uitjes en de reisplanner.

   Wat er niet was, is de meting -- en die legt twee gaten bloot die je zonder
   meting niet ziet, omdat elk afzonderlijk call-punt er redelijk uitziet:

     NAAMLOOS   de lezer geeft geen zaak mee, dus er komt geen regel in het
                inzagejournaal. Het lid ziet nooit welke zaak zijn allergieën
                heeft gelezen -- precies het gat dat de kop van gastzorg.js
                zegt te hebben gedicht.

     BEVROREN   de lezer schrijft het profiel als KOPIE in een bestelling of
                reservering. Trekt het lid morgen zijn toestemming in, of haalt
                hij een allergie weg, dan blijft de kopie staan. Toestemming die
                niet terugwerkt is geen toestemming, en een allergie die
                verandert is precies het geval waarvoor dit veld bestaat.

   DEZE METER OORDEELT NIET OVER DE INHOUD. Hij leest de call-punten van
   zorgVoor/zorgMee in server/ en zegt per punt: noemt hij een zaak, en belandt
   het antwoord in opgeslagen data. Een lezer die het profiel aan het LID ZELF
   toont hoeft geen zaak te noemen (je eigen profiel lezen is geen inzage) --
   dat onderscheid staat in EIGEN hieronder, met de reden per plek.

   Draai: npm run doorwerking   (vastleggen: npm run doorwerking:vast)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const WORTEL = path.join(__dirname, '..');
const BRON = ['server/kern/gastzorg.js', 'server/kern/gastzorg-profiel.js'];

/* Lezers die het profiel aan het LID ZELF laten zien of er alleen een zin over
   schrijven. Geen inzage, dus geen zaak nodig. Wie hier iets bijzet, zegt
   waarom -- anders wordt deze lijst de plek waar een gat wordt weggeschreven. */
const EIGEN = {
  'server/kern/avond/voorkeuren.js': 'toont de eigen stand ("deelt u mee?") aan het lid zelf',
  'server/kern/fluister/reis/kleding.js': 'schrijft één zin in het antwoord AAN het lid',
  'server/kern/fluister/reis/reisplan.js': 'schrijft één zin in het antwoord AAN het lid',
  'server/kern/lidacties/bestellen.js': 'vergelijkt de eigen allergenen met de bestelling om het lid te waarschuwen',
  'server/kern/fluister/bevestig.js': 'de zorgVoor-lezing schrijft een zin AAN het lid (de kopie verderop loopt via zorgMee en telt gewoon mee)'
};

function bestanden(map, uit = []) {
  for (const naam of fs.readdirSync(map)) {
    const p = path.join(map, naam);
    const st = fs.statSync(p);
    if (st.isDirectory()) { if (naam !== 'node_modules' && naam !== 'data') bestanden(p, uit); continue; }
    if (naam.endsWith('.js')) uit.push(p);
  }
  return uit;
}

function meet() {
  const punten = [];
  for (const p of bestanden(path.join(WORTEL, 'server'))) {
    const rel = path.relative(WORTEL, p).split(path.sep).join('/');
    if (BRON.includes(rel)) continue;
    const tekst = fs.readFileSync(p, 'utf8');
    const regels = tekst.split('\n');
    regels.forEach((regel, i) => {
      const m = regel.match(/\bzorg(Voor|Mee)\s*\(([^)]*)\)/);
      if (!m) return;
      const argumenten = m[2];
      /* Een tweede argument dat een zaak noemt, is de enige vorm die een regel
         in het journaal oplevert (zie noteerInzage in gastzorg.js). */
      const benoemd = /zaak\s*:/.test(argumenten) || /\bdoor\b/.test(argumenten);
      /* Belandt het antwoord in data die wordt bewaard? Twee vormen komen voor:
         `zorg: zorgVoor(...)` in een record dat wordt opgeslagen, en
         `x.zorg = z; save()`. De tweede staat een paar regels verderop. */
      const inRecord = /^\s*zorg\s*:/.test(regel);
      const omheen = regels.slice(i, i + 3).join('\n');
      const bewaard = inRecord || /\.zorg\s*=/.test(omheen);
      /* Een kopie die via zorgMee loopt, draagt `op` en `bron` -- dan kan een
         lezer met zorgActueel() zien dat hij naar iets ouds kijkt. Een kopie
         zonder stempel kan dat niet en is dus echt bevroren. */
      const gestempeld = m[1] === 'Mee';
      punten.push({ plek: rel, regel: i + 1, benoemd, bewaard, gestempeld,
        /* EIGEN geldt per BESTAND maar nooit voor zorgMee: die functie bestaat
           alleen om aan een derde te geven, dus een bestand dat ook een eigen
           lezing doet, verbergt daarmee zijn kopie niet. */
        eigen: !!EIGEN[rel] && m[1] === 'Voor', waarom: EIGEN[rel] || null, code: regel.trim().slice(0, 120) });
    });
  }
  const derde = punten.filter(p => !p.eigen);
  const naamloos = derde.filter(p => !p.benoemd);
  const kopieen = derde.filter(p => p.bewaard);
  const bevroren = kopieen.filter(p => !p.gestempeld);
  return {
    bron: BRON,
    telling: {
      punten: punten.length, eigen: punten.length - derde.length, derde: derde.length,
      benoemd: derde.length - naamloos.length, naamloos: naamloos.length,
      kopieen: kopieen.length, gestempeld: kopieen.length - bevroren.length, bevroren: bevroren.length
    },
    naamloos: naamloos.map(p => p.plek + ':' + p.regel),
    bevroren: bevroren.map(p => p.plek + ':' + p.regel),
    gestempeld: kopieen.filter(p => p.gestempeld).map(p => p.plek + ':' + p.regel),
    punten,
    /* Wat deze meter NIET ziet, en dat hoort er even groot bij te staan. */
    nietGemeten: [
      'of een zaak het profiel dat zij ontving ook werkelijk gebruikt',
      'kopieën die al in de database staan van vóór een reparatie',
      'gegevens buiten het zorgprofiel: dit is één doorwerking, niet alle'
    ]
  };
}

if (require.main === module) {
  const u = meet();
  const vast = process.argv.includes('--vastleggen');
  console.log('DOORWERKING -- ' + u.bron.join(' + '));
  console.log('  call-punten      ' + u.telling.punten + ' (eigen ' + u.telling.eigen + ', naar een derde ' + u.telling.derde + ')');
  console.log('  benoemd          ' + u.telling.benoemd + '  (zaak in het journaal)');
  console.log('  NAAMLOOS         ' + u.telling.naamloos + '  (het lid ziet nooit wie er keek)');
  console.log('  kopieen          ' + u.telling.kopieen + '  (waarvan gestempeld ' + u.telling.gestempeld + ')');
  console.log('  BEVROREN         ' + u.telling.bevroren + '  (kopie zonder stempel; niemand kan zien dat hij oud is)');
  for (const r of u.naamloos) console.log('    naamloos  ' + r);
  for (const r of u.bevroren) console.log('    bevroren  ' + r);
  if (vast) {
    fs.writeFileSync(path.join(WORTEL, 'DOORWERKING.json'), JSON.stringify(u, null, 2) + '\n');
    console.log('DOORWERKING.json geschreven.');
  }
}
module.exports = { meet, EIGEN, BRON };
