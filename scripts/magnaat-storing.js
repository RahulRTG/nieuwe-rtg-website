/* Magnaat-storingsmeter: is elke uitweg wel eens de goede?

   ./magnaat-balans.js meet of elke SECTOR speelbaar is, ./magnaat-pomp.js of er
   geen geld uit het niets komt. Dit script meet iets wat die twee niet zien: of
   de vier uitwegen bij een storing (../server/kern/spellen/magnaat/storing.js)
   werkelijk KEUZES zijn.

   WAAROM DAT EEN EIGEN METER VERDIENT. Een uitweg die nooit de goede is, is een
   strafknop met een uitleg eromheen -- en dat is precies wat VERHAAL.md par. 0f
   punt 1 uitsluit: beslissen moet echte kosten hebben EN echte opbrengst. Dat
   valt niet uit de code af te lezen. De eerste ronde getallen zag er in de
   tabel volstrekt redelijk uit en was in het spel onbruikbaar:

     - een OPEN storing kostte over twaalf maanden 426 euro. De storingsfactor
       zat in `dervingBasis`, en omdat `inkoop` diezelfde basis er weer aftrekt,
       hief een kapotte koeling zichzelf op. De derving op het scherm ging met
       driekwart omhoog en het resultaat bewoog geen cent;
     - UIT BEDRIJF kostte een volle zaak 28% van zijn resultaat om 6% bederf te
       vermijden, dus hij was nooit de goede;
     - REPAREREN en WORKAROUND waren allebei duurder dan niets doen.

   Geen enkele toets zag daar iets van, want elk getal klopte op zichzelf.

   DE TWEE BEWERINGEN die dit script staande houdt:

   1. EEN OPEN STORING DOET PIJN. Niets doen hoort meetbaar te kosten, anders is
      de hele laag decoratie.
   2. ELKE UITWEG OP DE VLOER IS ERGENS DE BESTE. Niet in elke zaak -- juist
      niet. `uit bedrijf` hoort fout te zijn in een zaak die tegen zijn plafond
      draait en goed in een zaak met ruimte over. Dat verschil IS de les.
   3. ERGENS KAN DE ZAAK HET BETER DAN DE VLOER. Repareren hoort in minstens een
      situatie goedkoper uit te komen dan elke noodoplossing, want anders levert
      escaleren nooit iets op. Ergens, niet overal: in een zaak met capaciteit
      over is niet vervangen ook een goed antwoord.
   4. EN GEEN ENKELE UITWEG LEVERT GELD OP. Een storing hoort nooit een
      verbetering te zijn -- dat is waarde uit het niets in de kleinste vorm, en
      ./magnaat-pomp.js ziet hem niet omdat er geen euro de wereld in komt die
      er niet uit ging.

   Draaien: node scripts/magnaat-storing.js */
'use strict';

const { kaart } = require('../server/kern/spellen/magnaat/kaart');
const STORING = require('../server/kern/spellen/magnaat/storing');

const maakMagnaat = () => require('../server/kern/spellen/magnaat/index')({
  save() {}, crypto: require('crypto'), codenaamVan: (h) => h, nudge() {}
});
const ECO = { vorm: 'economie', stad: 'IJmuiden', duur: 'weekend' };
const MAANDEN = 12;

/* Een zaak, een storing, een vaste uitweg -- en wat dat na twaalf maanden aan
   resultaat scheelt ten opzichte van dezelfde zaak zonder storing. De uitweg
   wordt ELKE maand opnieuw gezet, want een workaround vervalt en dit script
   meet de uitweg en niet de vergeetachtigheid van de speler. */
function proef(zone, omvang, stand) {
  const m = maakMagnaat();
  const p = { id: 'st', soort: 'magnaat', spelers: ['anna'], teams: [0], modus: 'vrij',
    status: 'bezig', beurt: 0, winnaar: null, variant: ECO };
  m.spel.init(p);
  p.staat.geld.anna = 5000000;
  m.eco.zet(p, 'anna', { actie: 'open',
    kavel: kaart('ijmuiden').kavels.filter(k => k.zone === zone)[0].id,
    sector: 'horeca', omvang });
  const v = p.staat.vestigingen.anna[0];
  const maand = () => { p.staat.gerekendTot -= p.staat.maandMs; m.eco.bijrekenen(p); };
  for (let i = 0; i < 3; i++) maand();      // eerst wat echte economie
  if (stand) {
    STORING.uitVoorval(v, 'machinebreuk', p.staat.maand);
    /* REPAREREN IS GEEN STAND MAAR EEN HANDELING: eenmalig geld, en daarna is
       hij weg. Hij loopt hier door dezelfde `pas()` als in het spel, want een
       meter die zijn eigen versie van de regels meerekent, meet zichzelf. */
    if (stand === 'repareren') {
      const optie = { id: 'repareren', lost: true };
      const uit = STORING.pas(v, 'koeling', optie, p.staat.maand);
      v.spoedOpen = (v.spoedOpen || 0) + uit.spoed;
      if (uit.herstel) v.onderhoud = Math.min(100, (v.onderhoud || 0) + uit.herstel);
    } else STORING.zet(v, 'koeling', stand, p.staat.maand);
  }
  let som = 0, laatste = null;
  for (let i = 0; i < MAANDEN; i++) {
    maand();
    laatste = p.staat.laatste.anna.regels.find(x => x.id === v.id);
    som += laatste.resultaat;
    if (stand && stand !== 'repareren') STORING.zet(v, 'koeling', stand, p.staat.maand);
  }
  return { som, bezetting: laatste.bezetting };
}

/* Drie zaken met een verschillende druk op hun capaciteit. Dat is de as waar
   `uit bedrijf` op draait, en dus de enige as die deze meter nodig heeft. */
const ZAKEN = [
  { naam: 'vol (boulevard, 30)', zone: 'boulevard', omvang: 30 },
  { naam: 'ruim (boulevard, 60)', zone: 'boulevard', omvang: 60 },
  { naam: 'rustig (terrein, 30)', zone: 'terrein', omvang: 30 }
];
/* DE UITWEGEN, EN ZE STAAN OP TWEE HOOGTES. Dat onderscheid is niet cosmetisch
   maar de uitkomst van deze meter zelf: zolang `repareren` ook op de werkvloer
   stond, was hij overal het beste en was de noodkoeling een knop die niemand
   ooit hoort te gebruiken. Dat is ook gewoon niet waar -- een vakkracht om tien
   uur 's avonds belt geen monteur.

     VLOER   wat je vanavond kunt doen, met de mensen die er zijn.
     ZAAK    wat er met het pand gebeurt. Kost geld, en dus kiest de zaak. */
const VLOER = ['open', 'workaround', 'uit'];
const ZAAK = ['repareren'];
const STANDEN = VLOER.concat(ZAAK);

/* Hoeveel een open storing minstens moet kosten om geen decoratie te zijn: een
   procent van wat de zaak in die twaalf maanden verdient. Laag genoeg om geen
   balansknop te worden, hoog genoeg om de fout van de eerste ronde (0,25%) te
   vangen. */
const PIJNGRENS = 0.01;

function meet() {
  const klachten = [];
  const rijen = [];
  const bestePer = {};
  for (const z of ZAKEN) {
    const gezond = proef(z.zone, z.omvang, null);
    const kost = {};
    for (const stand of STANDEN) kost[stand] = gezond.som - proef(z.zone, z.omvang, stand).som;
    rijen.push({ zaak: z.naam, bezetting: gezond.bezetting, gezond: gezond.som, kost });
    /* 1. een open storing doet pijn */
    if (kost.open < Math.abs(gezond.som) * PIJNGRENS)
      klachten.push(z.naam + ': een open storing kost maar ' + Math.round(kost.open)
        + ' op ' + Math.round(gezond.som) + ' resultaat; dat is geen storing maar decoratie');
    const beste = VLOER.slice().sort((a, b) => kost[a] - kost[b])[0];
    bestePer[beste] = (bestePer[beste] || 0) + 1;
  }
  /* 2. ELKE UITWEG OP DE VLOER IS ERGENS DE BESTE. Gemeten binnen de vloer, want
     daar staat de vakkracht voor: repareren is geen alternatief dat hij heeft.
     Zou hij het wel hebben, dan wint dat overal en is de rest decor. */
  for (const stand of ['workaround', 'uit'])
    if (!bestePer[stand])
      klachten.push('"' + stand + '" is op geen enkele vloer de beste uitweg; dan is het geen keuze maar een strafknop');
  if (bestePer.open)
    klachten.push('niets doen is in ' + bestePer.open + ' zaak/zaken de beste uitweg op de vloer');
  /* 3. ERGENS KAN DE ZAAK HET BETER DAN DE VLOER. Dat is waarom escaleren
     bestaat: je geeft het door aan iemand met een uitweg die jij niet hebt.

     ERGENS, EN NIET OVERAL -- dat was de eerste, te strenge versie. In een zaak
     met capaciteit over is de koeling gewoon niet vervangen ook een goed
     antwoord, en dan zou "repareren wint altijd" `uit bedrijf` weer tot decor
     maken. Wat hier telt is dat er MINSTENS EEN situatie is waarin geld
     uitgeven het juiste is; anders is escaleren uitstelgedrag met een knop. */
  const loont = rijen.some(r => r.kost.repareren < Math.min(...VLOER.map(s => r.kost[s])));
  if (!loont)
    klachten.push('repareren is in geen enkele zaak beter dan de beste vloeroplossing;'
      + ' dan levert escaleren nooit iets op');
  /* En een storing hoort NOOIT een verbetering te zijn, in geen enkele stand.
     Zou een uitweg geld opleveren, dan is stukgaan winstgevend -- waarde uit het
     niets in de kleinste denkbare vorm, en scripts/magnaat-pomp.js ziet hem niet
     omdat er geen euro de wereld in komt die er niet uit ging. */
  for (const r of rijen)
    for (const stand of STANDEN)
      if (r.kost[stand] < -Math.abs(r.gezond) * 0.001)
        klachten.push(r.zaak + ': "' + stand + '" LEVERT ' + Math.round(-r.kost[stand])
          + ' op; een storing hoort nooit een verbetering te zijn');
  return { rijen, klachten, bestePer };
}

if (require.main === module) {
  const { rijen, klachten } = meet();
  console.log('\nMagnaat-storingsmeter: is elke uitweg wel eens de goede?\n');
  console.log('zaak                       | bezet |    open | workaround |     uit | repareren | beste op de vloer');
  for (const r of rijen) {
    const beste = VLOER.slice().sort((a, b) => r.kost[a] - r.kost[b])[0];
    console.log(r.zaak.padEnd(26) + ' | ' + String(r.bezetting).padStart(4) + '% | '
      + STANDEN.map(s => String(Math.round(r.kost[s]))
          .padStart({ workaround: 10, repareren: 9 }[s] || 7)).join(' | ')
      + ' | ' + beste);
  }
  console.log('\n(bedragen zijn wat de storing over ' + MAANDEN
    + ' maanden aan resultaat kost; lager is beter)');
  if (klachten.length) {
    console.log('\nNIET OK:');
    for (const k of klachten) console.log('  - ' + k);
    process.exitCode = 1;
  } else {
    console.log('\nelke uitweg is ergens de beste, en niets doen is dat nergens');
  }
}

module.exports = { meet, proef, ZAKEN, STANDEN, VLOER, ZAAK, PIJNGRENS, MAANDEN };
