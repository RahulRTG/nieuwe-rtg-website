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
    uitleg: 'De wallet van een lid binnen RTG Pay.', paden: ['/api/wallet'] }
];
