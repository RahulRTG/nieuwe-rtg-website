/* ============================================================================
   DOELBINDING -- waarvoor mag dit gegeven gebruikt worden, en mag ik nee zeggen?

   HET GAT DAT DIT VULT, en het is het duurste van de lijst (MIJNRTG.md par. 5,
   punt 8). De boardroom van een lid schakelt per FUNCTIE: reizen aan, Salon uit,
   medicijnen uit. Dat is een goede laag en hij blijft. Maar een functie is geen
   doel: "RTG Pay staat aan" zegt niet of uw telefoonnummer gebruikt mag worden
   om u een aanbieding te sturen. De gegevenskaart noemt sinds kort per gegeven
   een doel -- in een ZIN. Niemand dwingt die zin af. Doelbinding was daarmee een
   belofte in tekst, en LAT-regel 6 zegt wat dat waard is.

   DE GROND IS HET SCHARNIER, EN HIJ BEPAALT OF U NEE MAG ZEGGEN. Dat is geen
   nuance maar de kern: een kaart die zegt "u kunt elk doel weigeren" liegt, want
   uw adres gebruiken om uw bestelling te bezorgen is de uitvoering van wat u
   zelf vroeg. Vier gronden, en maar een ervan is een keuze:

     overeenkomst   u vroeg iets; zonder dit gebruik kan RTG het niet leveren
     wettelijk      de wet schrijft het voor; niemand hier kan dat wegklikken
     bescherming    het beschermt u of een ander tegen schade
     toestemming    ALLEEN dit is een keuze, en die staat standaard uit

   WAT DIT NIET IS. Dit is geen tweede rechtenmodel. Het zegt niets over WIE
   iets mag (dat is het Consent Center en de bevoegdheidslaag) en niets over of
   een functie aanstaat (dat is de boardroom). Het zegt waarvoor een gegeven dat
   RTG al heeft, gebruikt mag worden. Wie hier een derde poort van maakt, bouwt
   het probleem na dat CLAUDE.md bij toegang al benoemt: er komt geen derde
   rechtenmodel bij.

   EN HIJ BEGINT IN DE SCHADUW. CONTROLPLANE.md: je kunt niet afdwingen wat
   nooit in de schaduw heeft gelopen. Zie ./doelpoort.js voor de standen.
   ========================================================================== */
'use strict';

const GRONDEN = {
  overeenkomst: {
    naam: 'Nodig voor wat u vroeg',
    uitleg: 'Zonder dit gebruik kan RTG niet leveren wat u zelf in gang zette. Dit is geen keuze -- wel kunt u de handeling zelf laten.',
    weigerbaar: false
  },
  wettelijk: {
    naam: 'De wet schrijft het voor',
    uitleg: 'RTG moet dit doen. Niemand hier kan dat voor u wegklikken, ook uw beheerder niet.',
    weigerbaar: false
  },
  bescherming: {
    naam: 'Om u of een ander te beschermen',
    uitleg: 'Dit bestaat om schade te voorkomen -- fraude, misbruik, of iemand die in gevaar is. Kon u het uitzetten, dan kon een ander dat ook.',
    weigerbaar: false
  },
  toestemming: {
    naam: 'Alleen als u ja zegt',
    uitleg: 'Dit staat uit tot u het aanzet, en u kunt het altijd weer intrekken. Wat RTG eerder deed blijft gedaan; vanaf het intrekken stopt het.',
    weigerbaar: true
  }
};

/* DE DOELEN. Elk in de woorden van een lid, want "profilering" en
   "dienstverlening" zeggen niets. `gegevens` noemt welke soorten uit
   ./gegevenssoorten.js dit doel MAG raken -- en die lijst is de grens: een doel
   dat een gegeven niet noemt, komt er niet bij. */
const DOELEN = [
  { id: 'inloggen', naam: 'U binnenlaten en binnen houden', grond: 'overeenkomst',
    wat: 'Vaststellen dat u het bent, en u aangemeld houden op de toestellen die u zelf koos.',
    gegevens: ['email', 'naam', 'codenaam', 'sessies', 'toestelbinding', 'tweefactor'] },

  { id: 'herstel', naam: 'U terug binnenlaten als u eruit ligt', grond: 'overeenkomst',
    wat: 'Een herstelcode of een bevestiging sturen als u uw wachtwoord kwijt bent of uw toestel weg is.',
    gegevens: ['email', 'telefoon', 'tweefactor'] },

  { id: 'leveren', naam: 'Leveren wat u bestelde', grond: 'overeenkomst',
    wat: 'Uw bestelling, reservering of reis daadwerkelijk uitvoeren -- en u bereiken als er iets verandert.',
    gegevens: ['naam', 'adres', 'telefoon', 'codenaam'] },

  { id: 'leeftijdspoort', naam: 'Bepalen waar u bij mag', grond: 'bescherming',
    wat: 'Vaststellen of u oud genoeg bent voor iets met een leeftijdsgrens. Er gaat geen datum mee naar de zaak; alleen ja of nee.',
    gegevens: ['geboortedatum', 'identiteitsbewijs'] },

  { id: 'fraude', naam: 'Misbruik van uw account tegenhouden', grond: 'bescherming',
    wat: 'Zien dat er van een vreemd toestel wordt ingelogd, en dat tegenhouden of u waarschuwen.',
    gegevens: ['sessies', 'toestelbinding', 'codenaam'] },

  { id: 'administratie', naam: 'De administratie die de wet eist', grond: 'wettelijk',
    wat: 'Facturen bewaren en kunnen tonen aan wie daar wettelijk om mag vragen.',
    gegevens: ['facturen', 'naam', 'adres'] },

  { id: 'verantwoording', naam: 'Kunnen laten zien wie in uw dossier keek', grond: 'bescherming',
    wat: 'Het inzagejournaal bijhouden, zodat u kunt navragen wie uw echte naam achter uw codenaam opvroeg.',
    gegevens: ['inzagejournaal', 'codenaam'] },

  /* HET BEWIJS VAN UW EIGEN TOESTEMMING, en dat is zelf een wettelijke plicht:
     wie zich op toestemming beroept, moet kunnen AANTONEN dat die er was
     (AVG art. 7 lid 1). Dit doel is gevonden door de handhaver in
     test/doelbinding.test.js -- `post` had geen enkel doel, en dat is precies
     het soort gegeven waarvan niemand meer kan zeggen waarom het er is.

     Let op de vorm: uw voorkeuren zijn zelf NIET weigerbaar, terwijl waar ze
     over gaan dat wel is. Kon u dit bewijs wegdrukken, dan kon RTG niet meer
     aantonen dat u ooit nee zei -- en dan werkt uw nee tegen u. */
  { id: 'toestemmingsbewijs', naam: 'Kunnen aantonen wat u aan- en uitzette', grond: 'wettelijk',
    wat: 'Bijhouden wanneer u toestemming gaf of introk, en via welk scherm. Dit is uw bewijs, niet dat van RTG.',
    gegevens: ['post', 'codenaam'] },

  /* DE ENIGE DRIE DIE U KUNT WEIGEREN, en ze staan alle drie standaard uit.
     Dat is niet vrijgevigheid maar de wet: zonder toestemming geen aanbieding.
     Ze hangen aan kern/identiteit/commercieel.js, zodat er geen tweede
     toestemmingsboekhouding ontstaat. */
  { id: 'aanbiedingen', naam: 'U aanbiedingen sturen', grond: 'toestemming',
    wat: 'U post sturen over reizen, arrangementen en acties.',
    gegevens: ['email', 'telefoon', 'naam'], viaPost: 'aanbiedingen' },

  { id: 'meedenken', naam: 'U om uw mening vragen', grond: 'toestemming',
    wat: 'U een enquete of een uitnodiging sturen om mee te denken.',
    gegevens: ['email', 'naam'], viaPost: 'onderzoek' },

  { id: 'partnerpost', naam: 'Post namens partners', grond: 'toestemming',
    wat: 'Aanbiedingen van aangesloten zaken -- door RTG verstuurd; uw adres gaat er niet heen.',
    gegevens: ['email', 'telefoon'], viaPost: 'partners' }
];

const DOEL_IDS = new Set(DOELEN.map(d => d.id));

/* De omgekeerde vraag, en die stelt een lid het vaakst: WAARVOOR wordt dit ene
   gegeven gebruikt? De kaart toont hem zo, dus hij hoort hier te worden
   afgeleid en niet op het scherm te worden nagebouwd. */
function doelenVoor(gegevenId) {
  return DOELEN.filter(d => d.gegevens.includes(String(gegevenId)));
}

module.exports = { DOELEN, GRONDEN, DOEL_IDS, doelenVoor };
