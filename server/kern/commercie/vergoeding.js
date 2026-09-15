/* WAT RTG EEN PARTNER REKENT -- en waarom "commissie" hier geen woord meer is.

   DE INVARIANT, en hij is er maar een:

       De standaard partnervergoeding over omzet is NUL. Altijd.

   Dat is geen instelling, geen beginstand en geen knop op nul. Het is een
   eigenschap van het product. `partnervoorwaarden.html` art. 1 zegt het met
   zoveel woorden -- "RTG rekent geen commissie, geen transactiekosten en geen
   licentiekosten over uw omzet" -- en het is tegelijk het scherpste
   verkoopargument dat RTG heeft: Thuisbezorgd rekent 12 tot 15 procent als de
   zaak zelf bezorgt en 25 tot 35 procent met bezorging (MARKT.md, met bronnen).
   Een zaak die 100.000 euro omzet via RTG betaalt haar abonnement, en verder
   wat zij werkelijk verbruikt.

   WAT HIER STOND EN WAAROM HET WEG MOEST. Tot 20 augustus 2026 had de boardroom
   een generieke commissieknop: standaard 12 procent, per genre te zetten, tot 30
   procent, met per zaak een eigen afspraak die voorging. Drie dingen liepen daar
   mis tegelijk:

   1. De voorwaarden beloofden 0% terwijl de knop bestond. Twee schermen printten
      intussen hard "RTG-commissie EUR 0,00" -- dus het huis sprak zichzelf op
      drie manieren tegen over hetzelfde getal.
   2. Op precies EEN plek werd het tarief ook echt afgetrokken
      (kern/thuis/zakelijk.js), met een eigen terugval van 10 procent terwijl de
      standaard 12 was. Een vierde antwoord op dezelfde vraag.
   3. Een knop die overal wordt gelezen en nergens iets doet, is erger dan geen
      knop: hij ziet eruit alsof hij werkt.

   DUS: geen generieke commissie meer, en in plaats daarvan BENOEMDE
   VERGOEDINGEN. Elke euro die RTG ontvangt, hoort onder precies een van deze
   soorten te vallen, met een eigen naam op de factuur. Past een nieuw idee onder
   geen enkele, dan is dat een ontwerpvraag en geen percentage.

   ER ZIJN ER VIJF, EN DE VIJFDE HEEFT EEN ANDERE TEGENPARTIJ. De eerste vier
   gaan over een PARTNER; `rtg_operating_service` over een EXPLOITANT die RTG in
   een ander land draait. Dat staat als veld (`tegenpartij`) en niet in een naam,
   want het beslist wie er mag lezen: wie de vijfde in de partnerweigering
   meeneemt, laat een zaak lezen dat RTG haar iets rekent voor een netwerk
   waarvan zij geen gebruiker is. Hij draagt geen percentage; de rekensom staat
   in FRANCHISE.md par. 4.1a.

   Het onderscheid dat dit mogelijk maakt: een PAYMENT SERVICE FEE is een prijs
   voor een verleende dienst (het afhandelen van een betaling), een COMMISSIE is
   een aandeel in andermans omzet. Ze kunnen rekenkundig hetzelfde bedrag
   opleveren en zijn commercieel het tegenovergestelde. Wie ze allebei
   "commissie" noemt, kan het verschil nooit meer uitleggen -- niet aan een
   partner, niet aan een toezichthouder, en niet aan zichzelf. */
'use strict';

/* De invariant. Geen functie die hem kan verzetten, geen sleutel in de database
   waar hij vandaan komt. Zou hier ooit een instelling van gemaakt worden, dan
   vallen test/commercie.test.js en test/mn03-commercieelvoordeel.test.js om.
   (Hier stond `test/vergoeding.test.js`, en dat bestand bestaat niet -- een
   commentaar dat naar een niet-bestaande wacht wijst, leest als een garantie en
   is er geen.) */
const PARTNER_COMMISSIE = 0;

/* Twee waarden die iets anders betekenen dan een leeg veld. Ze staan hier als
   constante zodat een lezer ze kan vergelijken in plaats van op de spelling van
   een string te moeten vertrouwen. */
const OPEN = 'OPEN';
const NIET_ACTIEF = 'NIET ACTIEF';

/* De vier soorten. `overOmzet` is de vraag die telt: neemt deze vergoeding een
   aandeel in de omzet van de partner (dan is het een commissie, en die bestaat
   hier niet), of is het een prijs voor iets wat RTG levert? */
const SOORTEN = {
  payment_service: {
    label: 'Betaaldienst',
    wat: 'het afhandelen van een betaling via RTG Pay',
    grondslag: 'per transactie: een vaste voet plus een percentage van het bedrag',
    berekening: 'kern/commercie/fee.js, aangeroepen door kern/pay/kassa.js',
    tegenpartij: 'partner',
    overOmzet: false,
    betaaldDoor: 'de zaak',
    waar: 'kern/pay/kassa.js, direct verrekend op de partnerrekening'
  },
  marketplace_service: {
    label: 'Bemiddelingsdienst',
    wat: 'een boeking via het partnerkanaal voor niet-leden (gasten)',
    grondslag: 'een promillage over de SERVICE, nooit over de netto reissom',
    berekening: NIET_ACTIEF,
    tegenpartij: 'partner',
    overOmzet: false,
    betaaldDoor: 'de partner, uit de service die de gast betaalt',
    waar: 'kern/onderneming/regie.js + routes/member/partnerkanaal.js'
  },
  ticketing_service: {
    label: 'Ticketdienst',
    wat: 'verkoop en scan van tickets aan de deur',
    grondslag: 'per ticket, niet over de omzet van het evenement',
    berekening: NIET_ACTIEF,
    tegenpartij: 'partner',
    overOmzet: false,
    betaaldDoor: 'de organisator',
    waar: 'nog niet gebouwd'
  },
  implementation: {
    label: 'Inrichting',
    wat: 'eenmalig inrichten, migreren of koppelen',
    grondslag: 'een eenmalig bedrag, vooraf afgesproken',
    berekening: NIET_ACTIEF,
    tegenpartij: 'partner',
    overOmzet: false,
    betaaldDoor: 'de klant',
    waar: 'nog niet gebouwd'
  },

  /* DE VIJFDE, EN HIJ IS MET OPZET LEEG (besluit van de eigenaar, 15 september
     2026). Geen commissie met een ander etiket: een exploitant betaalt voor wat
     RTG Amsterdam LEVERT, dus `overOmzet: false` net als de andere vier. Juist
     daarom raakt hij de 0%-invariant niet -- die belofte gaat over de OMZET van
     een PARTNER.

     DRIE VELDEN OP OPEN IS DE HELE FUNCTIE VAN DEZE RIJ: de relatie is benoemd,
     het bedrag is niet besloten. Sterker dan een voorlopig percentage, want een
     voorlopig getal wordt de as waar de rest omheen groeit -- en dan gaat de
     eerste onenigheid met een exploitant over een getal dat niemand ooit heeft
     afgewogen. */
  rtg_operating_service: {
    label: 'Operating network',
    wat: 'de expliciete vergoeding die een RTG-exploitant aan RTG Amsterdam ' +
      'verschuldigd kan zijn voor het operating network waarvan hij gebruikmaakt: ' +
      'merk en licentie, kernsoftware, AI, security, infrastructuur, updates, ' +
      'centrale ondersteuning en andere overeengekomen centrale capabilities',
    grondslag: OPEN,
    tarief: OPEN,
    berekening: NIET_ACTIEF,
    tegenpartij: 'exploitant',
    overOmzet: false,
    betaaldDoor: 'de RTG-exploitant',
    waar: 'nergens -- er is geen berekening, en dat is de stand en geen gat'
  }
};

/* De drie standen van de vijfde, als waarde en niet als lege string. `null` zou
   hier "niet ingevuld" betekenen en dat is iets anders dan "bewust nog open":
   het eerste is een omissie, het tweede een besluit. Een lezer moet dat verschil
   kunnen zien zonder de geschiedenis te kennen. */
function isOpen(v) { return v === OPEN; }

/* WORDT DEZE VERGOEDING ERGENS UITGEREKEND? Elke soort draagt een EIGEN
   `berekening`: de plek in de code, of NIET_ACTIEF. Met opzet een veld en geen
   afleiding uit de zin in `waar` -- betekenis uit de vorm van proza halen is de
   klasse die METERKLASSE.md telt. Van de vijf staat er vandaag EEN op actief. */
function isActief(soort) {
  const s = SOORTEN[soort];
  if (!s) return false;
  return s.berekening !== NIET_ACTIEF && !isOpen(s.grondslag) && !isOpen(s.tarief);
}

/* De partnervergoeding over omzet, voor welke zaak dan ook. Neemt de zaak als
   argument omdat elke aanroeper er een heeft en het de vraag leesbaar houdt --
   maar het antwoord hangt er niet van af, en dat is het punt. */
function commissieVoor(/* zaak */) { return PARTNER_COMMISSIE; }

/* Waarom het zetten van een commissie geweigerd wordt. Een zin en geen
   foutcode: wie hier komt, zoekt iets, en hoort te lezen wat het wel is. */
function waaromGeenCommissie() {
  /* ALLEEN DE PARTNERDIENSTEN. Deze zin gaat naar een ZAAK, en de vijfde soort
     gaat over een exploitant van RTG in een ander land. Wie hem hier meeneemt,
     laat een partner lezen dat RTG haar iets rekent voor een netwerk waarvan zij
     geen gebruiker is -- en dat is precies het soort onduidelijkheid waar deze
     hele module tegen bestaat. */
  const voorPartners = Object.values(SOORTEN).filter(s => s.tegenpartij === 'partner');
  return 'RTG rekent geen commissie over de omzet van een partner; dat staat in de partnervoorwaarden en is geen instelling. ' +
    'Wat RTG wel in rekening kan brengen zijn benoemde diensten: ' +
    voorPartners.map(s => s.label.toLowerCase()).join(', ') + '.';
}

// het soortenoverzicht voor de boardroom, zonder dat er iets te zetten valt
function soorten() {
  return Object.entries(SOORTEN).map(([id, s]) => ({ id, ...s }));
}

module.exports = { PARTNER_COMMISSIE, OPEN, NIET_ACTIEF, SOORTEN, soorten,
  commissieVoor, waaromGeenCommissie, isOpen, isActief };
