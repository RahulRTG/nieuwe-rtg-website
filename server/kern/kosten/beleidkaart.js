/* DE BELEIDSKAART: per pas wat er met zijn kosten gebeurt.

   Een tabel en geen logica, met opzet apart van ./doorbelasting.js. Dit is het
   stuk waar iemand naar kijkt die wil weten wat RTG belooft -- niet hoe het
   gerekend wordt. Het hoort op één plek te staan en niet verspreid over de
   machinerie die het uitvoert; dezelfde reden waarom kern/genres het register
   los van de logica houdt.

   VIER STANDEN, EN ZE ZIJN NIET UITWISSELBAAR:

     inbegrepen    de bijdrage van deze pas dekt het. Er gaat niets naar de
                   factuur; het overzicht laat wél zien wat het kost, want dat
                   is precies wat je nodig hebt om die bijdrage te bepalen.
     doorbelasten  het gemeten bedrag gaat als ÉÉN regel naar de maandfactuur
                   die er al is. Geen tweede geldstroom (WAARDE.md).
     rtfoundation  het gezin ziet wat het kost en krijgt er nooit een rekening
                   voor; de RTFoundation draagt het.
     huis          verbruik zonder eigenaar. Dit is onze eigen rekening en die
                   sturen we niemand.

   RTG LITE EN BUSINESS LITE STAAN HIER AL, EN BESTAAN NOG NIET. Dat is met
   opzet en het is de eerlijke vorm: `bestaatNog: false`, zoals TENANT.md het
   met `nietGebouwd` doet. De machinerie werkt zodra die passen er zijn, en tot
   dan zegt het voorstel dat er nul gebruikers op zitten -- in plaats van dat er
   een pas verschijnt die niemand kan kopen.

   EN ER GAAT GEEN FACTUUR VOOR EEN PAAR CENT DE DEUR UIT. Onder de drempel
   schuift het bedrag door naar de volgende maand. Een rekening die minder
   oplevert dan hij kost is geen inkomsten maar ergernis. */
'use strict';

const { ontleed } = require('./haak');

/* De drempel in centen. Vijf euro: onder dat bedrag kost het innen (transactie,
   herinnering, vraag aan de klantenservice) meer dan de regel opbrengt. */
const DREMPEL_CENTEN = 500;

const BELEID = {
  gratis: { stand: 'inbegrepen', uitleg: 'De gratis app kent geen bijdrage. Wat deze gebruikers kosten draagt RTG zelf; het overzicht laat zien hoeveel dat is.' },
  rtg: { stand: 'inbegrepen', uitleg: 'De maandbijdrage van de RTG Pass dekt dit.' },
  lifestyle: { stand: 'inbegrepen', uitleg: 'De maandbijdrage van de Lifestyle Pass dekt dit.' },
  business: { stand: 'inbegrepen', uitleg: 'De Business Pass is op maat afgesproken; het verbruik hoort in die afspraak thuis en niet als losse regel.' },
  'rtg-lite': { stand: 'doorbelasten', bestaatNog: false, uitleg: 'RTG Lite betaalt een lage bijdrage en rekent het eigen verbruik af.' },
  'business-lite': { stand: 'doorbelasten', bestaatNog: false, uitleg: 'Business Lite betaalt een lage bijdrage en rekent het eigen verbruik af.' },
  zaak: { stand: 'inbegrepen', uitleg: 'Wat een zaak betaalt staat in zijn leverancierscontract; een tweede rekening ernaast zou daarmee botsen.' },
  gezin: { stand: 'rtfoundation', uitleg: 'De RTFoundation is gratis voor elk gezin. Het gezin ziet wat het kost; de RTFoundation betaalt.' },
  lab: { stand: 'rtfoundation', uitleg: 'Een lab van het Living Lab draait op de begroting van de RTFoundation. Het lab ziet tot op de cent wat het kost -- dat is precies wat een subsidiegever vraagt -- en de deelnemers krijgen er nooit een rekening voor.' },
  huis: { stand: 'huis', uitleg: 'Verbruik zonder eigenaar: onze eigen rekening.' }
};

const STANDEN = ['inbegrepen', 'doorbelasten', 'rtfoundation', 'huis'];

/* De twee standen die het kantoor NIET mag verzetten, met de reden erbij. Dat
   is het hele punt: 'gezin' en 'huis' zijn beloften en geen instellingen. Een
   schakelaar waarmee de RTFoundation alsnog gaat factureren, is geen
   configuratie maar het intrekken van "gratis voor elk gezin" -- dat hoort een
   besluit te zijn dat je opschrijft, niet een vinkje dat je omzet. */
const VAST = {
  lab: 'Een lab factureert zijn deelnemers niet. Onderzoek waarin de bewoner meebetaalt aan het onderzoek waaraan hij meedoet, is geen onderzoek maar een verkoop; die schakelaar hoort niet te bestaan.',
  gezin: 'De RTFoundation is gratis voor elk gezin. Dat is een belofte en geen instelling; wie dat wil veranderen verandert de RTFoundation, niet deze schakelaar.',
  huis: 'Verbruik zonder eigenaar is onze eigen rekening. Die aan een gebruiker toewijzen zou een rekening zijn voor iets dat hij niet heeft gedaan.'
};

/* Welke pas hoort bij deze drager. Een zaak, een gezin en het huis hebben geen
   pas; hun soort IS hun pas. Voor een lid komt hij uit de meting zelf (zie
   ./meter.js) -- en als die ontbreekt, valt hij op 'gratis' terug: de stand die
   niets factureert. Bij twijfel geen rekening. */
function pasVan(drager, rij) {
  const w = ontleed(drager);
  if (w.soort !== 'lid') return w.soort;
  const p = rij && rij.pas;
  return p && BELEID[p] ? p : 'gratis';
}

module.exports = { BELEID, STANDEN, VAST, DREMPEL_CENTEN, pasVan };
