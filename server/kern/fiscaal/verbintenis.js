/* DE VERBINTENIS: aansluiten zonder alles te laten zien.

   De aangever en de toezichthouder tellen hetzelfde register met dezelfde
   routine (kern/fiscaal/btwtelling.js). Dat is de kracht van dit huis: een
   verschil betekent iets, want er is geen tweede rekenmethode die het kan
   verklaren. Maar het heeft een prijs die niemand had opgeschreven -- om te
   kunnen tellen, moet de inspecteur het HELE factuurregister kunnen lezen. Voor
   een controle op een bedrag is dat meer dan nodig: hij krijgt de complete
   commerciele administratie van een onderneming te zien om een optelsom te
   controleren.

   WAT HIER BIJKOMT is een tussenstap die dat niet meer nodig maakt:

     1. De aangever maakt een VERBINTENIS: een merkleboom over de feiten die hij
        heeft geteld (per factuur: nummer, datum, btw in centen), plus het
        totaal. Alleen de WORTEL en het totaal gaan naar de inspecteur.
     2. De inspecteur ziet dus een bedrag en een vingerafdruk, en geen enkele
        factuur.
     3. Twijfelt hij over EEN factuur, dan vraagt hij daar bewijs van. Hij
        krijgt die ene regel plus het pad naar de wortel, en kan zelf narekenen
        dat hij in de getelde verzameling zat -- zonder de rest te zien.

   WAT DIT WEL EN NIET IS. Dit is een verbintenis met selectieve openbaarmaking,
   geen zero-knowledge bewijs. De inspecteur kan NIET nagaan dat er geen factuur
   is WEGGELATEN -- daarvoor zou hij de verzameling moeten kennen. Wat hij wel
   kan: vaststellen dat de aangever zich op een moment aan een verzameling heeft
   vastgelegd en daar achteraf niets aan kan veranderen zonder dat de wortel
   verandert. Dat is precies de eigenschap die bij een controle telt, en het is
   minder dan het klinkt -- vandaar dat het hier staat.

   HET SPOOR STAAT ER AL. Wie waarnaar keek en waarom, wordt gejournaliseerd
   door server/inzagelog.js, met een eigen keten en anker. Dat is niet opnieuw
   gebouwd; een tweede journaal is een tweede waarheid. */
'use strict';

const { canoniek } = require('./gateway/zegel');

function maakVerbintenis({ crypto }) {
  const hash = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
  const blad = (feit) => hash('blad:' + canoniek(feit));
  const knoop = (a, b) => hash('knoop:' + a + ':' + b);

  /* De boom, laag voor laag. Een oneven knoop schuift ongewijzigd door naar de
     volgende laag -- niet verdubbeld, want dan zou een verzameling met een
     dubbele laatste regel dezelfde wortel geven als een zonder. */
  function lagen(bladeren) {
    const uit = [bladeren.slice()];
    let nu = bladeren;
    while (nu.length > 1) {
      const op = [];
      for (let i = 0; i < nu.length; i += 2) op.push(i + 1 < nu.length ? knoop(nu[i], nu[i + 1]) : nu[i]);
      uit.push(op);
      nu = op;
    }
    return uit;
  }

  /* DE VERBINTENIS. `feiten` is wat er is geteld, in een vaste volgorde -- die
     volgorde hoort bij de verbintenis, want een andere volgorde geeft een
     andere wortel. Sorteren gebeurt hier en niet bij de aanroeper, zodat twee
     partijen die dezelfde feiten hebben ook dezelfde wortel krijgen. */
  function leg(feiten, totaalCenten) {
    const rijen = (Array.isArray(feiten) ? feiten : []).slice()
      .sort((a, b) => (canoniek(a) < canoniek(b) ? -1 : 1));
    if (!rijen.length) return { ok: true, wortel: null, aantal: 0, totaalCenten: totaalCenten || 0,
      let: 'Er is niets geteld, dus er valt niets vast te leggen.' };
    const bladeren = rijen.map(blad);
    const boom = lagen(bladeren);
    return { ok: true, wortel: boom[boom.length - 1][0], aantal: rijen.length,
      totaalCenten: totaalCenten || 0, diepte: boom.length,
      let: 'De wortel legt deze verzameling vast. Wie er achteraf iets aan verandert, verandert de wortel.' };
  }

  /* HET BEWIJS voor EEN feit: het pad van zijn blad naar de wortel. Alleen dit
     ene feit gaat mee -- de rest van de verzameling blijft ongezien. */
  function bewijs(feiten, feit) {
    const rijen = (Array.isArray(feiten) ? feiten : []).slice()
      .sort((a, b) => (canoniek(a) < canoniek(b) ? -1 : 1));
    const bladeren = rijen.map(blad);
    let i = bladeren.indexOf(blad(feit));
    if (i < 0) return { status: 404, error: 'Dit feit zit niet in de getelde verzameling.' };
    const boom = lagen(bladeren);
    const pad = [];
    for (let l = 0; l < boom.length - 1; l++) {
      const laag = boom[l];
      const buur = i % 2 === 0 ? i + 1 : i - 1;
      /* Een knoop zonder buur schuift door; dan staat er geen stap in het pad,
         en de controle hieronder doet hetzelfde. */
      if (buur < laag.length) pad.push({ kant: i % 2 === 0 ? 'rechts' : 'links', hash: laag[buur] });
      i = Math.floor(i / 2);
    }
    return { ok: true, feit, pad };
  }

  /* DE CONTROLE, en die is PUUR: hij heeft de verzameling niet nodig. Dat is de
     hele opzet -- de inspecteur rekent dit na met wat hij heeft gekregen. */
  function controleer(wortel, feit, pad) {
    let h = blad(feit);
    for (const stap of Array.isArray(pad) ? pad : []) {
      h = stap.kant === 'rechts' ? knoop(h, stap.hash) : knoop(stap.hash, h);
    }
    return { ok: h === wortel, berekend: h, wortel,
      let: h === wortel
        ? 'Dit feit zat in de verzameling waar de aangever zich aan heeft vastgelegd.'
        : 'Dit feit hoort niet bij deze wortel: of het feit klopt niet, of het pad niet.' };
  }

  return { verbintenis: { leg, bewijs, controleer, blad } };
}

module.exports = { maakVerbintenis };
