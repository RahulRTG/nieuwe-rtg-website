/* ============================================================================
   DE RETOURSTROOM IN BEGRIPPEN -- gronden, standen, uitkomsten en de staat van
   wat er terugkomt.

   WAAROM DIT NIEUWBOUW IS EN GEEN UITBREIDING. COMMERCE.json telt het werkwoord
   `retour` in 6 van de 100 koopbare domeinen, en geen van die zes is een
   goederenretour: `terugboeken` (kern/betaalopdracht), `terugGave` (kern/pay),
   `maakTeruggave` (kern/appstore) en de koeriersretour van kern/modebezorg --
   drie geldomkeringen en een pakket dat terugrijdt. Grondslag, inspectie,
   voorraadstand en btw-correctie bestonden nergens. Dit is dus geen tweede
   versie van iets; het is het ontbrekende stuk.

   DE STROOM HEEFT VIJF RETOURSTANDEN EN ZE ZIJN NIET INWISSELBAAR. Elke stand is een
   moment waarop iemand IETS BESLOOT, en wie dat was verschilt per stand. Dat is
   de hele reden dat het er vijf zijn en niet drie: een systeem dat "aanvaard" en
   "beoordeeld" samentrekt, kan niet meer zeggen of de verkoper het goed heeft
   gezien of alleen het verzoek.

   DRIE DINGEN DIE HIER MET OPZET NIET STAAN.

   1. GEEN OORDEEL OVER DE GROND VAN DE KOPER. De koper kiest een grond uit deze
      lijst; RTG weegt hem niet en zet er geen betrouwbaarheid op. Wie oordeelt
      is de verkoper, en dat doet hij in stand `aanvaard`.
   2. GEEN AUTOMATISCHE UITKOMST. Geen enkele grond leidt vanzelf tot geld terug,
      ook `verkeerd-geleverd` niet. GELD.md par. 3: geld verlaat het huis nooit
      vanzelf, ook niet als de richting sympathiek is -- dezelfde afweging die
      kern/appstore/teruggave.js maakt.
   3. GEEN SCORE OP MENSEN. Niet op kopers die vaak terugsturen en niet op
      verkopers die vaak afwijzen. CLAUDE.md verbiedt ranglijsten buiten het
      potje, en een retourpercentage naast een naam is precies zo'n ranglijst.
   ========================================================================== */
'use strict';

const G = (id, label, wat, wie) => ({ id, label, wat, wie });

/* DE GRONDEN. Gesloten lijst en geen vrij tekstveld -- dezelfde reden als de
   doelen in kern/appstore/machtigingen.js: vrije tekst levert "voldoet niet aan
   de verwachting" op, en dat is niet te vergelijken, niet te doorzoeken en niet
   te toetsen. Een toelichting MAG erbij, maar de grond zelf is een keuze.

   `wie` zegt wie de grond aanvoert. Dat is bijna altijd de koper; bij
   `verkeerd-geleverd` en `beschadigd-aangekomen` kan ook de verkoper hem
   aanvoeren, want die ontdekt het soms eerder dan de koper. */
const GRONDEN = [
  G('bedenktijd', 'Op andere gedachten',
    'de koper heeft binnen de termijn spijt; geen gebrek aan het goed', 'koper'),
  G('niet-zoals-beschreven', 'Niet zoals beschreven',
    'het geleverde wijkt af van wat er op de pagina stond', 'koper'),
  G('defect', 'Kapot of werkt niet',
    'het goed doet niet wat het hoort te doen', 'koper'),
  G('beschadigd-aangekomen', 'Beschadigd aangekomen',
    'onderweg beschadigd; raakt de bezorging en niet het goed zelf', 'beide'),
  G('verkeerd-geleverd', 'Verkeerd geleverd',
    'er is iets anders gekomen dan besteld', 'beide'),
  G('te-laat', 'Te laat gekomen',
    'geleverd na het moment waarop het nog nut had', 'koper')
];

/* DE RETOURSTANDEN, in de enige volgorde waarin ze kunnen voorkomen. `door` zegt wie
   de stand zet -- en dat is het belangrijkste veld van deze tabel: RTG staat er
   nergens bij. */
const RETOURSTANDEN = [
  { id: 'gevraagd', label: 'Aangevraagd', door: 'koper',
    wat: 'de koper vraagt om terug te sturen, met een grond' },
  { id: 'aanvaard', label: 'Aanvaard', door: 'verkoper',
    wat: 'de verkoper neemt het terug; hier legt hij ook zijn eigen orderkenmerk vast' },
  { id: 'onderweg', label: 'Onderweg terug', door: 'koper',
    wat: 'de koper heeft het verstuurd of ingeleverd' },
  { id: 'beoordeeld', label: 'Beoordeeld', door: 'verkoper',
    wat: 'de verkoper heeft het gezien en noteert de staat' },
  { id: 'afgehandeld', label: 'Afgehandeld', door: 'verkoper',
    wat: 'de uitkomst staat vast en het geldbesluit is KLAARGEZET' },
  { id: 'afgewezen', label: 'Afgewezen', door: 'verkoper',
    wat: 'de verkoper neemt het niet terug, met een reden' },
  { id: 'vervallen', label: 'Vervallen', door: 'termijn',
    wat: 'er is te lang niets gebeurd; de aanvraag is verlopen' }
];

/* Welke stand na welke mag komen. Een tabel en geen reeks `if`s, zodat een
   verboden sprong niet ergens anders alsnog mogelijk is. `afgehandeld`,
   `afgewezen` en `vervallen` zijn eindstanden en hebben dus een lege lijst. */
const NA = {
  gevraagd: ['aanvaard', 'afgewezen', 'vervallen'],
  aanvaard: ['onderweg', 'afgewezen', 'vervallen'],
  onderweg: ['beoordeeld', 'vervallen'],
  beoordeeld: ['afgehandeld'],
  afgehandeld: [],
  afgewezen: [],
  vervallen: []
};

/* DE STAAT waarin het terugkomt. Bepaalt niet de uitkomst -- dat doet de
   verkoper -- maar wel of het terug in de voorraad KAN. Dat laatste is een
   feitelijke vraag en de eerste niet. */
const STAAT = [
  { id: 'ongebruikt', label: 'Ongebruikt', terugInVoorraad: true },
  { id: 'gebruikt', label: 'Gebruikt maar heel', terugInVoorraad: false },
  { id: 'beschadigd', label: 'Beschadigd', terugInVoorraad: false },
  { id: 'incompleet', label: 'Niet compleet', terugInVoorraad: false },
  { id: 'niet-ontvangen', label: 'Nooit aangekomen', terugInVoorraad: false }
];

/* DE UITKOMSTEN. `geldTerug` zegt of er geld MOET bewegen; dat betekent hier
   uitdrukkelijk KLAARZETTEN en niet boeken -- zie de kop en ./retour.js. */
const UITKOMSTEN = [
  { id: 'geld-terug', label: 'Geld terug', geldTerug: true,
    wat: 'het betaalde bedrag gaat terug naar de koper' },
  { id: 'deels-terug', label: 'Deels terug', geldTerug: true,
    wat: 'een deel gaat terug; de verkoper noemt het bedrag en de reden' },
  { id: 'tegoed', label: 'Tegoed bij deze verkoper', geldTerug: false,
    wat: 'geen geld terug maar besteedbaar tegoed; loopt via kern/waarde' },
  { id: 'vervanging', label: 'Vervanging', geldTerug: false,
    wat: 'de verkoper stuurt hetzelfde nog een keer' },
  { id: 'reparatie', label: 'Reparatie', geldTerug: false,
    wat: 'de verkoper maakt het en stuurt het terug' },
  { id: 'niets', label: 'Geen tegemoetkoming', geldTerug: false,
    wat: 'de verkoper komt niet tegemoet, met een reden' }
];

/* WAT ER MET OPZET NIET IS. Zelfde vorm als NIET_GEBOUWD in
   ./werkwoordlijst.js: geen wensenlijst maar het antwoord dat een aanroeper
   krijgt, zodat niemand hoeft te raden waarom iets niet kan. */
const NIET_GEBOUWD = {
  'ruilen-tegen-ander-artikel': 'Ruilen tegen iets ANDERS is een retour en een nieuwe koop in een handeling, met twee verschillende bewijsmomenten. `vervanging` (hetzelfde nog een keer) bestaat wel; een ander artikel koopt de koper gewoon.',
  'retourlabel': 'Een verzendlabel aanmaken vraagt een koppeling met een vervoerder op naam van de VERKOPER. kern/modebezorg rijdt eigen koeriers; een extern label is een andere afspraak en die staat er niet.',
  'automatisch-terugboeken': 'Nooit. Een uitkomst zet een geldbesluit KLAAR; een mens voert het uit. GELD.md par. 3.',
  'retourpercentage': 'Een getal naast een koper of een verkoper is een ranglijst op mensen. CLAUDE.md verbiedt dat, en een retourpercentage is geen uitzondering.'
};

const opId = (lijst) => new Map(lijst.map(x => [x.id, x]));
const GROND = opId(GRONDEN), RETOURSTAND = opId(RETOURSTANDEN), STAATOP = opId(STAAT), UITKOMST = opId(UITKOMSTEN);
const EINDSTANDEN = RETOURSTANDEN.filter(s => !NA[s.id].length).map(s => s.id);

module.exports = { GRONDEN, RETOURSTANDEN, NA, STAAT, UITKOMSTEN, NIET_GEBOUWD,
  GROND, RETOURSTAND, STAATOP, UITKOMST, EINDSTANDEN };
