/* WAT ER OPEN BLIJFT, WAT ER OOK GEBEURT -- en waarom precies dat.

   ./leesset.js sluit onder isolatie alles waarvan het lezerschap niet is
   BEWEZEN. Dat is de goede regel, en hij heeft twee uitzonderingen die geen
   uitzondering op de veiligheid zijn maar op de MEETMETHODE: paden die om een
   andere reden open horen te blijven dan omdat de proef ze toevallig heeft
   gemeten.

   Ze staan hier samen omdat ze dezelfde vorm hebben -- een genoemde lijst met per
   regel een grond -- en met opzet niet als patroon. Een patroon als
   /api/privacy/ zou elke toekomstige route van dat domein automatisch
   vrijstellen, en juist hier hoort elke vrijstelling een besluit te zijn dat
   iemand heeft genomen.

   ---------------------------------------------------------------------------
   1. DE UITGANG VAN DE STAND ZELF.

   Gemeten en niet bedacht: kern/isolatie/bruikbaarheid.js liet zien dat onder
   `isolatie` de verhalen `zelf-beschermen` en `ontsluiten-aanvragen` op "werkt
   niet" stonden. De routes van deze laag zijn nieuw, dus de proef heeft ze nooit
   gemeten, dus de leesset sloot ze -- en dan kan een mens die in isolatie staat
   zichzelf niet meer beschermen en er ook niet meer uit.

   Een stand zonder uitgang is een val, en een val zet niemand aan.

   ---------------------------------------------------------------------------
   2. WAT EEN MENS OVER ZICHZELF MAG.

   Zes paden zonder functie in de catalogus bleken data-subject-rechten: inzage,
   uitdraai, het inzagejournaal en het intrekken van toestemming. Die horen niet
   dicht te vallen omdat er een incident loopt, en om twee redenen die allebei
   op zichzelf genoeg zijn.

   JURIDISCH: een AVG-recht schort je niet op omdat het even slecht uitkomt. Een
   verzoek om inzage mag een termijn hebben, maar geen beveiligingsstand als
   grond om er niet aan te beginnen.

   EN INHOUDELIJK, wat hier zwaarder weegt: deze zes VERGROTEN geen vermogen.
   Inzage en uitdraai LEZEN wat er al van jou is; toestemming intrekken maakt de
   verzameling wat mag alleen KLEINER. Een beveiligingslaag die een versmalling
   tegenhoudt, werkt tegen zichzelf in.

   WAT ER MET OPZET NIET IN STAAT: /api/privacy/delete. Dat is de enige van de
   zeven die onomkeerbaar is en breed uitwaaiert -- de gemeten collecties laten
   zien dat hij rechten, identiteit, andermans gegevens, koppelingen en de
   beveiliging raakt. Onder een gesloten stand blijft hij dus dicht, en dat is
   geen weigering van het recht: het recht blijft bestaan en de UITVOERING wacht
   tot het account niet meer onder verdenking staat. Wie dat anders wil, neemt
   dat besluit hier en niet met een regex.

   ---------------------------------------------------------------------------
   EN WAT ER OOK NIET IN STAAT: /api/toestel/meting. Dat pad heeft geen functie
   omdat het geen ledenroute is -- kern/toestellen.js geeft een horloge of een
   weegschaal een eigen smalle sleutel die precies een ding kan. Het is dus geen
   blinde vlek in de beschermstand maar een andere deur, en die hoort niet met
   een uitzondering te worden opengezet. */
'use strict';

const EIGEN_UITGANG = Object.freeze({
  '/api/isolatie/mijn': 'de eigen stand kunnen LEZEN; wie niet ziet dat hij dichtstaat, snapt niets',
  '/api/isolatie/mijn/zet': 'zichzelf strenger zetten mag nooit door de bescherming zelf dichtvallen',
  '/api/isolatie/mijn/ontsluiting': 'de uitgang aanvragen',
  '/api/isolatie/mijn/ontsluiting/stap': 'de uitgang aflopen',
  '/api/isolatie/mijn/ontsluiting/stap/opties': 'de uitgang aflopen kan niet zonder het bewijs ervoor aan ' +
    'te vragen; deze route dicht en de vorige open zou een uitgang zijn die je alleen nog met een ' +
    'onbewezen stap kunt nemen',
  '/api/isolatie/mijn/ontsluiting/commit': 'de uitgang afmaken',
  '/api/isolatie/mijn/ontsluiting/afbreken': 'de uitgang laten vallen'
});

const RECHT_VAN_DE_MENS = Object.freeze({
  '/api/privacy/inzage': 'inzage in je eigen gegevens; dit LEEST en vergroot niets',
  '/api/privacy/export': 'een uitdraai van je eigen gegevens; zelfde reden',
  '/api/inzagekaart': 'het inzagejournaal: wie heeft er in mijn dossier gekeken',
  '/api/toestemming': 'zien wat je hebt toegestaan',
  '/api/toestemming/intrek': 'toestemming intrekken maakt de verzameling wat mag alleen KLEINER; ' +
    'een beveiligingslaag die een versmalling tegenhoudt, werkt tegen zichzelf in'
});

/* Met opzet buiten beide lijsten gehouden, met de reden erbij -- zodat een
   volgende lezer ziet dat ze zijn overwogen en niet vergeten. */
const BEWUST_DICHT = Object.freeze({
  '/api/privacy/delete': 'onomkeerbaar en breed: de gemeten collecties laten rechten, identiteit, ' +
    'andermans gegevens, koppelingen en de beveiliging zien. Het RECHT blijft bestaan; de UITVOERING ' +
    'wacht tot het account niet meer onder verdenking staat.',
  '/api/toestel/meting': 'geen ledenroute maar een toestelsleutel (kern/toestellen.js): een andere ' +
    'deur, geen blinde vlek in deze.'
});

function blijftOpen(pad) {
  const p = String(pad);
  if (EIGEN_UITGANG[p]) return { grond: 'EIGEN_UITGANG', waarom: EIGEN_UITGANG[p] };
  if (RECHT_VAN_DE_MENS[p]) return { grond: 'RECHT_VAN_DE_MENS', waarom: RECHT_VAN_DE_MENS[p] };
  return null;
}

/* Geen pad staat in twee lijsten, en geen pad dat bewust dicht is staat per
   ongeluk toch open. Bij het laden, want een tegenspraak hier is een gat dat je
   pas bij een incident zou vinden. */
(function keurIn() {
  const dubbel = Object.keys(EIGEN_UITGANG).filter(p => RECHT_VAN_DE_MENS[p]);
  if (dubbel.length) throw new Error('openpaden: "' + dubbel.join(', ') + '" staat in twee lijsten; ' +
    'dan is niet te zeggen op welke grond hij openstaat.');
  const botst = Object.keys(BEWUST_DICHT).filter(p => blijftOpen(p));
  if (botst.length) throw new Error('openpaden: "' + botst.join(', ') + '" is bewust dicht en staat ' +
    'toch op een open lijst. Dat is precies het gat dat je pas bij een incident vindt.');
})();

module.exports = { EIGEN_UITGANG, RECHT_VAN_DE_MENS, BEWUST_DICHT, blijftOpen };
