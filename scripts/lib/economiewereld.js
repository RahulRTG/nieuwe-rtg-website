'use strict';
/* DE ECONOMISCHE MARTELKAMER -- een gezaaide wereld die met opzet gemeen is.

   WAAROM DIT NIET DRIE NETTE BOEKINGEN ZIJN. Een doorbelastingsmeter die op
   drie rijen groen staat, bewijst dat de machine kan optellen. Wat hij moet
   bewijzen is dat zij niet gaat RADEN zodra het ingewikkeld wordt -- en
   ingewikkeld is bij een reis de normale toestand, niet het randgeval.

   WAAROM GEZAAID EN NIET PRODUCTIE. Dit is de NORM en geen waarneming.
   Productiedata is uitstekend om te zien wat RTG werkelijk verdient en
   ongeschikt als definitie van correctheid: haar samenstelling verandert
   voortdurend. Vandaag geen terugboekingen, morgen wel; vandaag geen yen,
   volgende week wel. Een regressie die alleen zichtbaar is als er toevallig een
   yen in de data zit, is geen regressietoets.

     deze wereld   deterministisch, in de keuring, norm
     productie     observerend, geen poort, de economische werkelijkheid

   Die twee worden nooit door elkaar gehaald en nooit opgeteld.

   DETERMINISTISCH BETEKENT HIER ECHT DETERMINISTISCH: geen Date.now(), geen
   Math.random(), geen id die uit een teller komt die elders al liep. Twee
   rondes op dezelfde commit geven dezelfde bytes, anders is de uitslag geen
   norm maar een momentopname.

   DE ONBEKENDE RIJEN STAAN ER MET OPZET IN. Een wereld waarin alles keurig te
   volgen is, meet de enige vraag niet die ertoe doet -- of de meter een gat
   ZIET in plaats van het dicht te rekenen. Vier rijen hier zijn niet te volgen,
   en dat hoort de uitslag te melden. */

const { geldrij } = require('../../server/kern/waarde/economischeherkomst.js');

/* De keten uit het voorbeeld van de eigenaar, uitgeschreven per euro:
   Nederlandse klant -> Spaanse exploitant -> Turks hotel -> vlucht ->
   gedeeltelijke terugbetaling -> EUR/TRY -> lokale belasting -> RTG-dienst. */
const RIJEN = [
  /* ---------- 1. de gewone pakketreis, uit elkaar gehaald ---------- */
  { bedragCenten: 100000, valuta: 'EUR', economischeHerkomst: 'lid', economischeEigenaar: 'derde',
    naarWie: 'derde', grond: 'hotelnacht bij een partnerhotel', bronObject: 'reis:pakket-1', land: 'TR' },
  { bedragCenten: 42000, valuta: 'EUR', economischeHerkomst: 'lid', economischeEigenaar: 'derde',
    naarWie: 'derde', grond: 'vlucht, ingekocht bij een luchtvaartmaatschappij', bronObject: 'reis:pakket-1', land: 'TR' },
  { bedragCenten: 18000, valuta: 'EUR', economischeHerkomst: 'lid', economischeEigenaar: 'rtg',
    naarWie: 'rtg', grond: 'samenstellen en begeleiden van de reis -- eigen dienst', bronObject: 'reis:pakket-1', land: 'NL' },
  { bedragCenten: 3800, valuta: 'EUR', economischeHerkomst: 'lid', economischeEigenaar: 'overheid',
    naarWie: 'overheid', grond: 'btw over de eigen dienst', bronObject: 'reis:pakket-1', land: 'NL' },

  /* ---------- 2. het geld dat RTG int maar niet toekomt ----------
     Dit is de rij waar `herkomst: partner` op sneuvelde: de klant betaalt, RTG
     int, het hotel is de eigenaar, en de uitkering gaat later. Drie
     verschillende partijen op een rij. */
  { bedragCenten: 55000, valuta: 'EUR', economischeHerkomst: 'lid', economischeEigenaar: 'derde',
    naarWie: 'rtg', grond: 'geïnd door RTG, komt toe aan het hotel, nog niet uitgekeerd',
    bronObject: 'reis:pakket-2', relatie: 'contract:hotel-tr-04', land: 'TR' },

  /* ---------- 3. vergoedingen en kosten ---------- */
  { bedragCenten: 1250, valuta: 'EUR', economischeHerkomst: 'zaak', economischeEigenaar: 'rtg',
    naarWie: 'rtg', grond: 'bemiddelingsdienst via het partnerkanaal', bronObject: 'boeking:gast-9' },
  { bedragCenten: 340, valuta: 'EUR', economischeHerkomst: 'lid', economischeEigenaar: 'psp',
    naarWie: 'psp', grond: 'kosten van de betaaldienstverlener', bronObject: 'betaling:p-77' },
  { bedragCenten: 2500, valuta: 'EUR', economischeHerkomst: 'zaak', economischeEigenaar: 'rtg',
    naarWie: 'rtg', grond: 'vaste inrichtingsvergoeding, eenmalig', bronObject: 'contract:inrichting-3' },

  /* ---------- 4. terugbetalingen, en ze zijn niet hetzelfde ----------
     Een GEDEELTELIJKE terugbetaling laat de rest staan; een VOLLEDIGE haalt de
     hele post weg; een TERUGBOEKING is door de bank afgedwongen en niet door
     RTG besloten. Alle drie negatief, alle drie een andere grond. */
  { bedragCenten: -20000, valuta: 'EUR', economischeHerkomst: 'derde', economischeEigenaar: 'lid',
    naarWie: 'lid', grond: 'gedeeltelijke terugbetaling: twee nachten niet geleverd', bronObject: 'reis:pakket-1' },
  { bedragCenten: -42000, valuta: 'EUR', economischeHerkomst: 'derde', economischeEigenaar: 'lid',
    naarWie: 'lid', grond: 'volledige terugbetaling van de vlucht na annulering', bronObject: 'reis:pakket-1' },
  { bedragCenten: -8900, valuta: 'EUR', economischeHerkomst: 'rtg', economischeEigenaar: 'lid',
    naarWie: 'lid', grond: 'terugboeking, afgedwongen door de bank', bronObject: 'betaling:p-81' },
  { bedragCenten: -1500, valuta: 'EUR', economischeHerkomst: 'rtg', economischeEigenaar: 'lid',
    naarWie: 'lid', grond: 'korting, toegekend door het kantoor', bronObject: 'reis:pakket-2' },

  /* ---------- 5. tegoed in plaats van geld ----------
     Een voucher is geen omzet en een cadeaubon evenmin: het is een VERPLICHTING
     tot levering. WAARDE.md houdt die twee uit elkaar van de euro's; hier
     staan ze als eigen rijen zodat zichtbaar is dat ze niet in de bijdragebasis
     horen te belanden. */
  { bedragCenten: 5000, valuta: 'EUR', economischeHerkomst: 'lid', economischeEigenaar: 'lid',
    naarWie: 'rtg', grond: 'voucher gekocht -- verplichting tot levering, geen omzet', bronObject: 'tegoed:v-12' },
  { bedragCenten: 2500, valuta: 'EUR', economischeHerkomst: 'lid', economischeEigenaar: 'lid',
    naarWie: 'rtg', grond: 'cadeaubon, nog niet ingewisseld', bronObject: 'tegoed:c-4' },
  { bedragCenten: 800, valuta: 'EUR', economischeHerkomst: 'lid', economischeEigenaar: 'derde',
    naarWie: 'derde', grond: 'fooi voor de chauffeur -- gaat volledig door', bronObject: 'rit:r-31' },

  /* ---------- 6. andere munten ----------
     De yen heeft GEEN honderdsten (kern/payroll/valuta.js). 500000 is hier dus
     vijfhonderdduizend yen en niet vijfduizend: wie deze rij bij de euro's
     optelt, telt een factor honderd mis. De meter hoort daarom te WEIGEREN te
     totaliseren zodra er meer dan een munt staat. */
  { bedragCenten: 500000, valuta: 'JPY', economischeHerkomst: 'lid', economischeEigenaar: 'derde',
    naarWie: 'derde', grond: 'ryokan in Kyoto, in yen ingekocht', bronObject: 'reis:pakket-3', land: 'JP' },
  { bedragCenten: 1850000, valuta: 'TRY', economischeHerkomst: 'lid', economischeEigenaar: 'derde',
    naarWie: 'derde', grond: 'lokale transfers in Turkije', bronObject: 'reis:pakket-1', land: 'TR' },
  { bedragCenten: 95000, valuta: 'TRY', economischeHerkomst: 'lid', economischeEigenaar: 'overheid',
    naarWie: 'overheid', grond: 'lokale verblijfsbelasting', bronObject: 'reis:pakket-1', land: 'TR' },

  /* ---------- 7. de vier die NIET te volgen zijn, en dat is de kern ----------
     Ze staan er om te toetsen of de meter een gat ZIET. Geen ervan mag naar
     `rtg` of `derde` worden geduwd. */
  { bedragCenten: 7700, valuta: 'EUR', grond: 'handmatige boeking door het kantoor, zonder tegenrekening',
    bronObject: 'journaal:j-58' },
  { bedragCenten: 4300, valuta: 'EUR', economischeHerkomst: 'lid',
    grond: 'betaald door een lid, maar aan wie dit toekomt is niet vastgelegd', bronObject: 'betaling:p-90' },
  { bedragCenten: 12000, valuta: 'EUR', economischeEigenaar: 'rtg',
    grond: 'omzet van RTG, maar wie het betaalde is uit de bron niet te halen', bronObject: 'journaal:j-61' },
  { bedragCenten: 640, valuta: 'EUR', economischeHerkomst: 'import', economischeEigenaar: 'import',
    grond: 'ingelezen uit een oud systeem; "import" is geen partij', bronObject: 'migratie:m-2' }
];

/* De wereld is bevroren: een aanroeper die een rij aanpast, verandert de norm
   voor iedereen die daarna meet. */
const wereld = () => Object.freeze(RIJEN.map(geldrij));

/* Wat deze wereld met opzet BEVAT, zodat een uitslag te lezen is zonder de
   rijen te tellen -- en zodat een toets kan zakken als er iets uit verdwijnt. */
const VERWACHT = Object.freeze({
  rijen: RIJEN.length,
  nietVolgbaar: 4,
  valuta: ['EUR', 'JPY', 'TRY'],
  negatieveRijen: 4,
  waarom: 'de vier niet-volgbare rijen staan er om te toetsen of de meter een gat ZIET ' +
    'in plaats van het dicht te rekenen; de drie valuta om te toetsen dat hij weigert te totaliseren'
});

module.exports = { wereld, VERWACHT, RIJEN };
