/* RTG School: de Language Independence Test.

   Een leerling doet het slecht op natuurkunde in het Nederlands. Twee heel
   verschillende dingen kunnen daar spelen: hij snapt het concept niet, of hij
   struikelt over de zin. Dat verschil is niet te zien aan een cijfer, en het
   leidt tot tegenovergestelde hulp -- meer natuurkunde-instructie of
   taalondersteuning.

   Deze laag stelt DEZELFDE vraag opnieuw in de thuistaal (kern/leerstof-
   taalvorm.js: uit het feit opnieuw gesteld, niet vertaald) en kijkt of het dan
   wel lukt. Gaat het dan goed, dan luidt de conclusie:

     "Taalondersteuning lijkt hier relevanter dan extra instructie."

   EN DAAR HOUDT HET OP. Vier grenzen, en ze zijn alle vier hard:

   1. HET IS EEN AANWIJZING VOOR EEN GESPREK, GEEN DIAGNOSE EN NOOIT EEN LABEL.
      De uitkomst is een zin met het woord "lijkt" erin, en er komt geen
      taalniveau, geen score en geen etiket uit.
   2. ER WORDT NIETS OPGESLAGEN. Deze module krijgt geen db en geen save. Wat
      je niet kunt bewaren, kan later niet aan een kind blijven plakken -- en
      dat is precies wat er met zo'n uitkomst gebeurt als je hem laat staan.
   3. ALLEEN WAAR HET VAK HET TOELAAT. Bij een taalvak is de zin zelf wat je
      meet; daar is deze test een manier om de meting weg te halen. De poort
      staat in ./taalbeleid.js.
   4. LIEVER NIETS DAN EEN GOK. Is er voor deze taal geen vorm van deze opgave,
      dan gebeurt er niets. Een half vertaalde vraag is een andere vraag, en dan
      meet de test iets anders dan hij belooft. */
const { inTaal, kan } = require('./leerstof-taalvorm');
const { steunVoor } = require('./taalbeleid');

const VRAGEN = 3;

/* Mag deze test hier draaien, en zo nee: waarom niet. Het antwoord is altijd
   een uitleg en nooit een stille weigering -- een leerling die iets niet krijgt
   hoort te weten waarom. */
function mag(doel, taal, beleid) {
  if (!doel) return { mag: false, waarom: 'Dat leerdoel staat niet in de leerlijn.' };
  const steun = steunVoor(doel.vak, beleid);
  if (steun !== 'volledig') return { mag: false,
    waarom: 'Bij ' + doel.vak + ' is de taal zelf onderdeel van wat er gemeten wordt. Deze vergelijking hoort daar niet: ze zou de meting weghalen.' };
  if (!taal || taal === 'nl') return { mag: false, waarom: 'Er is geen tweede taal bekend voor deze leerling.' };
  return { mag: true };
}

/* De uitkomst. `nl` en `thuis` zijn tellingen van hoeveel er goed ging; er gaat
   geen enkel antwoord van een kind door deze functie heen. */
function duiding(nl, thuis, vragen) {
  const drempel = Math.ceil(vragen * 0.6);
  if (thuis >= drempel && nl < drempel) return { soort: 'taal-lijkt-relevanter',
    zin: 'In de eigen taal ging het beter. Taalondersteuning lijkt hier relevanter dan extra instructie op de stof zelf.',
    watNu: 'Dit is een aanwijzing voor een gesprek en geen conclusie over dit kind. Vraag het na voor u er iets mee doet.' };
  if (nl >= drempel && thuis >= drempel) return { soort: 'geen-verschil',
    zin: 'Het ging in beide talen goed. Er is hier geen aanwijzing dat taal in de weg zit.',
    watNu: 'Er hoeft niets te gebeuren.' };
  if (nl < drempel && thuis < drempel) return { soort: 'stof-zelf',
    zin: 'Het ging in beide talen moeilijk. Dat wijst eerder op de stof dan op de taal.',
    watNu: 'Kijk of de voorkennis onder dit leerdoel af is; daar begint het meestal.' };
  return { soort: 'onduidelijk',
    zin: 'In het Nederlands ging het beter dan in de eigen taal. Daar is uit deze vergelijking niets over te zeggen.',
    watNu: 'Laat het hierbij; een uitkomst die je niet kunt verklaren, is geen aanwijzing.' };
}

/* De opgaven voor beide rondes: DEZELFDE feiten, twee keer gesteld. Dat is het
   hele idee -- twee verschillende sommen zouden twee verschillende metingen
   zijn.

   EN ER IS EEN GEVAL WAARIN DEZE TEST NIETS KAN ZEGGEN, ook al lukt de vorm:
   als de vraag in beide talen HETZELFDE is. "7 x 7 =" heeft geen taal, dus een
   kind dat daarop struikelt struikelt niet over de zin. De vergelijking zou dan
   twee keer hetzelfde meten en er toch een conclusie uit trekken -- precies het
   soort schijnzekerheid waar deze hele paragraaf tegen bedoeld is. Dus: niets.

   Dat maakt de test smal, en terecht. Hij hoort bij opgaven die iets vertellen,
   niet bij kale sommen. */
function paren(doel, taal, maakOpgave) {
  const uit = [];
  for (let i = 0; i < VRAGEN; i++) {
    const o = maakOpgave(doel.gen);
    if (!kan(o.feit, taal)) return null;
    const thuis = inTaal(o.feit, taal);
    if (thuis === o.v) return null; // dezelfde zin: er valt niets te vergelijken
    uit.push({ a: o.a, nl: o.v, thuis, opties: o.opties || null });
  }
  return uit;
}

module.exports = { mag, duiding, paren, VRAGEN };
