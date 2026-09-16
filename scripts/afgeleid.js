#!/usr/bin/env node
'use strict';
/* ============================================================================
   WIE MAG DIT ARTEFACT OPNIEUW AFLEIDEN?

   HET CONTRACT: elk artefact dat repo-waarheid claimt en niet door een mens is
   geschreven, heeft PRECIES EEN machinaal vindbare generator-eigenaar.

   DE AANLEIDING IS EEN GEMETEN GETAL EN GEEN GEVOEL. Bij de samenvoeging met
   main van 15 september 2026 waren er 19 conflicten: 1 in de bron en 18 in
   afgeleide artefacten. Alle 18 zijn opnieuw AFGELEID -- ik koos per stuk de
   opdracht met de hand -- maar machinaal aanwijsbaar waren er destijds 8. Het
   huis kon het artefact dus wel produceren en niet bewijzen wie bevoegd was het
   te produceren. Dat verschil is de hele reden dat dit bestand bestaat.

   ==== VIJF STANDEN, EN ONBESLIST IS ER EEN VAN ====

     BRON          door een mens of een externe waarheid geschreven. Geen
                   generator vereist; wie er een verwacht, zoekt iets dat er
                   niet hoort te zijn.
     AFGELEID      volledig reproduceerbaar uit andere waarheid. Precies EEN
                   eigenaar, en die moet bestaan en aantoonbaar schrijven.
     FRAGMENTEN    een BRON-document waarin een generator alleen afgebakende
                   stukken herschrijft. `scripts/getallen.js` doet dat tussen
                   `<!--getal:...-->` merktekens in CLAUDE.md en MACHINE.md.
                   Dit is NIET afgeleid: het document in zijn geheel regenereren
                   bestaat niet. Het is ook niet gewoon BRON: de fragmenten
                   horen nooit met de hand te worden samengevoegd.
     MOMENTOPNAME  afgeleid, maar bewust gebonden aan EEN ronde, commit of
                   tijdstip. Opnieuw draaien geeft terecht een andere uitslag,
                   dus "loopt achter" is er geen zinnig oordeel over.
     ONBESLIST     niemand heeft het gezegd en er is geen signaal. Met opzet een
                   eigen stand: wie hem stil als BRON leest, verliest een
                   artefact waarvan de generator is verdwenen; wie hem stil als
                   AFGELEID leest, eist een eigenaar voor een handgeschreven
                   document. Deze stand is de schuld die hoort te dalen.

   ==== DE VERKLARINGEN LAGEN ER AL, OP DRIE PLEKKEN ====

   Dit register voegt GEEN vierde lijst toe. Hij leidt af uit wat er al is:

     scripts/lib/registereigenaar.js  EIGENAAR (verklaard) + detecteer() (gemeten)
     scripts/versheid.js              per register de opdracht die hem schrijft
     het artefact zelf                draagt het `<!--getal:`-merktekens?

   Die drie spraken elkaar bij het bouwen op EEN plek tegen (OUTPUTPROEF.json,
   twee schrijvers), en die stond al als onverklaarde botsing genoteerd.

   ==== WAT ER AAN DE DETECTOR IS GEREPAREERD, EN WAAROM DAT TELT ====

   `detecteer()` ging van 99 naar 159 gevonden schrijvers zonder dat er een
   verklaring bij kwam. Drie fouten, en alle drie lieten een BESTAANDE generator
   onzichtbaar:

     1. de constante moest in HOOFDLETTERS staan (scripts/capabilities.js
        schrijft naar `doel`);
     2. het eerste argument werd op de eerste KOMMA afgekapt, en die staat bij
        `writeFileSync(path.join(WORTEL, 'X.json'), ...)` binnen het argument --
        vier generatoren vielen daardoor volledig buiten beeld;
     3. het bereik was alleen `.json`, terwijl ARCHITECTUUR.md, BEWIJS.md en
        FUNCTIES.md net zo goed worden gegenereerd.

   Daarmee ging de dekking op de 18 conflicten van 8 naar 16. De twee die
   overbleven zijn CLAUDE.md en MACHINE.md, en dat zijn precies de FRAGMENTEN.

   ==== ACHT EIGENSCHAPPEN, EN WIE ZE HANDHAAFT ====

   test/afgeleid.test.js, met per toets welke:

     1 precies EEN canonieke eigenaar per AFGELEID artefact
     2 die eigenaar bestaat als bestand
     3 hij schrijft aantoonbaar dat artefact (gemeten), of de verklaring zegt
       waarom dat niet te meten is
     4 een verdwenen of hernoemde generator laat de toets zakken (volgt uit 2)
     5 dubbele eigenaars zakken, tenzij ze in ONVERKLAARDE_BOTSING staan
     6 een nieuw AFGELEID wortelartefact zonder eigenaar zakt (ratel op nul)
     7 waar repo-waarheid ontstaat, is de grendelregel EXPLICIET: de eigenaar
       roept eisSchoneBoom() aan, of de verklaring zegt waarom niet
     8 de verklaring komt uit een begrensde, toetsbare vorm (het EIGENAAR-object)
       en nooit uit een vrije commentaarconventie

   Eigenschap 7 is met opzet GEMETEN en niet geeist. BEWIJSMACHINE.md par. 6a.2
   heeft dat besluit openstaan: van de generatoren die stempelen grendelt een
   minderheid, en een deel hoort dat juist niet te doen. Dit register levert het
   getal waarop dat besluit genomen kan worden; hij neemt het niet.

   Draaien:  npm run afgeleid        (print)
             npm run afgeleid:vast   (schrijft AFGELEID.json)
   ============================================================================ */
const fs = require('fs');
const path = require('path');
const { zonderCommentaar } = require('./lib/bron');
const { stempel, eisSchoneBoom } = require('./lib/stempel');
const { EIGENAAR, ONVERKLAARDE_BOTSING, detecteer } = require('./lib/registereigenaar');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'AFGELEID.json');
const vastleggen = process.argv.includes('--vastleggen');

/* Het bereik: wortelartefacten die waarheid kunnen claimen. `package*.json` is
   van npm en geen bewering van dit huis. */
function artefacten() {
  return fs.readdirSync(WORTEL)
    .filter(f => (f.endsWith('.json') || f.endsWith('.md')) && !f.startsWith('package'))
    .sort();
}

/* DE TWEEDE VERKLARING, DIE AL BESTOND. scripts/versheid.js draagt per register
   de opdracht die hem schrijft -- functioneel een eigenaarsverklaring onder een
   ander doel. Hij wordt hier GELEZEN en niet overgetypt; twee lijsten van
   dezelfde waarheid lopen uit elkaar (LAT.md regel 4). */
function versheidslijst() {
  const bron = zonderCommentaar(fs.readFileSync(path.join(WORTEL, 'scripts/versheid.js'), 'utf8'),
    { regelsHeel: true });
  const uit = new Map();
  for (const m of bron.matchAll(/\[\s*'([A-Z][A-Z0-9_.-]*\.(?:json|md))'\s*,\s*'([^']+)'/g)) uit.set(m[1], m[2]);
  return uit;
}

/* Van een opdracht (`npm run x:vast`, `node scripts/x.js --vastleggen`) naar het
   scriptbestand. Vindt hij het niet, dan is dat GEEN eigenaar -- liever geen
   antwoord dan een geraden antwoord. */
function scriptVanOpdracht(cmd) {
  const direct = String(cmd).match(/scripts\/[\w.-]+\.js/);
  if (direct && fs.existsSync(path.join(WORTEL, direct[0]))) return direct[0];
  const npm = String(cmd).match(/npm run ([\w:-]+)/);
  if (!npm) return null;
  let scripts;
  try { scripts = JSON.parse(fs.readFileSync(path.join(WORTEL, 'package.json'), 'utf8')).scripts || {}; }
  catch (e) { return null; }
  const regel = scripts[npm[1]];
  if (!regel) return null;
  const s = String(regel).match(/scripts\/[\w.-]+\.js/);
  return s && fs.existsSync(path.join(WORTEL, s[0])) ? s[0] : null;
}

/* WIE BEZIT DE MERKTEKENS? Niet aangewezen maar GEVONDEN: het script dat de
   merkteken-conventie kent is per definitie de enige die de fragmenten mag
   herschrijven. Zijn het er nul of meer dan een, dan is er geen eigenaar en
   staat dat er zo -- een geraden eigenaar is erger dan geen.

   Dit is de reden dat FRAGMENTEN een eigen stand is en geen AFGELEID: het
   DOCUMENT regenereren bestaat niet, alleen de stukken tussen de merktekens.
   Wie deze klasse als AFGELEID zou lezen, zou bij een conflict CLAUDE.md willen
   overschrijven met de uitvoer van een generator die het document niet kent. */
const MERKTEKEN = '<!--getal:';
function merktekeneigenaar() {
  /* EEN DETECTOR TELT ZICHZELF NOOIT MEE. Dit bestand bevat de merkteken-string
     omdat het ernaar zoekt, dus de eerste versie vond TWEE kandidaten en gaf
     terecht op -- waarna alle zeventien fragmenten als "geen eigenaar" in de
     uitslag stonden. Derde verschijningsvorm van dezelfde fout in twee dagen:
     de stillezingmeter las zijn eigen registernaam, registereigenaar.js las zijn
     eigen toelichting, en dit leest zijn eigen zoekterm. Commentaar scheiden
     helpt hier niet, want de string staat in de CODE; wat helpt is de regel dat
     het instrument geen onderwerp van zijn eigen meting is. */
  const zelf = path.basename(__filename);
  const kandidaten = fs.readdirSync(path.join(WORTEL, 'scripts'))
    .filter(n => n.endsWith('.js') && n !== zelf)
    .filter(n => {
      try {
        return fs.readFileSync(path.join(WORTEL, 'scripts', n), 'utf8').includes(MERKTEKEN);
      } catch (e) { return false; }
    });
  return kandidaten.length === 1 ? 'scripts/' + kandidaten[0] : null;
}

/* Draagt dit artefact merktekens die een generator per stuk herschrijft? */
function heeftFragmenten(naam) {
  if (!naam.endsWith('.md')) return false;
  try { return fs.readFileSync(path.join(WORTEL, naam), 'utf8').includes(MERKTEKEN); }
  catch (e) { return false; }
}

/* Grendelt deze generator op een schone boom? Gemeten, niet geeist -- zie de kop. */
function grendelt(script) {
  if (!script) return null;
  try {
    const code = zonderCommentaar(fs.readFileSync(path.join(WORTEL, script), 'utf8'), { regelsHeel: true });
    return /\beisSchoneBoom\s*\(/.test(code);
  } catch (e) { return null; }
}

function meet() {
  const gemeten = detecteer();
  const versheid = versheidslijst();
  const fragmentbaas = merktekeneigenaar();
  const rijen = [];

  for (const naam of artefacten()) {
    const verklaard = EIGENAAR[naam] || null;
    const schrijvers = [...(gemeten.get(naam) || [])];
    const uitVersheid = versheid.has(naam) ? scriptVanOpdracht(versheid.get(naam)) : null;

    let soort, eigenaar = null, graad = null;

    if (verklaard && verklaard.soort) soort = verklaard.soort;
    else if (verklaard && verklaard.handmatig) soort = 'BRON';
    else if (verklaard && verklaard.schrijver) soort = 'AFGELEID';
    else if (schrijvers.length || uitVersheid) soort = 'AFGELEID';
    else if (heeftFragmenten(naam)) soort = 'FRAGMENTEN';
    else soort = 'ONBESLIST';

    if (soort === 'AFGELEID' || soort === 'MOMENTOPNAME' || soort === 'FRAGMENTEN') {
      if (verklaard && verklaard.schrijver) { eigenaar = verklaard.schrijver; graad = 'verklaard'; }
      else if (schrijvers.length === 1) { eigenaar = schrijvers[0]; graad = 'gemeten'; }
      /* DE VERSHEIDSOPDRACHT IS PAS BEWIJS ALS ER NIETS GEMETEN IS, en die
         volgorde is een reparatie. Hier stond versheid VOOR de meervoudige
         schrijvers, en dat koos stilletjes een winnaar: OUTPUTPROEF.json heeft
         twee gemeten schrijvers (outputband en outputproef) en zijn
         versheidsopdracht is `npm run meetronde -- --alleen=outputproef`. Dat
         leverde scripts/meetronde.js op -- een DERDE script, de orkestrator, die
         het bestand helemaal niet schrijft. Een opdrachtregel noemt een INGANG
         en niet noodzakelijk de schrijver, dus hij mag nooit een botsing
         beslechten. */
      else if (schrijvers.length > 1) { eigenaar = null; graad = 'meerdere'; }
      else if (uitVersheid) { eigenaar = uitVersheid; graad = 'versheid'; }
      /* De fragmenteigenaar wordt pas gebruikt als er niets specifiekers is:
         een document dat ZELF wordt gegenereerd en daarnaast merktekens draagt,
         hoort bij zijn eigen generator te staan. */
      if (!eigenaar && soort === 'FRAGMENTEN' && fragmentbaas) { eigenaar = fragmentbaas; graad = 'merkteken'; }
    }

    rijen.push({
      naam, soort, eigenaar, graad,
      schrijvers,
      versheidOpdracht: versheid.get(naam) || null,
      grendelt: grendelt(eigenaar),
      botsingVerklaard: Object.prototype.hasOwnProperty.call(ONVERKLAARDE_BOTSING, naam) ? false
        : (schrijvers.length > 1 ? Boolean(verklaard && verklaard.waarom) : null)
    });
  }
  return rijen;
}

function samenvatting(rijen) {
  const per = (s) => rijen.filter(r => r.soort === s);
  const afgeleid = per('AFGELEID');
  return {
    artefacten: rijen.length,
    bron: per('BRON').length,
    afgeleid: afgeleid.length,
    fragmenten: per('FRAGMENTEN').length,
    momentopname: per('MOMENTOPNAME').length,
    onbeslist: per('ONBESLIST').length,
    afgeleidZonderEigenaar: afgeleid.filter(r => !r.eigenaar).length,
    /* Alles wat een eigenaar HOORT te hebben en er een heeft. Dit getal mag
       alleen stijgen: het is de dekking van het contract, en zonder hem is een
       dalende `onbeslist` niet te onderscheiden van een krimpend bereik. */
    metEigenaar: rijen.filter(r => ['AFGELEID', 'FRAGMENTEN', 'MOMENTOPNAME'].includes(r.soort) && r.eigenaar).length,
    afgeleidEigenaarGemeten: afgeleid.filter(r => r.graad === 'gemeten' || r.graad === 'verklaard').length,
    afgeleidGrendelt: afgeleid.filter(r => r.grendelt === true).length
  };
}

function main() {
  const rijen = meet();
  const g = samenvatting(rijen);
  const K = { rood: '\x1b[31m', groen: '\x1b[32m', grijs: '\x1b[2m', vet: '\x1b[1m', reset: '\x1b[0m' };

  console.log('\n' + K.vet + 'WIE MAG DIT ARTEFACT OPNIEUW AFLEIDEN?' + K.reset +
    K.grijs + '  -- ' + g.artefacten + ' wortelartefacten' + K.reset + '\n');
  console.log('  BRON          ' + String(g.bron).padStart(4) + K.grijs + '  door een mens geschreven; geen generator vereist' + K.reset);
  console.log('  AFGELEID      ' + String(g.afgeleid).padStart(4) + K.grijs + '  reproduceerbaar; precies EEN eigenaar vereist' + K.reset);
  console.log('  FRAGMENTEN    ' + String(g.fragmenten).padStart(4) + K.grijs + '  bron met afgebakende gegenereerde stukken' + K.reset);
  console.log('  MOMENTOPNAME  ' + String(g.momentopname).padStart(4) + K.grijs + '  gebonden aan een ronde; hermeten geeft terecht iets anders' + K.reset);
  console.log('  ONBESLIST     ' + String(g.onbeslist).padStart(4) + K.grijs + '  niemand heeft het gezegd -- de schuld die hoort te dalen' + K.reset + '\n');
  console.log('  van de AFGELEIDE artefacten:');
  console.log('    ' + (g.afgeleidZonderEigenaar ? K.rood : K.groen) + 'zonder eigenaar        ' +
    String(g.afgeleidZonderEigenaar).padStart(4) + K.reset);
  console.log('    eigenaar gemeten of verklaard ' + String(g.afgeleidEigenaarGemeten).padStart(4));
  console.log('    grendelt op een schone boom   ' + String(g.afgeleidGrendelt).padStart(4) +
    K.grijs + '  (gemeten, niet geeist -- BEWIJSMACHINE.md par. 6a.2)' + K.reset + '\n');

  const zonder = rijen.filter(r => r.soort === 'AFGELEID' && !r.eigenaar);
  if (zonder.length) {
    console.log(K.rood + '  AFGELEID ZONDER CANONIEKE EIGENAAR:' + K.reset);
    for (const r of zonder) console.log('    ' + r.naam.padEnd(30) + (r.schrijvers.join(', ') || 'geen schrijver gevonden'));
    console.log('');
  }
  const onbeslist = rijen.filter(r => r.soort === 'ONBESLIST');
  console.log(K.grijs + '  De eerste tien ONBESLIST (triage, geen foutenlijst):' + K.reset);
  for (const r of onbeslist.slice(0, 10)) console.log('    ' + r.naam);
  console.log('');

  if (vastleggen) {
    eisSchoneBoom();
    fs.writeFileSync(DOEL, JSON.stringify({
      soort: 'meting',
      uitleg: 'Per wortelartefact: is het BRON, AFGELEID, FRAGMENTEN, MOMENTOPNAME of ONBESLIST, en ' +
        'wie is de enige generator die het opnieuw mag afleiden. Afgeleid uit de drie verklaringen die ' +
        'al bestonden (EIGENAAR en detecteer() in scripts/lib/registereigenaar.js, en de opdrachtenlijst ' +
        'in scripts/versheid.js) plus het artefact zelf. Geen vierde lijst.',
      grens: 'De detectie is een ONDERGRENS: een generator die zijn pad over meerdere regels opbouwt of ' +
        'via een helper schrijft, valt erbuiten. Daarom is de VERKLARING leidend en de meting de controle ' +
        'erop. `afgeleidZonderEigenaar` hoort nul te zijn en `onbeslist` hoort te dalen doordat er ' +
        'verklaringen bijkomen -- nooit doordat het bereik krimpt.',
      stempel: stempel(),
      gemeten: g,
      artefacten: rijen
    }, null, 1) + '\n');
    console.log('  AFGELEID.json geschreven.\n');
  } else {
    console.log(K.grijs + '  (niets weggeschreven -- draai met --vastleggen)' + K.reset + '\n');
  }
}

if (require.main === module) main();
module.exports = { meet, samenvatting, artefacten, scriptVanOpdracht };
