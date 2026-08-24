/* Functiecatalogus, deel "geld": de schakelaars van RTG Bank en de wallet.

   Een eigen bestand, en niet alleen omdat cat-domeinen2 door de 10 KB ging. De
   bank stond hier als EEN regel (`paden: ['/api/bank']`), en dat was te grof:
   uitgaven tonen is rekenen op eigen gegevens, geld het land uit sturen is een
   betaaldienst verrichten. In een schakelaar kun je het eerste niet uitbouwen
   zonder het tweede te suggereren.

   Elke regel draagt daarom het VERMOGEN dat hij vraagt (kern/bevoegdheid.js).
   Langste prefix wint in functieVoorPad, dus '/api/bank/sepa' pakt zijn eigen
   regel en al het overige valt terug op 'dom-rekening'. Die terugval is met
   opzet: een nieuwe bankroute is dan geschakeld zoals de bank en niet
   ongeschakeld. */
const { LEDEN } = require('./doelgroepen');
const LEDEN_GAST = ['rtg', 'lifestyle', 'business', 'gast'];

module.exports = [
  { id: 'dom-rekening', categorie: 'Geld', naam: 'RTG Rekening', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Saldo, afschriften en betalingen op de eigen rekeninglaag.', paden: ['/api/bank'],
    vermogen: 'BANK_SCHERM' },
  { id: 'dom-bank-inzicht', categorie: 'Geld', naam: 'Uitgaven-inzichten', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Uitgaven per maand en per soort, en het gezamenlijke afschrift.', paden: ['/api/bank/inzichten', '/api/bank/hart'],
    vermogen: 'INZICHTEN' },
  { id: 'dom-bank-vastelasten', categorie: 'Geld', naam: 'Vaste-lasten-radar', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Terugkerende afschrijvingen die vanzelf worden herkend.', paden: ['/api/bank/vastelasten'],
    vermogen: 'BUDGETTEREN' },
  { id: 'dom-bank-spaardoel', categorie: 'Geld', naam: 'Spaardoelen', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Een streefbedrag op een spaarrekening, en het wisselgeld erheen vegen.', paden: ['/api/bank/spaardoel', '/api/bank/veeg'],
    vermogen: 'SPAARDOELEN' },
  { id: 'dom-bank-rekening-open', categorie: 'Geld', naam: 'Rekeningen aanhouden', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Een eigen betaal-, spaar- of zakelijke rekening met een IBAN.', paden: ['/api/bank/rekening'],
    vermogen: 'REKENING_HOUDEN' },
  { id: 'dom-bank-storten', categorie: 'Geld', naam: 'Storten op de rekening', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Geld op de eigen rekening zetten, via de kaart-naad of eigen emissie.', paden: ['/api/bank/storten'],
    vermogen: 'KLANTGELD' },
  { id: 'dom-bank-sepa', categorie: 'Geld', naam: 'SEPA versturen', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Een overboeking naar een rekening buiten RTG.', paden: ['/api/bank/sepa'],
    vermogen: 'SEPA_UIT' },
  { id: 'dom-bank-incasso', categorie: 'Geld', naam: 'Terugkerende betalingen', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Een vaste overboeking per week of maand.', paden: ['/api/bank/terugkerend'],
    vermogen: 'INCASSO' },
  { id: 'dom-bank-passen', categorie: 'Geld', naam: 'Passen en creditcards', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Een betaalpas of creditcard op een rekening, met limiet.', paden: ['/api/bank/pas', '/api/bank/passen'],
    vermogen: 'PAS_UITGIFTE' },
  { id: 'dom-bank-krediet', categorie: 'Geld', naam: 'Krediet en leningen', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Een lening aanvragen en aflossen; rood staan valt hier ook onder.', paden: ['/api/bank/krediet'],
    vermogen: 'KREDIET_EIGEN_BOEK' },
  { id: 'dom-bank-zakelijk', categorie: 'Geld', naam: 'Zakelijk bankieren', standaard: true, doelgroepen: ['business'],
    uitleg: 'Bulkbetalingen en de salarisrun vanaf een zakelijke rekening.', paden: ['/api/bank/bulk', '/api/bank/salaris'],
    vermogen: 'SEPA_UIT' },
  { id: 'dom-bank-advies', categorie: 'Geld', naam: 'De AI-bankier', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Rahul kijkt mee met de rekeningen en geeft advies; hij besluit niets.', paden: ['/api/bank/advies'],
    vermogen: 'INZICHTEN' },
  { id: 'dom-wallet', categorie: 'Geld', naam: 'Wallet', standaard: true, doelgroepen: LEDEN_GAST,
    uitleg: 'De wallet van een lid binnen RTG Pay.', paden: ['/api/wallet'],
    vermogen: 'WALLET_SALDO' },
  /* De wallet-handelingen zelf staan met hun VOLLEDIGE pad in de lijst en niet
     als '/api/pay'. Dat laatste zou gelijk lang zijn als het pad van de
     bestaande schakelaar 'betalen' (cat-partners), en bij gelijke lengte wint
     wie het eerst in de catalogus staat -- een volgorde-afhankelijkheid die je
     pas merkt als iemand de bestanden herschikt. Wat hier niet staat blijft
     dus gewoon onder 'betalen' vallen, precies zoals voorheen. */
  { id: 'dom-pay-wallet', categorie: 'Geld', naam: 'Walletsaldo en betalen binnen RTG', standaard: true, doelgroepen: LEDEN_GAST,
    uitleg: 'Saldo aanhouden, opladen, tikken en betaalverzoeken binnen het gesloten RTG-circuit.',
    paden: ['/api/pay/overzicht', '/api/pay/oplaad', '/api/pay/stuur', '/api/pay/verzoek', '/api/pay/tik', '/api/pay/tikcode', '/api/pay/tiks', '/api/pay/kascode'],
    vermogen: 'WALLET_SALDO' },
  /* De partneruitbetaling hoort aan DEZELFDE partnerrail als de bank-SEPA, en
     dat was hij niet: de boardroom kon de sepa-rail uitzetten, waarna de bank
     stopte met overboeken terwijl partners gewoon doorbetaald werden. Een rail
     die half uit staat is geen rail die uit staat. */
  /* DE TERUGSTORTING. Een eigen regel en niet onder 'dom-pay-wallet', want het
     is een ander vermogen: saldo AANHOUDEN (WALLET_SALDO, de rekeningen-rail)
     en saldo TERUGBETALEN (LID_UITBETALING, de sepa-rail) horen apart te kunnen
     sluiten. Valt de uitbetaalrail weg, dan hoort de wallet gewoon te blijven
     werken -- betalen binnen RTG heeft er niets mee te maken.

     `/rekening` staat erbij: dat verplaatst geen geld, maar het zet wel de
     bestemming klaar. Een bestemming kunnen wijzigen terwijl er niets heen kan,
     is een knop die belooft wat hij niet waarmaakt. */
  { id: 'dom-pay-terug', categorie: 'Geld', naam: 'Saldo terugstorten naar het lid', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Het eigen walletsaldo terugstorten naar de eigen bankrekening.',
    paden: ['/api/pay/terug', '/api/pay/terugstand', '/api/pay/rekening'],
    vermogen: 'LID_UITBETALING' },
  /* De pre-autorisatie hangt aan WALLET_SALDO en niet aan de kassa-schakelaar:
     wat hier gebeurt is dat een deel van het WALLETSALDO VAN EEN LID wordt
     vastgezet. Valt de grond onder dat besluit weg, dan hoort dit mee te
     vallen -- vastzetten is dan net zo goed klantgeld aanhouden als saldo
     aanhouden, alleen met een zaak die erop wacht. */
  { id: 'dom-pay-vooraf', categorie: 'Geld', naam: 'Vooraf vastzetten aan de kassa', standaard: true, doelgroepen: ['leverancier'],
    uitleg: 'Een zaak zet een maximum vast op de code van een lid (borg, open rekening, ritprijs) en legt later het werkelijke bedrag vast.',
    paden: ['/api/supplier/pay/vooraf', '/api/supplier/pay/vastleg', '/api/supplier/pay/vrijgeef'],
    vermogen: 'WALLET_SALDO' },
  { id: 'dom-partner-uitbetaling', categorie: 'Geld', naam: 'Partnersaldo uitbetalen', standaard: true, doelgroepen: ['leverancier'],
    uitleg: 'Het RTG Pay-saldo van een zaak naar zijn bankrekening sturen.', paden: ['/api/supplier/pay/uitbetaal'],
    vermogen: 'PARTNER_UITBETALING' }
];
