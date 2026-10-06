/* EEN BEVOEGDHEID IS GEEN JA OF NEE.

   kern/commercie/capaciteiten.js zegt of een TREDE iets bevat: `can_use_pos` is
   waar of niet waar. Dat was een grote stap vooruit ten opzichte van
   `pas === 'business'`, maar het is te grof voor de vraag die er werkelijk toe
   doet. "Mag deze medewerker een bedrag terugbetalen" is geen ja/nee -- het
   antwoord hangt af van HOEVEEL, WAAR, en ONDER WELKE OMSTANDIGHEDEN.

   Zou je dat met booleans oplossen, dan krijg je `refund_10`, `refund_50`,
   `refund_250` -- honderd capabilities voor een enkele handeling, en bij elke
   nieuwe grens komt er weer een bij. Dat schaalt niet en het is niet uit te
   leggen.

   DUS: VIER DIMENSIES.

     WAT          de handeling            money.refund
     WAAR         waarop                  zaak:KIKUNOI
     HOEVEEL      binnen welke grenzen    maxCenten: 25000
     WANNEER      onder welke voorwaarden alleenEigenVestiging, apparaatVertrouwd

   Dezelfde bevoegdheid bestaat dan voor iedereen, met andere grenzen.

   DELEGATIE KAN ALLEEN VERSMALLEN. Dat is de belangrijkste regel hier, en hij is
   structureel afgedwongen en niet als vuistregel opgeschreven: een gedelegeerde
   bevoegdheid krijgt het MINIMUM van wat de gever had en wat hij weggeeft. Wie
   meer probeert weg te geven dan hij heeft, geeft weg wat hij heeft. Zo kan een
   keten van vier delegaties nooit meer opleveren dan de eerste schakel:

     directeur   100.000
       manager    20.000     (kan niet 200.000 worden)
       AI-agent    2.000
       deelproces   250

   Daarmee is een hele klasse rechten-escalatie onmogelijk in plaats van
   onwaarschijnlijk. En het beantwoordt de vraag die na een incident als eerste
   komt: WAAROM mocht deze agent 82,40 uitgeven? De keten staat er.

   WAT DIT NIET IS: een tweede rechtenmodel. CONCERN.md blijft gelden -- WIE
   iemand is, blijft de rol; WAT zijn abonnement bevat, blijft de trede. Deze
   laag zegt alleen HOEVER een gegeven bevoegdheid reikt, en die vraag werd tot
   nu toe nergens gesteld. */
'use strict';

const klok = require('../../lib/klok');

const MAX_DIEPTE = 8;

const { GRENZEN, keurGrenzen, versmal } = require('./bevoegdheid-grenzen');

/* Een bevoegdheid. `bron` zegt waar hij vandaan komt -- dat is wat de keten
   navertelbaar maakt. */
function maakBevoegdheid({ capability, scope, grenzen, bron, door, nu }) {
  const tijd = nu || klok.nu;
  /* Geen stille "overal": leeg is dicht. Wie overal bedoelt schrijft '*' (zoals
     GELD_INNEN); besluit.js maakt van deze fout ONBEKEND, nooit TOESTAAN. */
  if (scope == null || String(scope).trim() === '')
    throw new Error('Een bevoegdheid vraagt een expliciete scope; schrijf "*" als hij overal geldt.');
  const fout = keurGrenzen(grenzen);
  if (fout.length) throw new Error('Ongeldige grens: ' + fout.join('; ') + '.');
  return {
    capability: String(capability || ''),
    scope: String(scope),
    grenzen: versmal({}, grenzen),
    bron: bron || null,                     // de bevoegdheid waaruit deze is afgeleid
    door: door || null,
    diepte: bron && Number.isFinite(bron.diepte) ? bron.diepte + 1 : 0,
    at: tijd()
  };
}

/* DELEGEREN. Het resultaat is nooit ruimer dan de gever. Er is geen pad waarlangs
   `grenzen` iets kan verruimen: `versmal` neemt per grens de engste kant. */
function delegeer(van, { capability, scope, grenzen, door, nu }) {
  if (!van) return { error: 'Er is geen bevoegdheid om uit te delegeren.' };
  const cap = capability || van.capability;
  if (cap !== van.capability)
    return { error: 'Een delegatie kan geen andere bevoegdheid opleveren dan de bron (' +
      van.capability + ' -> ' + cap + ').' };

  /* De scope kan alleen SMALLER. `*` betekent overal; een concrete scope is
     smaller. Een andere concrete scope dan de gever heeft, is geen versmalling
     maar een uitbreiding, en die wordt geweigerd. */
  let nieuweScope = van.scope;
  if (scope != null && String(scope) !== van.scope) {
    if (van.scope !== '*')
      return { error: 'De bron geldt alleen voor ' + van.scope + '; ' + scope + ' valt daarbuiten.' };
    nieuweScope = String(scope);
  }

  /* MAX_DIEPTE: een keten die zichzelf blijft delegeren is geen bevoegdheid maar
     een lus. Acht is ruim -- directeur, manager, agent, deelproces is er vier --
     en de grens bestaat om een ongelimiteerd groeiende rij te voorkomen, niet om
     een echt geval tegen te houden. */
  // een onleesbare grens wordt geweigerd, niet stil overgeslagen
  const fout = keurGrenzen(grenzen);
  if (fout.length) return { error: 'Deze delegatie heeft een ongeldige grens: ' + fout.join('; ') + '.' };

  if (van.diepte >= MAX_DIEPTE)
    return { error: 'Deze delegatieketen is te diep (' + MAX_DIEPTE + '); leg de bevoegdheid rechtstreeks vast.' };

  /* De HELE ouder gaat mee als bron, niet een momentopname ervan. Hier stond
     `{ capability, scope, door, diepte }` -- vier velden zonder de bron van de
     ouder zelf, en dan stopt `herkomst()` na een stap. "Waarom mocht deze agent
     82,40 uitgeven" is dan te beantwoorden met "van de manager", en niet met de
     keten tot aan de directeur. Precies de vraag die na een incident als eerste
     komt. */
  return { ok: true, bevoegdheid: maakBevoegdheid({
    capability: cap, scope: nieuweScope,
    grenzen: versmal(van.grenzen, grenzen),
    bron: van,
    door, nu }) };
}

/* Past deze handeling binnen de bevoegdheid? Geeft null als het mag, anders de
   zin die de aanvrager te lezen krijgt. De reden staat er altijd bij: "verboden"
   zonder reden is precies het soort antwoord dat niemand verder helpt. */
function past(b, { scope, waardeCenten, context }) {
  if (!b) return 'Er is geen bevoegdheid voor deze handeling.';
  const ctx = context || {};

  /* Zonder scope tegen een bevoegdheid MET scope: weigeren (leeg is dicht). "geldt
     voor" laat besluit.js (bezwaarIsHard) er WEIGEREN van maken, niet BEPERKT. */
  if (b.scope !== '*' && (scope == null || String(scope) !== b.scope))
    return scope == null
      ? 'Deze bevoegdheid geldt voor ' + b.scope + ' en het verzoek noemt niet waarvoor.'
      : 'Deze bevoegdheid geldt voor ' + b.scope + ' en niet voor ' + scope + '.';

  const onleesbaar = keurGrenzen(b.grenzen);
  if (onleesbaar.length)
    return 'De grenzen van deze bevoegdheid zijn niet te lezen (' + onleesbaar.join('; ') + '); daarom geldt hij nu niet.';

  const bedrag = Math.round(Number(waardeCenten) || 0);
  if (Number.isFinite(b.grenzen.maxCenten) && bedrag > b.grenzen.maxCenten)
    return 'Het bedrag is hoger dan de bevoegdheid toestaat (' + euro(bedrag) + ' tegen ' + euro(b.grenzen.maxCenten) + ').';

  if (b.grenzen.alleenEigenVestiging && ctx.eigenVestiging === false)
    return 'Deze bevoegdheid geldt alleen op de eigen vestiging.';
  if (b.grenzen.apparaatVertrouwd && ctx.apparaatVertrouwd !== true)
    return 'Deze handeling vraagt een vertrouwd apparaat.';
  if (b.grenzen.omkeerbaarVerplicht && ctx.omkeerbaar !== true)
    return 'Deze bevoegdheid geldt alleen voor handelingen die terug te draaien zijn.';

  return null;
}

/* Het verbruik binnen een dag. Een grens per dag kan alleen betekenen wat hij
   zegt als er iets wordt geteld; zonder deze functie is `maxPerDagCenten` een
   veld dat mooi staat. De teller komt van de aanroeper, want die kent het
   grootboek en deze laag niet. */
function pastBinnenDag(b, { vandaagCenten, vandaagAantal, waardeCenten }) {
  if (!b) return 'Er is geen bevoegdheid voor deze handeling.';
  const onleesbaar = keurGrenzen(b.grenzen);
  if (onleesbaar.length)
    return 'De grenzen van deze bevoegdheid zijn niet te lezen (' + onleesbaar.join('; ') + '); daarom geldt hij nu niet.';
  const bedrag = Math.round(Number(waardeCenten) || 0);
  const alCenten = Math.round(Number(vandaagCenten) || 0);
  const alAantal = Math.round(Number(vandaagAantal) || 0);
  if (Number.isFinite(b.grenzen.maxPerDagCenten) && alCenten + bedrag > b.grenzen.maxPerDagCenten)
    return 'Hiermee komt het dagtotaal boven de bevoegdheid (' +
      euro(alCenten + bedrag) + ' tegen ' + euro(b.grenzen.maxPerDagCenten) + ').';
  if (Number.isFinite(b.grenzen.maxAantalPerDag) && alAantal + 1 > b.grenzen.maxAantalPerDag)
    return 'Het aantal handelingen voor vandaag is bereikt (' + b.grenzen.maxAantalPerDag + ').';
  return null;
}

/* De keten terug naar de oorsprong. Dit is het antwoord op de vraag die na een
   incident als eerste komt: waarom mocht dit? */
function herkomst(b) {
  const uit = [];
  let k = b;
  while (k) {
    uit.push({ capability: k.capability, scope: k.scope, door: k.door, diepte: k.diepte });
    k = k.bron;
  }
  return uit;
}

function euro(centen) {
  return '€ ' + (centen / 100).toLocaleString('nl-NL',
    { minimumFractionDigits: centen % 100 ? 2 : 0, maximumFractionDigits: 2 });
}

module.exports = { GRENZEN, MAX_DIEPTE, maakBevoegdheid, delegeer, versmal, keurGrenzen, past, pastBinnenDag, herkomst, euro };
