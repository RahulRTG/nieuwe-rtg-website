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

   DUS: geen generieke commissie meer, en in plaats daarvan VIER BENOEMDE
   VERGOEDINGEN. Elke euro die RTG van een partner ontvangt, hoort onder precies
   een van deze soorten te vallen, met een eigen naam op de factuur. Past een
   nieuw idee onder geen enkele, dan is dat een ontwerpvraag en geen percentage.

   Het onderscheid dat dit mogelijk maakt: een PAYMENT SERVICE FEE is een prijs
   voor een verleende dienst (het afhandelen van een betaling), een COMMISSIE is
   een aandeel in andermans omzet. Ze kunnen rekenkundig hetzelfde bedrag
   opleveren en zijn commercieel het tegenovergestelde. Wie ze allebei
   "commissie" noemt, kan het verschil nooit meer uitleggen -- niet aan een
   partner, niet aan een toezichthouder, en niet aan zichzelf. */
'use strict';

/* De invariant. Geen functie die hem kan verzetten, geen sleutel in de database
   waar hij vandaan komt. Zou hier ooit een instelling van gemaakt worden, dan
   valt test/vergoeding.test.js om. */
const PARTNER_COMMISSIE = 0;

/* De vier soorten. `overOmzet` is de vraag die telt: neemt deze vergoeding een
   aandeel in de omzet van de partner (dan is het een commissie, en die bestaat
   hier niet), of is het een prijs voor iets wat RTG levert? */
const SOORTEN = {
  payment_service: {
    label: 'Betaaldienst',
    wat: 'het afhandelen van een betaling via RTG Pay',
    grondslag: 'per transactie: een vaste voet plus een percentage van het bedrag',
    overOmzet: false,
    betaaldDoor: 'de zaak',
    waar: 'kern/pay/kassa.js, direct verrekend op de partnerrekening'
  },
  marketplace_service: {
    label: 'Bemiddelingsdienst',
    wat: 'een boeking via het partnerkanaal voor niet-leden (gasten)',
    grondslag: 'een promillage over de SERVICE, nooit over de netto reissom',
    overOmzet: false,
    betaaldDoor: 'de partner, uit de service die de gast betaalt',
    waar: 'kern/onderneming/regie.js + routes/member/partnerkanaal.js'
  },
  ticketing_service: {
    label: 'Ticketdienst',
    wat: 'verkoop en scan van tickets aan de deur',
    grondslag: 'per ticket, niet over de omzet van het evenement',
    overOmzet: false,
    betaaldDoor: 'de organisator',
    waar: 'nog niet gebouwd'
  },
  implementation: {
    label: 'Inrichting',
    wat: 'eenmalig inrichten, migreren of koppelen',
    grondslag: 'een eenmalig bedrag, vooraf afgesproken',
    overOmzet: false,
    betaaldDoor: 'de klant',
    waar: 'nog niet gebouwd'
  }
};

/* De partnervergoeding over omzet, voor welke zaak dan ook. Neemt de zaak als
   argument omdat elke aanroeper er een heeft en het de vraag leesbaar houdt --
   maar het antwoord hangt er niet van af, en dat is het punt. */
function commissieVoor(/* zaak */) { return PARTNER_COMMISSIE; }

/* Waarom het zetten van een commissie geweigerd wordt. Een zin en geen
   foutcode: wie hier komt, zoekt iets, en hoort te lezen wat het wel is. */
function waaromGeenCommissie() {
  return 'RTG rekent geen commissie over de omzet van een partner; dat staat in de partnervoorwaarden en is geen instelling. ' +
    'Wat RTG wel in rekening kan brengen zijn benoemde diensten: ' +
    Object.values(SOORTEN).map(s => s.label.toLowerCase()).join(', ') + '.';
}

// het soortenoverzicht voor de boardroom, zonder dat er iets te zetten valt
function soorten() {
  return Object.entries(SOORTEN).map(([id, s]) => ({ id, ...s }));
}

module.exports = { PARTNER_COMMISSIE, SOORTEN, soorten, commissieVoor, waaromGeenCommissie };
