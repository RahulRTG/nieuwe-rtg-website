#!/usr/bin/env node
/* ============================================================================
   DE TAALKWALITEIT -- wat weten we werkelijk over 113 vertalingen?

   Dit is met opzet geen cijfer. "114 talen" is een BELOFTE, en een belofte
   zonder meting is een risico -- dat staat al in kern/taaldekking.js. Deze
   meter zegt per taal wat er is VASTGESTELD, in de vier bewijsgraden van
   BESTUUR.md, en zegt er even hard bij wat er niet is vastgesteld.

   DE SCHEIDSLIJN DIE ALLES DRAAGT. Er zijn twee heel verschillende vragen:

     1. STAAT HET ER GOED?   Is dit het schrift van deze taal, staan de
                             plaatshouders er nog, klopt het bedrag, is de
                             merknaam heel gebleven. Machinaal vast te stellen.
     2. ZEGT HET HET GOEDE?  Klopt het woord, de vorm, de aanspreektoon, de
                             betekenis. NIET machinaal vast te stellen -- en
                             deze meter doet daar dan ook geen enkele uitspraak
                             over. Daar is een mens voor nodig die de taal
                             spreekt, en die weg staat in TAALOORDEEL.json.

   Wie deze twee door elkaar haalt, leest "113 talen gemeten" en denkt dat het
   Tigrinya klopt. Dat is precies de fout die dit bestand moet voorkomen, en
   daarom draagt elke rij een `betekenis`-veld dat vandaag voor ELKE taal
   `ongemeten` zegt.

   DE GRADEN, en waarom er geen "waarschijnlijk goed" tussen zit:

     bewezen   een mens die de taal spreekt heeft geoordeeld (TAALOORDEEL.json).
     gemeten   het schrift is geverifieerd EN beslissend: een antwoord in de
               verkeerde taal wordt aantoonbaar tegengehouden.
     vermoed   het schrift is geverifieerd maar niet beslissend. Frans en Engels
               delen hun letters, dus deze controle sluit niets uit.
     onbekend  er is niets vastgesteld.

   Gebruik:  npm run taalkwaliteit          schrijft TAALKWALITEIT.json
             npm run taalkwaliteit -- --toon   ook een leesbare samenvatting
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const { TALEN, BASIS } = require('../server/talen');
const schrift = require('../server/taalschrift');
const { KERN, dictVan, TALEN_MET_KERN } = require('../server/translate/woordenboek/wereld');
const { keur } = require('../server/kern/taalkeuring');
const { stempel } = require('./lib/stempel');

/* Het oordeel van een mens die de taal spreekt. Vandaag leeg, en dat staat er
   zo in -- een leeg register is een eerlijke nul en geen ontbrekend bestand. */
function sprekerOordelen() {
  try { return JSON.parse(fs.readFileSync(path.join(WORTEL, 'TAALOORDEEL.json'), 'utf8')); }
  catch (e) { return { oordelen: [] }; }
}

/* `bron` is er voor de IJKING en niet voor de app, precies zoals in
   kern/taaldekking.js. De echte tabel heeft geen gaten, dus een meter die op de
   echte tabel "geen fout gevonden" zegt, kan nooit uitslaan -- en een meter die
   je niet hebt zien uitslaan, meet niets (LAT-regel 10). Met een opzettelijk
   kapotte tabel, een keuring die alles goedkeurt of een register met sprekers
   erin is elk van de drie getallen te beproeven. */
function meet(bron) {
  const b = bron || {};
  const TALEN_B = b.talen || TALEN;
  const keurB = b.keur || keur;
  const dictB = b.dictVan || dictVan;
  const metKern = b.talenMetKern || TALEN_MET_KERN;
  const sprekers = b.sprekers || sprekerOordelen();
  const perTaal = new Map();
  for (const o of (sprekers.oordelen || [])) {
    if (!o || !o.taal) continue;
    const lijst = perTaal.get(o.taal) || [];
    lijst.push(o);
    perTaal.set(o.taal, lijst);
  }

  const rijen = TALEN_B.map((t) => {
    const code = t.code;
    const schriften = schrift.schriftenVan(code) || [];
    const beslissend = schrift.beslissend(code);
    const d = metKern.includes(code) ? dictB(code) : null;

    /* De kernrij, cel voor cel. `gelijkAanBron` is geen fout -- Afrikaans "les"
       is werkelijk "les" -- maar het wordt geteld en met naam genoemd, zodat
       niemand hoeft te raden of daar een vergeten cel tussen zit. */
    let gevuld = 0; const leeg = [], gelijkAanBron = [], verkeerdSchrift = [];
    if (d) {
      for (const nl of KERN) {
        const w = d[nl];
        if (!w || !String(w).trim()) { leeg.push(nl); continue; }
        gevuld++;
        if (String(w).trim().toLowerCase() === nl.toLowerCase()) gelijkAanBron.push(nl);
        if (schrift.heeftLetters(w) && !schrift.draagtSchrift(w, code)) verkeerdSchrift.push(nl + '=' + w);
      }
    }

    const menselijk = perTaal.get(code) || [];
    const graad = menselijk.length ? 'bewezen'
      : !d ? 'onbekend'
        : (beslissend && gevuld === KERN.length && !verkeerdSchrift.length) ? 'gemeten'
          : 'vermoed';

    return {
      code, naam: t.naam, en: t.en,
      basistaal: BASIS.includes(code),
      schriften, schriftBeslissend: beslissend,
      kernrij: !!d, kernGevuld: gevuld, kernTotaal: KERN.length,
      leeg, gelijkAanBron, verkeerdSchrift,
      menselijkOordeel: menselijk.length,
      /* Deze twee staan met opzet naast elkaar en worden nooit opgeteld. */
      vorm: graad,
      betekenis: menselijk.length ? 'beoordeeld door een spreker' : 'ongemeten'
    };
  });

  /* De poort zelf: welke faalvormen houdt hij aantoonbaar tegen? Gemeten en
     niet opgesomd -- als iemand een controle uitzet, daalt dit getal. */
  const proeven = [
    ['verkeerd-schrift', 'Boek deze reis', 'Book this trip', 'ja'],
    ['plaatshouder-weg', 'Hallo {naam}', 'こんにちは', 'ja'],
    ['getal-weg', 'Betaal EUR 65', 'EUR 95 をお支払い', 'ja'],
    ['merk-vertaald', 'Welkom bij Rahul Travel Group', 'ラフル旅行団体へようこそ', 'ja'],
    ['weigering', 'Reserveer een tafel', 'I cannot help with that request.', 'fr'],
    ['onvertaald', 'Opslaan', 'Opslaan', 'ja'],
    ['leeg', 'Opslaan', '', 'ja']
  ];
  const poort = proeven.map(([code, bronTekst, vert, naar]) => {
    const r = keurB(bronTekst, vert, naar);
    return { faalvorm: code, tegengehouden: r.oordeel === 'afgewezen', oordeel: r.oordeel };
  });

  const tel = (g) => rijen.filter(r => r.vorm === g).length;
  return {
    uitleg: 'Per taal wat er over de VORM van een vertaling is vastgesteld. Over de BETEKENIS doet deze meter geen uitspraak; daarvoor is een spreker nodig.',
    grens: 'Schriftcontrole sluit alleen iets uit bij een taal die het Latijnse schrift niet aanvaardt. Voor de overige talen zegt een groene rij niet dat er geen Engels doorheen kan.',
    talen: rijen.length,
    metKernrij: rijen.filter(r => r.kernrij).length,
    graden: { bewezen: tel('bewezen'), gemeten: tel('gemeten'), vermoed: tel('vermoed'), onbekend: tel('onbekend') },
    betekenisOngemeten: rijen.filter(r => r.betekenis === 'ongemeten').length,
    schriftBeslissend: rijen.filter(r => r.schriftBeslissend).length,
    cellenVerkeerdSchrift: rijen.reduce((n, r) => n + r.verkeerdSchrift.length, 0),
    cellenGelijkAanBron: rijen.reduce((n, r) => n + r.gelijkAanBron.length, 0),
    cellenLeeg: rijen.reduce((n, r) => n + r.leeg.length, 0),
    poort,
    poortHoudtTegen: poort.filter(p => p.tegengehouden).length,
    rijen
  };
}

function toon(m) {
  console.log('\nDE TAALKWALITEIT\n');
  console.log('  ' + m.talen + ' talen, ' + m.metKernrij + ' met een kernrij');
  console.log('  vorm:      bewezen ' + m.graden.bewezen + ' | gemeten ' + m.graden.gemeten +
    ' | vermoed ' + m.graden.vermoed + ' | onbekend ' + m.graden.onbekend);
  console.log('  betekenis: ONGEMETEN voor ' + m.betekenisOngemeten + ' van de ' + m.talen + ' talen');
  console.log('  cellen:    ' + m.cellenVerkeerdSchrift + ' in het verkeerde schrift, ' +
    m.cellenLeeg + ' leeg, ' + m.cellenGelijkAanBron + ' gelijk aan de bron (niet per se fout)');
  console.log('\n  de poort houdt ' + m.poortHoudtTegen + ' van de ' + m.poort.length + ' beproefde faalvormen tegen:');
  for (const p of m.poort) console.log('    ' + (p.tegengehouden ? '✓' : '✗') + ' ' + p.faalvorm + '  (' + p.oordeel + ')');
  console.log('\n  ' + m.grens + '\n');
}

if (require.main === module) {
  const m = meet();
  /* HET STEMPEL STAAT HIER EN NIET IN meet(). Een register zonder tijdstempel is
     niet na te lopen: verouderd ziet er identiek uit aan vers, en dan worden de
     getallen geloofd (scripts/lib/stempel.js legt uit welke vier fouten daaruit
     zijn voortgekomen). Maar meet() krijgt bij het ijken een verzonnen bron mee
     en draait dan zonder een meetronde te zijn -- zo'n uitslag mag geen stempel
     dragen, want dat is precies de stilte die dit veld moet doorbreken. Een
     stempel hoort dus bij het WEGSCHRIJVEN en niet bij het rekenen. */
  const uit = Object.assign({ stempel: stempel(), hoe: 'npm run taalkwaliteit' }, m);
  fs.writeFileSync(path.join(WORTEL, 'TAALKWALITEIT.json'), JSON.stringify(uit, null, 2) + '\n');
  if (process.argv.includes('--toon')) toon(m);
  else console.log('TAALKWALITEIT.json geschreven: ' + m.talen + ' talen, betekenis ongemeten voor ' + m.betekenisOngemeten + '.');
}

module.exports = { meet };
