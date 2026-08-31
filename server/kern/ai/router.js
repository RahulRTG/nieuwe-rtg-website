/* DE INTELLIGENTIEROUTER -- welke techniek hoort bij deze vraag, en waarom.
   EXECUTIE.md blok 8.

   DE HUISREGEL. Kan het met een REGEL, dan een regel. Kan het met een exact
   ALGORITME, dan dat. Met OPTIMALISATIE, dan een optimizer. Met STATISTIEK, dan
   een voorspeller. Pas als er taal, dubbelzinnigheid of redenering nodig is,
   komt een generatief model. AI is de laatste passende techniek, niet de eerste.

   WAT DEZE ROUTER VANDAAG WEL EN NIET DOET, en dat verschil is de kern:

     WEL   hij zegt per vraag welke techniek er BIJ HOORT, met de reden, en
           welke motor dat zou zijn -- en hij telt hoe vaak dat een goedkopere
           techniek dan een model is.
     NIET  hij beslist niets. De modelaanroep in ../ai.js gaat gewoon door.

   DAT IS EEN BESLUIT EN GEEN HALFHEID. Vandaag staat de regellaag
   (./demoantwoorden.js) achter het model: is er een sleutel, dan antwoordt het
   model altijd, en het regelantwoord vangt alleen een storing op. De volgorde
   omdraaien betekent dat een matig regelantwoord een goed modelantwoord kan
   verdringen -- en dat merkt niemand, want er komt gewoon een antwoord. Eerst
   meten hoe vaak de regels het ECHT gedekt hadden; pas dan schuift de volgorde.
   Dezelfde afspraak als CONTROLPLANE.md: je kunt niet afdwingen wat nooit in de
   schaduw heeft gelopen.

   HIJ WIJST ALLEEN NAAR MOTOREN DIE BESTAAN. De verleiding is een tak
   `optimalisatie` die naar een constraint solver wijst; die is er niet --
   kern/agent.js maakt roostervoorstellen op weekdagfactoren, en dat is een
   heuristiek. Een router die naar een niet-bestaande motor wijst is de fout van
   de cap `rooms`: een naam die een document noemde en die nergens bestond.
   Ontbrekende technieken staan daarom in ONTBREEKT, met de reden, en de toets
   controleert dat elke motor in MOTOREN werkelijk laadt en zijn ingang heeft. */
'use strict';

/* De vijf technieken, van goedkoopst en zekerst naar duurst en vaagst. De
   volgorde IS de regel: de eerste die past, wint. */
const TECHNIEKEN = Object.freeze(['regels', 'algoritme', 'optimalisatie', 'voorspelling', 'ai']);

/* Wat er in dit huis werkelijk staat. Elke ingang noemt het bestand en de
   export; test/ai-router.test.js laadt ze allemaal en zakt als er een mist. */
const MOTOREN = Object.freeze([
  { techniek: 'regels', bestand: 'kern/ai/demoantwoorden.js', ingang: 'cannedAnswer',
    wat: 'vaste antwoorden op veelgestelde vragen, zonder model' },
  { techniek: 'algoritme', bestand: 'kern/fiscaal/btwtelling.js', ingang: 'maakBtwTelling',
    wat: 'btw tot op de cent uit het factuurregister' },
  { techniek: 'algoritme', bestand: 'kern/navigatie/wegennet.js', ingang: null,
    wat: 'kortste weg over het wegennet (de module is een fabriek)' },
  { techniek: 'voorspelling', bestand: 'kern/voorspel/index.js', ingang: 'maakVoorspel',
    wat: 'het ritme van een lid uit het eigen grootboek' },
  { techniek: 'voorspelling', bestand: 'kern/kosten/vooruitblik.js', ingang: null,
    wat: 'kostenvooruitblik met een bandbreedte die pas verschijnt als de trefzekerheid gemeten is' },
  { techniek: 'ai', bestand: 'kern/ai/prompt.js', ingang: null,
    wat: 'het generatieve antwoord van Rahul' }
]);

/* Wat er NIET is, met de reden. Deze lijst hoort even zichtbaar te zijn als de
   vorige: een router die zwijgt over zijn gaten, laat zijn dekking groter lijken. */
const ONTBREEKT = Object.freeze([
  { techniek: 'optimalisatie',
    reden: 'er is geen constraint solver in dit huis. kern/agent.js maakt roostervoorstellen op ' +
      'weekdagfactoren -- een heuristiek, geen optimizer. Een rooster met contracturen, ' +
      'beschikbaarheid en cao-grenzen is zelfstandig werk en hoort in het roosterdomein.' }
]);

/* De woorden waaraan een techniek te herkennen is. Dit is taal en geen
   routekennis; wie hier iets bijzet, verandert alleen de MEETUITSLAG en geen
   enkel antwoord, zolang de router in de schaduw loopt. */
const SPOREN = Object.freeze({
  regels: [/\bwat kost\b/, /\bhoe (?:werkt|meld ik|word ik)\b/, /\bwat is (?:rtg|de rtg|lifestyle|business)\b/,
    /\bopeningstijden\b/, /\bhoe schrijf ik me in\b/, /\bwelke pas\b/],
  algoritme: [/\bbtw\b/, /\bhoeveel (?:is|kost) \d/, /\breken\b/, /\bafstand\b/, /\broute naar\b/, /\bkortste\b/],
  optimalisatie: [/\brooster\b/, /\binplannen\b/, /\bzo efficient mogelijk\b/, /\boptimaal\b/, /\bbezetting\b/],
  voorspelling: [/\bverwacht\b/, /\bvoorspel\b/, /\bwanneer ga ik\b/, /\bhoeveel ga ik\b/, /\bprognose\b/, /\bvooruitblik\b/]
});

/* DE TELLERS, EN WAAROM ZE DUURZAAM MOETEN ZIJN. Een schaduwmeting bestaat om
   een besluit te dragen: draaien we de volgorde om? Tellers die bij elke
   herstart op nul springen, dragen dat besluit niet -- dan is "60% had een
   goedkopere techniek gekund" een indruk van deze middag en geen meting.

   Ze schrijven daarom door naar een opslagpunt dat de aanroeper meegeeft
   (`onthoud`), en pas dan mag de uitslag zeggen dat hij duurzaam is. Zonder dat
   punt blijven ze in dit proces EN zegt de stand dat ook: `duurzaam: false`.
   Dat is dezelfde regel als overal in dit huis -- niet gemeten mag nooit als
   gemeten langskomen.

   TELLERS EN GEEN JOURNAAL. Voor deze vraag is niet nodig wie wat vroeg; er
   worden geen vragen bewaard, alleen aantallen per techniek (KOSTEN.md). */
const LEEG = { totaal: 0, regels: 0, algoritme: 0, optimalisatie: 0, voorspelling: 0, ai: 0, zonderMotor: 0 };
let tellers = Object.assign({}, LEEG);
let bewaarplek = null;

/* De aanroeper geeft een plek met lees() en schrijf(); zolang die er niet is,
   telt de router in het geheugen en zegt dat erbij. */
function onthoud(plek) {
  if (!plek || typeof plek.lees !== 'function' || typeof plek.schrijf !== 'function') return false;
  bewaarplek = plek;
  /* Ook LEZEN gebeurt achter een vangnet. Een meting die de aanroeper kan
     laten klappen, is erger dan geen meting -- en dit is een schaduwlaag: hij
     mag nooit in de weg lopen van het antwoord waar hij naast hangt. */
  let eerder = null;
  try { eerder = plek.lees(); } catch (e) { eerder = null; }
  if (eerder && typeof eerder === 'object')
    for (const k of Object.keys(LEEG)) if (Number.isFinite(eerder[k])) tellers[k] = eerder[k];
  return true;
}

function motorenVoor(techniek) { return MOTOREN.filter(m => m.techniek === techniek); }

/* WELKE TECHNIEK HOORT HIER? Geeft altijd een techniek, altijd een reden, en
   altijd of er een motor voor bestaat. Beslist niets. */
function kies(vraag) {
  const t = String(vraag || '').toLowerCase();
  for (const techniek of TECHNIEKEN) {
    if (techniek === 'ai') break;
    const sporen = SPOREN[techniek] || [];
    const raak = sporen.find(re => re.test(t));
    if (!raak) continue;
    const motoren = motorenVoor(techniek);
    if (!motoren.length) {
      const gat = ONTBREEKT.find(o => o.techniek === techniek);
      return { techniek: 'ai', gevraagd: techniek, motor: null,
        reden: 'dit lijkt een vraag voor ' + techniek + ', maar die techniek bestaat hier niet: ' +
          (gat ? gat.reden : 'geen motor geregistreerd') + ' Daarom valt hij terug op het model.',
        goedkoperMogelijk: false };
    }
    return { techniek, gevraagd: techniek, motor: motoren[0].bestand,
      reden: 'de vraag draagt een spoor van ' + techniek + ' (' + raak.source + ') en daar bestaat een motor voor: ' +
        motoren[0].wat, goedkoperMogelijk: true };
  }
  return { techniek: 'ai', gevraagd: 'ai', motor: 'kern/ai/prompt.js',
    reden: 'geen spoor van een goedkopere techniek gevonden; deze vraag vraagt taal of redenering',
    goedkoperMogelijk: false };
}

/* De schaduwstand: wat de router ZOU hebben gekozen, geteld. Tellers en geen
   journaal -- voor een meting is niet nodig wie wat vroeg (KOSTEN.md). Ze leven
   in dit proces en overleven een herstart niet; dat staat in de uitslag. */
function schaduw(vraag) {
  const uit = kies(vraag);
  tellers.totaal++;
  tellers[uit.techniek]++;
  if (!uit.motor) tellers.zonderMotor++;
  if (bewaarplek) { try { bewaarplek.schrijf(Object.assign({}, tellers)); } catch (e) { /* meten mag nooit stukmaken */ } }
  return uit;
}

function stand() {
  const g = tellers.totaal ? Math.round(1000 * (tellers.totaal - tellers.ai) / tellers.totaal) / 10 : 0;
  return Object.assign({}, tellers, {
    goedkoperMogelijkPct: g,
    duurzaam: !!bewaarplek,
    grens: (bewaarplek
      ? 'Tellers die een herstart overleven. '
      : 'Tellers van DIT PROCES; een herstart zet ze op nul, dus dit getal draagt nog geen besluit. ') +
      'De router BESLIST NIETS: de modelaanroep gaat door, dit is de schaduwmeting die aan een ' +
      'omkering vooraf hoort te gaan.'
  });
}

module.exports = { kies, schaduw, stand, onthoud, TECHNIEKEN, MOTOREN, ONTBREEKT, SPOREN };
