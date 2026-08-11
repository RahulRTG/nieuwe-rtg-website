/* Spellen (data): DE SCHOOLVRAGEN VAN HET QUIZDUEL.

   Afgesplitst van ./quiz.js, en op een naad die er al lag: dat bestand gaat
   over de REGELS van het duel (beurten, punten, teams, wie er wint) en die
   veranderen niet. Dit gaat over de LEERSTOF, en die groeit mee met de
   leerlijnen van RTG School. Twee onderwerpen met een verschillend tempo horen
   niet in een bestand.

   DIT IS GEEN TWEEDE VRAGENBANK. `kern/leerstof-data/` heeft de leerlijnen al,
   met per leerdoel een generator die verse opgaven maakt, en `leerstof-gen.js`
   maakt ze. Een eigen schoolvragenbank hiernaast zou binnen een jaar
   achterlopen op die van de school zelf -- en dan legt de quiz iets anders voor
   dan de les.

   Twee dingen zeven mee, allebei met een reden:

   1. ALLEEN DE MEERKEUZE-LEERDOELEN. Het grootste deel van de leerstof vraagt
      om een antwoord dat je intikt ('7 + 5 ='), en dat is in een oefensessie
      prima maar hier niet: een quizvraag met een enkele optie is geen vraag
      maar een knop die altijd goed is. Welke soorten opties geven staat in
      leerstof-gen.js, bij de generatoren zelf, en een toets legt die lijst
      naast wat ze werkelijk teruggeven.
   2. EEN keuzeveld en niet twee (vak en groep apart). Van alle combinaties
      bestaat maar een deel echt -- Engels begint pas in groep 7 -- dus twee
      losse lijstjes zouden een keuzerij opleveren waarin de meeste combinaties
      op een foutmelding uitlopen. Dat is een interface die je laat raden; een
      lijst met alleen wat bestaat kan niet fout.

   De WAARDE is meteen de tekst die de speler leest ('taal groep 3'). Dat
   scheelt een labellaag in het platform en, belangrijker, een client die een
   sleutel staat te ontleden om er een zin van te maken. Hier hoort de waarde
   bij een OPZOEKING en niet bij een ontleding. */
const { opgave, MEERKEUZE } = require('../leerstof-gen');
const { DOELEN } = require('../leerstof');

const STOF = new Map();
for (const d of Object.values(DOELEN)) {
  // alleen de basisschoolgroepen; het VO staat op fase en niet op groep
  if (!d.gen || !d.groep || !MEERKEUZE.includes(d.gen.soort)) continue;
  const sleutel = d.vak + ' groep ' + d.groep;
  if (!STOF.has(sleutel)) STOF.set(sleutel, []);
  STOF.get(sleutel).push(d);
}
const STOFKEUZE = [...STOF.keys()].sort();
const doelenVoor = (stof) => STOF.get(stof) || [];

function vragenVoor(stof, aantal) {
  const doelen = doelenVoor(stof);
  /* Eerst deze, en niet pas onderaan. Zonder deze regel loopt een onbekende
     stof aan op `doelen[0 % 0]`, en dat is `undefined.gen` -- een melding die
     niets zegt over wat er mis is. Langs de variantlaag kan het niet gebeuren
     (de keuze is een gesloten lijst uit deze bibliotheek), en juist daarom
     hoort de melding te kloppen als het toch gebeurt. */
  if (!doelen.length) throw new Error('quiz: geen leerstof voor "' + stof + '"');
  const uit = [];
  // rond over de leerdoelen van deze stof: bij een groep met twee doelen
  // wisselen de vragen af in plaats van tien keer hetzelfde onderwerp
  for (let poging = 0; uit.length < aantal && poging < aantal * 5; poging++) {
    const o = opgave(doelen[uit.length % doelen.length].gen);
    const j = (o.opties || []).indexOf(o.a);
    /* Een opgave zonder opties, of een waarvan het juiste antwoord er niet
       tussen staat, zou hier een vraag opleveren die NIEMAND goed kan hebben.
       Overslaan dus. Dit hoort niet te kunnen -- `MEERKEUZE` staat in
       leerstof-gen.js en een toets legt hem naast wat de generatoren
       werkelijk teruggeven -- en daarom is dit een vangnet en geen route. */
    if (j >= 0 && o.opties.length > 1) uit.push({ v: o.v, opties: o.opties, j });
  }
  /* Luid, en niet stilletjes terugvallen op de algemene bank: wie schoolstof
     koos en algemene kennis kreeg, merkt dat pas als de klas de eerste vraag
     ziet. Dat is precies de fout die de variantlaag wil uitsluiten. */
  if (uit.length < aantal) throw new Error('quiz: te weinig meerkeuzevragen voor "' + stof + '"');
  return uit;
}

module.exports = { STOFKEUZE, doelenVoor, vragenVoor };
