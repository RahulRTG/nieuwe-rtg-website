/* WELKE TREDE PAST HIER OP, EN WAT WEET JE ECHT? -- het rekenwerk onder het
   voorstel.

   ../voorstel.js gaat over de OMGANG met een voorstel: bevestigen (met een naam),
   lijsten, tellen. Dit bestand doet de weging, en dat is een ander onderwerp:
   hier zit geen enkele knop en geen enkele naam, alleen de vraag welke trede
   dekt wat een zaak aantoonbaar doet.

   DE TWEE SOORTEN NUL, EN HET VERSCHIL IS ALLES.

     0 uit "gemeten en niet gebruikt"   -> mag meewegen om iets in te trekken
     0 uit "er is niet naar gekeken"    -> mag dat NOOIT

   Ze zien er in een telling precies hetzelfde uit. Daarom is `gemeten` een
   APARTE lijst en geen afgeleide van `gebruik`: wat er niet in staat en wat de
   zaak nu wel heeft, telt als NODIG. Conservatief, en het kost hoogstens een
   voorstel dat niet komt -- de andere kant kost een zaak haar governance.

   EN DE DREMPEL SCHEIDT BEDRIJFSVOERING VAN EEN PROEFRIJ. Een enkele rij is geen
   bedrijfsvoering maar wel een aanwijzing: hij telt niet mee in wat de trede moet
   dekken, en wel in de zekerheid. Zo verdwijnt hij niet stil onder de drempel. */
'use strict';

const ladder = require('../../pasladder');
const caps = require('../capaciteiten');
const { TERUGVAL } = require('../zaakabonnement');

/* Hoeveel er van iets moet zijn voordat het als gebruik telt. Een enkele
   proefrij is geen bedrijfsvoering; hij is wel een aanwijzing en telt daarom
   mee in `zeker` en niet in `nodig`. */
const DREMPEL = 3;

/* Hoeveel losse aanwijzingen er minstens moeten zijn voordat er uberhaupt een
   voorstel komt. Onder deze grens weten we te weinig -- zie regel 2. */
const MIN_SIGNALEN = 1;

function zakelijkeTreden() {
  return ladder.treden()
    .filter(t => t.beschikbaar && caps.mag(t.id, 'can_be_partner'))
    /* Van goedkoop naar duur, zodat de EERSTE die past ook de kleinste is. Een
       contractuele trede heeft geen vast bedrag; die sorteert op zijn bodem. */
    .sort((a, b) => (a.bodemCenten || 0) - (b.bodemCenten || 0));
}

/* Hoe stevig is dit voorstel? Geen percentage: een getal suggereert een
   nauwkeurigheid die er niet is. Drie woorden, en het middelste is eerlijk. */
function zekerheid(nodig, aanwijzing) {
  if (aanwijzing.length) return 'twijfel';
  if (nodig.length >= 2) return 'stevig';
  return 'mager';
}

function maakWeging({ zaakAbonnement }) {

  /* Het voorstel voor een zaak. `gebruik` is { capability: aantal }; `gemeten`
     is de lijst capabilities waar de aanroeper werkelijk naar heeft gekeken.
     Ontbreekt die lijst, dan is er niets gemeten -- niet alles. */
  function stel(code, gebruik, gemeten) {
    const g = gebruik && typeof gebruik === 'object' ? gebruik : {};
    const gezien = new Set(Array.isArray(gemeten) ? gemeten : []);
    const huidig = zaakAbonnement ? zaakAbonnement.van(code) : { code, pas: TERUGVAL, herkomst: 'voor-de-ladder' };

    /* Wat deze zaak aantoonbaar DOET. Boven de drempel: nodig. Daaronder maar
       niet nul: een aanwijzing, en die telt alleen mee in de zekerheid. */
    const nodig = [], aanwijzing = [], blind = [];
    for (const cap of Object.keys(caps.CAPS)) {
      const n = Math.round(Number(g[cap]) || 0);
      if (n >= DREMPEL) { nodig.push(cap); continue; }
      if (n > 0) { aanwijzing.push(cap); continue; }
      /* Nul. Maar was er wel naar gekeken? Zo niet, dan telt hij als nodig --
         zie de kop: een nul uit "niet gemeten" mag nooit een onderdeel
         intrekken. Alleen wat de zaak nu heeft doet ertoe; wat ze niet heeft,
         kan ze ook niet kwijtraken. */
      if (!gezien.has(cap) && caps.mag(huidig.pas, cap)) { blind.push(cap); nodig.push(cap); }
    }
    const signalen = nodig.filter(c => !blind.includes(c)).length + aanwijzing.length;

    if (huidig.herkomst !== 'voor-de-ladder')
      return { code: huidig.code, huidig: huidig.pas, voorstel: null,
        waarom: 'Deze zaak draagt al een vastgelegd abonnement; er valt niets voor te stellen.' };

    if (signalen < MIN_SIGNALEN)
      return { code: huidig.code, huidig: huidig.pas, voorstel: null, zeker: 'geen',
        waarom: 'Te weinig te zien om iets voor te stellen. "Niets gebruikt" is niet hetzelfde als ' +
          '"de goedkoopste trede volstaat" -- die stap zet dit huis niet zonder gegevens.' };

    /* De kleinste trede die alles dekt wat de zaak nodig heeft. Aanwijzingen
       tellen hier NIET mee: anders zou een enkele proefrij een hele trede
       omhoogduwen. */
    const passend = zakelijkeTreden().find(t => nodig.every(c => caps.mag(t.id, c)));
    if (!passend)
      return { code: huidig.code, huidig: huidig.pas, voorstel: null,
        waarom: 'Geen enkele beschikbare trede dekt wat deze zaak doet; dit hoort een mens te bekijken.' };

    if (passend.id === huidig.pas)
      return { code: huidig.code, huidig: huidig.pas, voorstel: huidig.pas,
        zeker: zekerheid(nodig.filter(c => !blind.includes(c)), aanwijzing),
        waarom: 'Wat deze zaak doet past op de trede waarop ze al draait; het voorstel is dus om die ' +
          'vast te leggen in plaats van te blijven terugvallen.' +
          (blind.length ? ' Naar ' + blind.join(', ') + ' is niet gekeken; die telt daarom als nodig, ' +
            'en dat is de reden dat er geen lagere trede uit komt.' : ''),
        verliest: [], gebruikt: nodig.filter(c => !blind.includes(c)), aanwijzingen: aanwijzing,
        ongemeten: blind };

    /* WAT HET AFPAKT. Niet als waarschuwing achteraf maar als onderdeel van het
       voorstel: wie tekent, hoort te weten wat hij intrekt. */
    const verliest = Object.keys(caps.CAPS)
      .filter(c => caps.mag(huidig.pas, c) && !caps.mag(passend.id, c));

    return { code: huidig.code, huidig: huidig.pas, voorstel: passend.id, voorstelNaam: passend.naam,
      zeker: zekerheid(nodig.filter(c => !blind.includes(c)), aanwijzing),
      gebruikt: nodig.filter(c => !blind.includes(c)), aanwijzingen: aanwijzing,
      /* Waar niet naar is gekeken, staat er met naam bij: dat verklaart waarom
         een voorstel soms hoger uitvalt dan iemand verwacht. */
      ongemeten: blind, verliest,
      waarom: 'Deze zaak gebruikt ' +
        (nodig.filter(c => !blind.includes(c)).length ? nodig.filter(c => !blind.includes(c)).join(', ') : 'niets aantoonbaar') +
        '; ' + passend.naam + ' dekt dat.' +
        (verliest.length ? ' Dit haalt ' + verliest.join(", ").replace(/, ([^,]*)$/, " en $1") + ' weg.' : '') +
        (aanwijzing.length ? ' Let op: ' + aanwijzing.join(', ') + ' komt weinig voor maar is niet nul.' : '') +
        (blind.length ? ' Naar ' + blind.join(', ') + ' is niet gekeken; die blijft daarom staan.' : '') };
  }

  return { stel };
}

module.exports = { maakWeging, zakelijkeTreden, zekerheid, DREMPEL, MIN_SIGNALEN };
