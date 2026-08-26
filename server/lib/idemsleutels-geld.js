/* HET IDEM-REGISTER, deel "geld" -- zelfde register, eigen bestand.

   Afgesplitst uit ./idemsleutels.js op de 10 kB-grens, en op dezelfde naad als
   ./idemsleutels-werelden.js: hiernaast staan DE REGELS (de vier vormen, het
   venster, wat dit register wel en niet is); hier staan de verklaringen van de
   geldroutes die met de samenvoegronde van augustus 2026 binnenkwamen -- de
   waardelaag van het lid, de treasury en de pre-autorisatie van de zaak, de
   bestedingsgrenzen en het terugstorten.

   WAAROM ZE HIER APART STAAN EN NIET BIJ DE REST. Deze eenentwintig lieten de
   idemschuld groeien van 4479 naar 4500, en die ratel mag alleen krimpen. Ze
   verklaren dus niet zomaar een gat: ze zijn stuk voor stuk nagelopen op wat de
   handler werkelijk doet. Vijf ervan schrijven niets -- een POST die leest --
   en dat is een BESLUIT en geen gat; de rest zet een stand of legt een bedrag
   vast, en daar is een woordelijk gelijk verzoek binnen het venster een
   dubbeltik.

   VIER ERVAN DRAGEN AL EEN EIGEN `idem` IN HUN BODY (terug, budget, vastleg,
   vooraf). Dat is de echte bescherming van de geldlaag en die blijft de baas;
   deze verklaring zegt alleen wat de POORT ervan moet vinden als de client geen
   sleutel meestuurt. Twee lagen die hetzelfde bedoelen is hier geen doublure
   maar een vangnet: de client MAG de sleutel vergeten, de kassa niet.

   Het blijft EEN register: ./idemsleutels.js voegt dit deel samen met zijn
   eigen lijst voor er ook maar iets opzoekbaar is. Lees de kop hiernaast voor
   de vormen. */
const SLEUTELS = {
  /* ---- leest alleen; herhalen is per definitie veilig ---- */
  'POST /api/geld/grens': { leest: true },
  'POST /api/office/pay/bewijs': { leest: true },
  'POST /api/pay/portefeuille': { leest: true },
  'POST /api/pay/graaf': { leest: true },
  'POST /api/pay/terugstand': { leest: true },
  'POST /api/supplier/pay/graaf': { leest: true },
  'POST /api/supplier/pay/budget/lijst': { leest: true },
  'POST /api/supplier/pay/treasury': { leest: true },
  'POST /api/supplier/pay/vooraf/lijst': { leest: true },

  /* ---- zet een stand: tweemaal hetzelfde is eenmaal die stand ---- */
  'POST /api/geld/grens/zet': { zelfdeVerzoek: true },              // de grens zelf
  'POST /api/geld/grens/weg': { velden: ['id'] },                   // welke grens weg moet
  'POST /api/pay/rekening': { zelfdeVerzoek: true },                // iban + naam
  'POST /api/office/bank/terugstorting': { zelfdeVerzoek: true },   // open of gesloten
  'POST /api/supplier/pay/treasury/zet': { zelfdeVerzoek: true },   // de inrichting

  /* ---- legt geld vast of laat het los; de handeling draagt zijn eigen id ---- */
  'POST /api/pay/terug': { zelfdeVerzoek: true },                   // bedrag + rekening
  'POST /api/supplier/pay/budget': { zelfdeVerzoek: true },         // aan wie + hoeveel
  'POST /api/supplier/pay/treasury/apart': { zelfdeVerzoek: true }, // doel + bedrag
  'POST /api/supplier/pay/treasury/vrij': { velden: ['id'] },       // welke pot vrij
  'POST /api/supplier/pay/vooraf': { zelfdeVerzoek: true },         // code + maximum
  'POST /api/supplier/pay/vastleg': { velden: ['reservering'] },    // welke reservering
  'POST /api/supplier/pay/vrijgeef': { velden: ['reservering'] },   // welke reservering
};

module.exports = { SLEUTELS };
