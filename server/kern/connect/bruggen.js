/* ============================================================================
   DE BRUGGEN -- van waar iemand al is naar waar hij nog nooit keek.

   "Iemand die uitsluitend voetbal bekijkt krijgt niet ineens colleges
   scheikunde. Maar misschien wel: waarom draait een vrije trap eigenlijk?"
   Dat is de hele laag. Een brug bestaat uit drie dingen en niet uit twee:

     van    een alledaags onderwerp waar iemand al is
     naar   een vak uit kern/leerstof.js -- de bestemming
     vraag  de VRAAG die de sprong vanzelfsprekend maakt

   Die derde is waar het op staat of valt. `voetbal -> natuurkunde` is een
   verband dat alleen iets betekent voor wie het al kent; "waarom krult een bal
   als je hem van opzij raakt?" is een vraag die een kind van tien uit zichzelf
   stelt. Een bruggenlijst zonder vraag is een categorieenboom, en die had
   niemand nodig.

   DEZE LIJST IS VERKLAARD EN NIET GELEERD, EN DAT STAAT ERBIJ. Er is geen
   model dat dit uit gedrag afleidt, geen kijktijd, geen cluster. Dat is een
   beperking en het is ook de reden dat de laag mag bestaan: een geleerde
   bruggenlijst leert wat mensen AANKLIKKEN, en dat is precies de
   aandachtsmachine waar Foundation Connect niet op lijkt. De prijs is dat deze
   lijst eindig is en met de hand groeit; die prijs staat hier opgeschreven in
   plaats van weggewerkt achter een generator.

   DE GRAAD IS DAAROM `vermoed` EN NOOIT HOGER. Niemand heeft gemeten dat deze
   bruggen werken. Dat is geen valse bescheidenheid maar de huisregel: wat niet
   gemeten is, wordt niet als getal getoond (BESTUUR.md). Wie hier ooit een
   meting onder legt -- hoe vaak een brug tot een `geprobeerd` leidt -- mag de
   graad verhogen en moet dan ook de meting noemen.

   DRIE DINGEN DIE HIER STRUCTUREEL NIET KUNNEN:

   1. EEN BRUG NAAR EEN MENS. De bestemming is altijd een VAK. Een brug
      `voetbal -> Peter` zou een mensenmatch zijn op smaak, en dat is de
      koppeling die ONTMOETEN.md bij de datinglaag houdt en niet hier.
   2. EEN BRUG TERUG NAAR WAAR IEMAND AL WAS. `van` en `naar` zijn nooit
      hetzelfde, en `naar` is altijd een vak -- een brug van voetbal naar
      voetbal is de bubbel met een pijl erin.
   3. EEN BRUG DIE OORDEELT. Geen enkele `vraag` zegt wat iemand zou moeten
      vinden. "Waarom denken mensen hier verschillend over?" mag; "waarom is X
      eigenlijk onzin" niet -- het doel is beter leren denken, niet iets vinden.
   ========================================================================== */
'use strict';

const GRAAD = 'vermoed';

const BRUGGEN = [
  { van: 'voetbal',    naar: 'natuurkunde',     vraag: 'Waarom krult een bal als je hem van opzij raakt?' },
  { van: 'voetbal',    naar: 'biologie',        vraag: 'Waarom kun je sprinten tot je niet meer kunt, en daarna toch nog wandelen?' },
  { van: 'voetbal',    naar: 'rekenen',         vraag: 'Hoe kan een ploeg meer doelpunten maken en toch minder punten halen?' },
  { van: 'koken',      naar: 'scheikunde',      vraag: 'Waarom wordt een ei hard en een saus juist dun?' },
  { van: 'koken',      naar: 'rekenen',         vraag: 'Wat kost een maaltijd voor vier mensen als je hem uitrekent per gram?' },
  { van: 'koken',      naar: 'aardrijkskunde',  vraag: 'Waarom eet bijna elk land rijst, brood of mais -- en hangt dat af van waar het ligt?' },
  { van: 'muziek',     naar: 'natuurkunde',     vraag: 'Waarom klinkt een snaar hoger als je hem korter maakt?' },
  { van: 'muziek',     naar: 'geschiedenis',    vraag: 'Waarom klonk muziek honderd jaar geleden anders dan nu?' },
  { van: 'gamen',      naar: 'informatica',     vraag: 'Hoe weet een spel waar je bent als je nergens op drukt?' },
  { van: 'gamen',      naar: 'wiskunde',        vraag: 'Hoe tekent een computer een ronde bal op een scherm vol vierkantjes?' },
  { van: 'auto',       naar: 'natuurkunde',     vraag: 'Waarom heeft een band profiel, en waarom een ander profiel in de regen?' },
  { van: 'auto',       naar: 'economie',        vraag: 'Waarom is een auto na een jaar zoveel minder waard dan na het tweede jaar?' },
  { van: 'telefoon',   naar: 'natuurkunde',     vraag: 'Waar gaat een bericht langs tussen hier en de andere kant van de wereld?' },
  { van: 'telefoon',   naar: 'digitaal',        vraag: 'Wie weet er wat als u een foto stuurt?' },
  { van: 'dieren',     naar: 'biologie',        vraag: 'Waarom zijn er geen groene zoogdieren terwijl er wel groene vogels zijn?' },
  { van: 'tuin',       naar: 'natuur',          vraag: 'Waarom groeit onkruid sneller dan wat u er zelf hebt neergezet?' },
  { van: 'tuin',       naar: 'scheikunde',      vraag: 'Wat doet compost eigenlijk met de grond eronder?' },
  { van: 'geld',       naar: 'economie',        vraag: 'Waarom kost hetzelfde brood volgend jaar meer?' },
  { van: 'geld',       naar: 'rekenen',         vraag: 'Hoeveel houdt u over van 1700 euro als de huur 750 is en de fiets kapot gaat?' },
  { van: 'mode',       naar: 'aardrijkskunde',  vraag: 'Waar komt de katoen in uw shirt vandaan, en hoeveel water kostte dat?' },
  { van: 'reizen',     naar: 'geschiedenis',    vraag: 'Waarom staan de oudste gebouwen van bijna elke stad op dezelfde plek?' },
  { van: 'reizen',     naar: 'taal',            vraag: 'Waarom lijken sommige woorden in vreemde talen zo op die van ons?' },
  { van: 'bouwen',     naar: 'wiskunde',        vraag: 'Waarom is een driehoek sterker dan een vierkant?' },
  { van: 'film',       naar: 'communicatie',    vraag: 'Waarom voelt dezelfde scene anders met andere muziek eronder?' },
  { van: 'nieuws',     naar: 'maatschappijleer', vraag: 'Waarom denken mensen verschillend over hetzelfde bericht?' },
  { van: 'sport',      naar: 'biologie',        vraag: 'Waarom heeft u spierpijn pas twee dagen later?' },
  { van: 'weer',       naar: 'aardrijkskunde',  vraag: 'Waarom regent het aan de ene kant van een berg wel en aan de andere kant niet?' },
  { van: 'ruimte',     naar: 'natuurkunde',     vraag: 'Waarom valt de maan niet naar beneden?' }
];

/* De bruggen VANAF een onderwerp. Geeft er hoogstens `max` terug en sorteert
   niet: een volgorde zou hier een voorkeur zijn die niemand heeft uitgesproken.
   Onbekend onderwerp -> lege lijst, en dat is een uitslag: deze lijst kent dit
   woord niet, en er wordt geen verband verzonnen. */
function vanaf(onderwerp, max) {
  const o = String(onderwerp || '').toLowerCase().trim();
  if (!o) return [];
  const raak = BRUGGEN.filter(b => o === b.van || o.includes(b.van) || b.van.includes(o));
  return raak.slice(0, Math.max(1, Math.min(Number(max) || 3, 10)))
    .map(b => Object.assign({ graad: GRAAD }, b));
}

/* Welke onderwerpen deze lijst KENT. Een scherm dat om interesses vraagt, hoort
   te kunnen tonen waar hij vandaag iets mee kan -- in plaats van een leeg
   tekstveld waar een mens iets intikt waar niets achter zit. */
const ONDERWERPEN = [...new Set(BRUGGEN.map(b => b.van))].sort();

module.exports = { BRUGGEN, ONDERWERPEN, vanaf, GRAAD };
