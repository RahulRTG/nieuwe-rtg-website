/* Magnaat: DE POLIS -- wat een verzekering kost, dekt en NIET dekt.

   Een polis is hier geen vinkje. Vijf velden, en ze vormen samen een echte
   afweging in plaats van een aan-uitknop:

     dekking      welk deel van de schade de verzekeraar draagt (0 tot 1)
     eigenRisico  wat je zelf betaalt voordat er iets uitgekeerd wordt
     maximum      wat er per voorval hoogstens uitgaat
     premie       wat het per spelmaand kost -- volgt uit de andere drie
     uitsluiting  wanneer er NIETS wordt uitgekeerd

   OVERVERZEKEREN MAG NOOIT WINSTGEVEND ZIJN, en dat is de belangrijkste regel
   van dit bestand. Hij wordt op twee manieren waargemaakt, want een ervan is
   niet genoeg:

   1. EEN UITKERING IS NOOIT HOGER DAN DE AANTOONBARE SCHADE. Wie zich voor het
      dubbele verzekert, krijgt niet het dubbele -- hij betaalt alleen dubbele
      premie. Dat is de harde grens.
   2. DE PREMIE DRAAGT EEN OPSLAG BOVEN DE VERWACHTE SCHADE. Zonder die opslag
      is volledig verzekeren gratis en is er niets te kiezen; met een opslag is
      verzekeren een RUIL -- je ruilt een beetje rendement voor minder variatie,
      en of dat loont hangt af van je buffer.

   Wie een dikke kas heeft, draagt zijn eigen risico goedkoper dan de
   verzekeraar het doet. Wie krap zit, kan zich een brand niet veroorloven en
   betaalt met plezier de opslag. Dat is de keuze, en hij hoort per speler
   anders uit te vallen.

   DE UITSLUITING IS GEEN KLEINE LETTERTJES MAAR EEN KOPPELING. Brand en
   machinebreuk worden niet uitgekeerd als het onderhoud onder de dertig staat op
   het moment van het voorval. Zo hangt de verzekering aan een knop die de speler
   elke maand zelf zet -- en wordt "geen onderhoud doen" een keuze met twee
   staarten in plaats van een besparing. */
const R = require('./risico');

const rond = (n) => Math.round(n);
const klem = (n, a, b) => Math.max(a, Math.min(b, n));

/* De opslag boven de verwachte schade. Vijfendertig procent: genoeg dat
   verzekeren een prijs heeft, weinig genoeg dat het bij een dunne buffer nog
   steeds de verstandige zet is. */
const OPSLAG = 0.35;
/* Onder deze onderhoudsstand keert een uitsluitbaar risico niets uit. */
const ONDERHOUDSGRENS = 30;
const MAX_POLISSEN = 12;

/* De grenzen van een polis. Dekking boven 1 bestaat niet -- dat is precies de
   oververzekering die nergens toe leidt, en hem verbieden is eerlijker dan hem
   toestaan en dan niet uitkeren. */
const GRENZEN = { dekking: [0.1, 1], eigenRisico: [0, 500000], maximum: [1000, 20000000] };

/* WAT EEN POLIS KOST. De verwachte schade maal de dekking, maal de opslag, en
   dan omlaag voor het deel dat de speler zelf draagt.

   Het eigen risico verlaagt de premie omdat het de verzekeraar ECHT geld
   scheelt: elke uitkering wordt met dat bedrag verlaagd, en de kleine voorvallen
   vallen helemaal weg. Zonder die korting is een eigen risico nemen puur verlies
   en kiest niemand het ooit. */
function premieVoor(risico, v, maandomzet, polis, ctx) {
  const verwacht = R.verwachteSchade(risico, v, maandomzet, ctx);
  if (verwacht <= 0) return 0;
  const kans = R.RISICOS[risico].volgtOp
    ? R.RISICOS[risico].volgtOp.reduce((n, x) => n + R.kansOp(x, v, ctx), 0)
    : R.kansOp(risico, v, ctx);
  // wat het eigen risico gemiddeld per maand van een uitkering afhaalt
  const eigen = Math.min(verwacht, kans * (polis.eigenRisico || 0));
  const nettoVerwacht = Math.max(0, verwacht - eigen);
  const begrensd = Math.min(nettoVerwacht, kans * (polis.maximum || Infinity));
  return begrensd * polis.dekking * (1 + OPSLAG);
}

function keurPolis(x) {
  for (const [veld, [laag, hoog]] of Object.entries(GRENZEN)) {
    const n = Number(x[veld]);
    if (!Number.isFinite(n) || n < laag || n > hoog)
      return `${veld} moet tussen ${laag} en ${hoog} liggen.`;
  }
  if (!R.RISICOLIJST.includes(x.risico)) return 'Dat risico bestaat niet.';
  return null;
}

/* WAT ER WORDT UITGEKEERD bij een voorval. Vier stappen, en de laatste is de
   grens waar deze hele laag op rust. */
function uitkering(polis, v, schade) {
  const r = R.RISICOS[polis.risico];
  // 1. de uitsluiting: verwaarlozing is niet verzekerd
  if (r.uitsluitbaar && v.onderhoud < ONDERHOUDSGRENS)
    return { bedrag: 0, reden: 'uitgesloten: het onderhoud stond onder de ' + ONDERHOUDSGRENS };
  // 2. het eigen risico gaat er eerst af
  const boven = Math.max(0, schade - polis.eigenRisico);
  // 3. de dekking en het maximum
  const bedrag = Math.min(boven * polis.dekking, polis.maximum);
  /* 4. EN NOOIT MEER DAN DE SCHADE ZELF. Deze regel maakt oververzekeren
        zinloos in plaats van winstgevend, en hij staat er los van stap 3 omdat
        stap 3 hem NIET afdwingt: een maximum boven de schade is geen fout, het
        is gewoon een polis die te ruim is ingekocht. */
  return { bedrag: Math.min(bedrag, schade), reden: null };
}

module.exports = { premieVoor, keurPolis, uitkering, GRENZEN, OPSLAG, ONDERHOUDSGRENS, MAX_POLISSEN };
