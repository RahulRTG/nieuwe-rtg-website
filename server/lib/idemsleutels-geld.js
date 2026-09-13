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

   DE TOETSVRAAG DIE HIER ALLES BESLIST, en zij is drie keer met schade geleerd:
   krijgt een woordelijk gelijke HERHALING een ANDER antwoord dan de eerste keer?
   Zo ja, dan mag de poort niets doen. Een geldlaag zit vol met zulke tweede
   antwoorden -- "dat staat al geparkeerd", "daar zit nog een bedenktijd op",
   "die rekening kan nog niet ontvangen" -- en dat zijn juist de antwoorden die
   een mens moet zien. Een poort die er het eerste "gelukt" overheen legt, maakt
   van een weigering een bevestiging, en dat is erger dan de dubbele boeking die
   hij voorkomt (zie de kop van ./idem-poort.js, die dit al zei).

   Drie routes zijn er hier op betrapt: /api/pay/terug (de wachttijd op een
   gewijzigd IBAN), /api/office/bank/terugstorting (een teruggezette stand) en
   /api/geld/grens/weg (de bedenktijd op een versoepeling). Alle drie zetten ze
   een BEVEILIGING uit, en alle drie zijn ze door een bestaande toets gevangen.

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
  'POST /api/supplier/pay/treasury/zet': { zelfdeVerzoek: true },   // de inrichting

  /* De correctie van een betaalde factuur (kern/factuurcorrectie.js): een
     dubbeltik is een herhaling, meer heeft de poort hier niet te doen.

     HIER STOND EERST `velden: ['userId', 'invoiceId']`, en dat was verleidelijk
     en fout. De gedachte was goed -- het lid en de factuur bepalen de handeling,
     `grond` en `reden` zijn vrije invoer -- maar de poort leidt uit die velden
     een SLEUTEL af en vergelijkt daarna het hele verzoek: een tweede correctie
     op dezelfde factuur met een andere grond werd daarmee "dezelfde sleutel,
     ander verzoek" en kreeg 409 "Deze idem-sleutel is al gebruikt voor een ander
     verzoek". Dat is niet onwaar, maar het VERDRINGT het antwoord dat de route
     zelf geeft en dat veel bruikbaarder is: 200 met `herhaald: true` en de
     bestaande correctieregel erbij. De poort hoorde hier dus niet slimmer te
     zijn dan de route. Nagemeten met test/factuurcorrectie.test.js toets 7.

     De route beschermt zichzelf al twee keer -- een toestandscontrole op
     `inv.correcties` en een idem-sleutel uit het factuurnummer die de aanroeper
     niet kan zetten. Deze regel is de derde en de goedkoopste, en hij is er
     vooral omdat de VERKLARING hoort te bestaan: een schrijfroute zonder
     verklaring is een gat, ook als hij toevallig veilig is. */
  'POST /api/office/pay/factuurcorrectie': { zelfdeVerzoek: true },

  /* ---- laat los; de handeling is haar eigen id ---- */
  'POST /api/supplier/pay/treasury/apart': { zelfdeVerzoek: true }, // doel + bedrag
  'POST /api/supplier/pay/treasury/vrij': { velden: ['id'] },       // welke pot vrij
  'POST /api/supplier/pay/vrijgeef': { velden: ['reservering'] },   // welke reservering

  /* ---- DE ROUTES MET EEN EIGEN SLEUTEL, en dit is de belangrijkste alinea van
     dit bestand. Ze dragen `idem` in hun body -- en `idem` staat in
     BUITEN_AFDRUK (./idem-kast.js), dus de poort ziet juist het veld NIET dat
     twee verzoeken uit elkaar houdt. Voor hem zijn twee bewuste terugstortingen
     van tien euro hetzelfde verzoek, en dan speelt hij het eerste antwoord
     terug.

     Dat is geen doublure maar een gat, en het is hier gemeten: met
     `zelfdeVerzoek` op /api/pay/terug kwam een 200 van een eerdere terugstorting
     terug op een verzoek dat 409 hoorde te zijn -- de wachttijd na een gewijzigd
     IBAN, precies de maatregel die een accountovername moet stoppen. Twee
     toetsen in payterug.test.js vielen erover, en op main staan ze groen.

     De poort hoort hier dus NIETS te doen. De eigen sleutel van de route is de
     bescherming, en die is fijner dan wat de poort kan zien. */
  'POST /api/pay/terug': { nietIdempotent: true,
    waarom: 'de route draagt een eigen idem-sleutel; twee terugstortingen van hetzelfde bedrag met een ANDERE sleutel zijn twee bewuste opdrachten, en de poort ziet die sleutel niet' },
  'POST /api/supplier/pay/budget': { nietIdempotent: true,
    waarom: 'eigen idem-sleutel; twee gelijke budgetten met een andere sleutel zijn twee toekenningen' },
  'POST /api/supplier/pay/vooraf': { nietIdempotent: true,
    waarom: 'eigen idem-sleutel; twee pre-autorisaties op dezelfde code zijn twee reserveringen' },
  'POST /api/supplier/pay/vastleg': { nietIdempotent: true,
    waarom: 'eigen idem-sleutel; een tweede vastlegging hoort de weigering van de kern te krijgen en niet het antwoord van de eerste' },

  /* En het zetten van een rekening: een herhaling ZET DE KLOK OPNIEUW, dus zij
     heeft een ander gevolg dan de eerste. Samenvouwen zou "terugzetten naar het
     oude IBAN" gratis maken -- de omweg waar de wachttijd juist voor is. */
  /* En de terugstortstand van de bank, om nog een andere reden. Zij MAAKT niets
     -- zij zet een schakelaar -- dus een dubbeltik is uit zichzelf al ongevaarlijk
     en de poort wint er niets. Maar hij kan wel verliezen: gesloten, open, weer
     gesloten binnen het venster is drie bewuste zetten, en de derde zou als
     herhaling van de eerste worden weggevouwen. Dan blijft de stand op `open`
     staan terwijl de boardroom `gesloten` las, en de auditregel die de route bij
     `r.ok` schrijft komt er ook niet -- juist bij de knop die niet regelt wat RTG
     doet maar wat RTG JURIDISCH IS. De andere zetters hierboven mogen wel
     samenvouwen: die MAKEN iets bij een dubbeltik (grensZet zonder id legt een
     tweede grens aan), en dat is de schade die de poort hoort te voorkomen. */
  'POST /api/office/bank/terugstorting': { nietIdempotent: true,
    waarom: 'een herhaalde zet is een bewuste zet: terugzetten binnen het venster zou stil verdwijnen, samen met de auditregel eronder' },

  /* En het weggooien van een grens, om de derde variant van dezelfde reden. Een
     grens met bedenktijd verdwijnt niet meteen: de eerste poging PARKEERT hem en
     antwoordt 200 met een wachtTot, de tweede hoort 409 te krijgen -- "nog een
     keer proberen versnelt niets". Met `velden: ['id']` kwam de 200 van de
     eerste terug, en dan is de bedenktijd te omzeilen door twee keer te drukken.
     Precies de omweg waar die toets over gaat. */
  'POST /api/geld/grens/weg': { nietIdempotent: true,
    waarom: 'een tweede poging hoort de 409 van de bedenktijd te krijgen en niet de 200 van de eerste; anders is de bedenktijd met een dubbeltik weg' },

  'POST /api/pay/rekening': { nietIdempotent: true,
    waarom: 'een herhaalde rekeningwijziging start de wachttijd opnieuw; samenvouwen zou terugzetten naar een oud IBAN de wachttijd laten omzeilen' },
  /* Dezelfde handler (kern/pay/zaakrekening.js) achter de deur van de zaak, dus
     dezelfde reden -- en niet overgetypt: het contract in
     ./mutatiecontracten-samenvoeging.js leest hem hier. */
  'POST /api/supplier/pay/rekening': { nietIdempotent: true,
    waarom: 'een herhaalde rekeningwijziging start de wachttijd opnieuw; samenvouwen zou terugzetten naar een oud IBAN de wachttijd laten omzeilen' },
};

module.exports = { SLEUTELS };
