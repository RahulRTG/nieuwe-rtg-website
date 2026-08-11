/* Magnaat: DE AI-CONCURRENT -- een tegenspeler die bijstuurt.

   WAT HIJ NIET IS. Geen tweede motor, geen bot met een eigen tarievenlijst, en
   geen tegenstander die de staat leest. Hij is een SPELER: hij krijgt hetzelfde
   scherm als jij (`zicht`) en handelt door dezelfde `ACTIES`. Dat is dezelfde
   wet als bij de AI-manager, en om dezelfde reden -- een tegenstander die meer
   ziet dan jij is geen tegenstander maar een handicap, en hij is niet te
   verslaan met beter spelen maar alleen met meer geluk.

   WAT LEREN HIER BETEKENT, en dat is bewust smal. Hij traint geen model en hij
   onthoudt niets tussen partijen; hij KIJKT NAAR ZIJN EIGEN CIJFERS en verzet
   zijn koers als die tegenvallen. Dat is wat een ondernemer doet en het is
   precies zo veel "leren" als een spel nodig heeft:

     - loopt zijn omzet achter op wat hij ervoor betaalt, dan schuift hij op van
       GROEIEN naar VERBETEREN;
     - raakt de kaart vol, dan houdt groeien vanzelf op en gaat hij onderzoeken;
     - ziet hij een recessie aankomen (de krant is publiek), dan houdt hij kas
       aan in plaats van te bouwen;
     - draaien zijn zaken structureel te vol of te leeg, dan verzet hij zijn
       prijsstand.

   HIJ IS DETERMINISTISCH. Geen `Math.random()`: elke keuze volgt uit wat hij op
   zijn scherm ziet, en dat volgt uit de staat. Tien maanden in een keer geven
   dezelfde partij als tien maanden los -- de eis onder GAMEHALL.md 12.4. Waar
   hij toch moet kiezen tussen gelijkwaardige dingen (welk kavel), kiest hij met
   de hash, net als de rest van deze map.

   HIJ SPEELT NIET PERFECT, en dat is een besluit. Een tegenstander die alles
   optimaal doet is geen tegenstander maar een puzzel met een oplossing. Hij
   heeft een KOERS, hij stuurt bij, en hij laat dingen liggen -- zoals iedereen.

   DE KOERS IS ZICHTBAAR. Wie tegen hem speelt hoort te kunnen zien welke kant
   hij op gaat -- dat staat ook in de krant als je erop let: waar hij bouwt, wat
   hij aanbiedt. Een tegenstander wiens plan onkenbaar is, is ruis. */
const { trek } = require('./risico');

/* DE KOERSEN. Elke koers is een ANDERE ANTWOORD op dezelfde vraag: waar gaat de
   volgende euro heen? Meer dan drie zou betekenen dat het verschil tussen twee
   koersen niet meer te zien is aan wat hij doet. */
const KOERSEN = {
  groeien: { naam: 'Groeien', uitleg: 'Kavels innemen zolang ze er zijn.' },
  verbeteren: { naam: 'Verbeteren', uitleg: 'Wat er staat beter laten draaien.' },
  sparen: { naam: 'Sparen', uitleg: 'Kas aanhouden tot het weer meezit.' }
};
const KOERSLIJST = Object.keys(KOERSEN);

/* Wanneer hij van koers wisselt. Alle drempels zijn te lezen op zijn eigen
   scherm; er zit niets bij dat een mens niet ook zou zien. */
const DREMPEL = {
  vol: 0.8,          // zoveel van de kavels in zijn zones bezet -> groeien houdt op
  krap: 2,           // minder dan zoveel maanden vaste lasten in kas -> sparen
  ruim: 6,           // meer dan zoveel -> weer durven
  slecht: 0          // een maandresultaat onder dit -> verbeteren in plaats van groeien
};

/* WAT HIJ ZIET EN WAT HIJ DAARUIT CONCLUDEERT. Alles uit `beeld`, dus alles wat
   een mens ook heeft. Dit is de hele "leerstap": geen model, wel een oordeel. */
function lezen(beeld) {
  const zaken = beeld.vestigingen || [];
  const maandlast = zaken.reduce((n, v) => n + (v.huur || 0) + (v.marketing || 0)
    + (v.onderhoudBudget || 0), 0) + (beeld.concern ? beeld.concern.totaal : 0);
  const laatste = (beeld.laatste || {}).regels || [];
  const resultaat = laatste.reduce((n, r) => n + (r.resultaat || 0), 0);
  const cyclus = beeld.cyclus || {};
  return {
    zaken: zaken.length,
    kasmaanden: maandlast > 0 ? beeld.geld / maandlast : 99,
    resultaat,
    /* KOMT ER SLECHT WEER AAN? De krant is publiek en zegt hoeveel maanden de
       fase nog duurt en wat er hierna komt -- daar mag hij op vooruitlopen, en
       een mens net zo goed. */
    slechtWeerOpKomst: cyclus.hierna ? cyclus.hierna.vraag < 1 && (cyclus.nog || 99) <= 3 : false,
    inRecessie: cyclus.fase === 'recessie',
    gemist: laatste.reduce((n, r) => n + (r.gemist || 0), 0),
    bezetting: zaken.length
      ? laatste.filter(r => r.bezetting !== undefined)
        .reduce((n, r) => n + r.bezetting, 0) / Math.max(1, laatste.filter(r => r.bezetting !== undefined).length)
      : 0
  };
}

/* DE KOERS VOOR DEZE MAAND, uit wat hij ziet. Een zuivere functie: dezelfde
   waarneming geeft dezelfde koers, en daarmee is de hele tegenstander
   deterministisch zonder dat er iets bewaard hoeft te worden. */
function koersVan(gelezen, volDeel) {
  /* SPAREN GELDT ALLEEN ALS JE IETS TE BESCHERMEN HEBT, en dat is een correctie
     op een AI die kon vastlopen. Met een krappe kas ging hij sparen; door te
     sparen bouwde hij niet; door niet te bouwen verdiende hij niets; en dus
     bleef zijn kas krap. In een van de campagnes stond hij na zesendertig
     maanden op EEN zaak en een negatieve rekening -- niet omdat hij verkeerd
     koos maar omdat hij nooit meer aan een tweede keuze toekwam.

     Wie een of geen zaak heeft, heeft geen portefeuille om te verdedigen; het
     risico is dan niet dat hij omvalt maar dat hij nooit begint. */
  const kwetsbaar = gelezen.zaken >= 2;
  if (kwetsbaar && gelezen.kasmaanden < DREMPEL.krap) return 'sparen';
  if (kwetsbaar && gelezen.inRecessie && gelezen.kasmaanden < DREMPEL.ruim) return 'sparen';
  if (kwetsbaar && gelezen.slechtWeerOpKomst) return 'sparen';
  if (volDeel >= DREMPEL.vol) return 'verbeteren';
  if (gelezen.zaken > 0 && gelezen.resultaat < DREMPEL.slecht) return 'verbeteren';
  return 'groeien';
}

/* Een keuze tussen gelijkwaardige dingen, deterministisch. Dezelfde truc als
   overal in deze map: uit de hash en niet uit een dobbelsteen. */
const kies = (rij, sleutel) => (rij.length
  ? rij[Math.min(rij.length - 1, Math.floor(trek(sleutel) * rij.length))] : null);

module.exports = { KOERSEN, KOERSLIJST, DREMPEL, lezen, koersVan, kies };
