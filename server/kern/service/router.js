/* ============================================================================
   DE SERVICEROUTER -- een router, geen wachtrij.

   De melder ziet "RTG Support". Achter die ene deur staat geen enkele grote
   lijst waar alles in valt, want zo'n lijst wordt gesorteerd op wat er
   bovenaan staat en niet op wat er nodig is. Deze module rekent per zaak uit
   welk TEAM hem hoort te krijgen, en zegt erbij waarom.

   DRIE DINGEN DIE DEZE ROUTER MET OPZET NIET DOET.

   1. HIJ WIJST GEEN MENS AAN. Een team is een verzameling bevoegdheden en geen
      persoon; wie de zaak oppakt, bepaalt de mens die hem oppakt. Een router
      die mensen toewijst, wordt binnen een maand de plek waar iemand zijn
      werklast verstopt.

   2. HIJ VERLEENT NIETS. Dat het team `betalingen` heet, geeft niemand toegang
      tot een betaling; ./machtiging.js doet dat, per zaak en tijdelijk. De
      capabilities in ./klassen.js zijn dus een VRAAG ("dit werk heeft dit
      nodig") en geen uitgifte.

   3. HIJ KENT DE MELDER NIET. Hij krijgt doelgroep, onderwerp en prioriteit --
      geen naam, geen codenaam, geen dossier. Anders zou de routering zelf een
      reden worden om iemand op te zoeken.

   WAAROM DOELGROEP VOOR ONDERWERP GAAT. Een organisatie die over een betaling
   belt, heeft een ander gesprek nodig dan een lid met dezelfde vraag: er ligt
   een contract onder, er is een werkruimte, en er kan een bijstandssessie bij
   horen. Het onderwerp bepaalt WAT er speelt, de doelgroep bepaalt WIE het
   moet oppakken -- en bij een botsing wint de tweede. Dat is een besluit, geen
   detail, en het staat daarom in een tabel die je kunt aanwijzen.
   ========================================================================== */
'use strict';

const { TEAMS, ONDERWERPEN, DOELGROEPEN, geldig } = require('./klassen');

/* De doelgroepen die hun eigen ingang hebben, ongeacht het onderwerp. `lid` en
   `gast` staan er NIET in: die volgen het onderwerp, want daar is de vraag zelf
   het onderscheid. */
const DOELGROEP_TEAM = {
  organisatie: 'zakelijk',
  zaak: 'zakelijk',
  kantoor: 'techniek'
};

/* Uitzonderingen die boven alles gaan. Kort houden: elke regel hier is een
   plek waar de gewone route niet geldt, en dat moet je in een oogopslag
   kunnen overzien. */
const BOVEN_ALLES = [
  { als: (o) => o.onderwerp === 'veiligheid', team: 'veiligheid',
    waarom: 'Veiligheid en misbruik gaan altijd naar het veiligheidsteam, ongeacht wie meldt.' },
  { als: (o) => o.prioriteit === 'P0', team: 'veiligheid',
    waarom: 'Een P0 raakt de veiligheid of de geldintegriteit van het platform.' },
  { als: (o) => o.soort === 'opdracht', team: 'concierge',
    waarom: 'Een opdracht is conciergewerk en geen ondersteuning; De Rechterhand voert hem uit.' },
  { als: (o) => o.onderwerp === 'account', team: 'toegang',
    waarom: 'Wie niet bij zijn eigen account kan, heeft een uitdaging nodig en geen uitleg.' }
];

/* Bepaalt het team. Geeft ALTIJD een team terug -- een zaak die nergens heen
   kan routeren is een zaak die niemand ziet, en dat is de ergste uitkomst van
   deze laag. Bij twijfel valt hij op `leden` terug en zegt dat hij dat doet. */
function routeer({ doelgroep, onderwerp, soort, prioriteit } = {}) {
  const o = { doelgroep: String(doelgroep || ''), onderwerp: String(onderwerp || ''),
    soort: String(soort || ''), prioriteit: String(prioriteit || '') };

  for (const regel of BOVEN_ALLES) {
    if (regel.als(o)) return { team: regel.team, naam: TEAMS[regel.team].naam, waarom: regel.waarom, via: 'uitzondering' };
  }

  if (DOELGROEP_TEAM[o.doelgroep]) {
    const t = DOELGROEP_TEAM[o.doelgroep];
    return { team: t, naam: TEAMS[t].naam, via: 'doelgroep',
      waarom: 'Een melding van een ' + (DOELGROEPEN[o.doelgroep] || { naam: o.doelgroep }).naam.toLowerCase() +
        ' loopt langs het zakelijke kanaal, waar het contract en de werkruimte bekend zijn.' };
  }

  if (geldig(ONDERWERPEN, o.onderwerp)) {
    const t = ONDERWERPEN[o.onderwerp].team;
    return { team: t, naam: TEAMS[t].naam, via: 'onderwerp',
      waarom: 'Het onderwerp is "' + ONDERWERPEN[o.onderwerp].naam.toLowerCase() + '".' };
  }

  return { team: 'leden', naam: TEAMS.leden.naam, via: 'terugval',
    waarom: 'Het onderwerp is niet ingevuld of onbekend. Deze zaak gaat naar het algemene team, dat hem doorzet.' };
}

/* Wat een team NODIG heeft om zijn werk te doen. Uitdrukkelijk een vraag en
   geen uitgifte -- zie de kop. ./machtiging.js gebruikt dit als bovengrens:
   een machtiging kan hier alleen uit versmallen, nooit iets toevoegen. */
/* WAT EEN TEAM NODIG HEEFT, en dat is niet hetzelfde als wat je aan het LID
   vraagt. `benodigd` is de hele tabel; `teVragen` (./teams.js) is de tabel min
   wat de ZETEL al verleent. Een bevestiging vraagt om het tweede, want een
   verzoek dat om iets vraagt wat de medewerker al mocht, leert een lid
   doorklikken -- en dan is de knop niets meer waard waar hij wel telt. */
function benodigd(team) {
  return (TEAMS[team] && TEAMS[team].capabilities.slice()) || [];
}
const teVragen = (team) => require('./teams').teVragen(team);

/* De teams als keuzelijst, voor een scherm dat een zaak wil doorzetten. */
function keuzelijst() {
  return Object.entries(TEAMS).map(([id, t]) => ({ id, naam: t.naam,
    capabilities: t.capabilities.slice(),
    /* Wat een scherm aan het lid MAG voorleggen. Apart veld, want een cockpit
       die `capabilities` in een keuzelijst zet, laat anders `zaak.lezen` vragen
       -- iets dat de zetel al gaf. */
    teVragen: require('./teams').teVragen(id) }));
}

module.exports = { routeer, benodigd, teVragen, keuzelijst, DOELGROEP_TEAM, BOVEN_ALLES };
