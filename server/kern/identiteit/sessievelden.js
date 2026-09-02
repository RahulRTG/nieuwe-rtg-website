/* ============================================================================
   MIJN RTG blok 1: DE WOORDENLIJST -- wat een sessie mag dragen, en wat niet.

   Pure data, geen gedrag. Dezelfde knip als kern/lidboard/catalogus.js, en om
   dezelfde reden: de LIJST is waar dit huis besluiten in vastlegt, de POORT
   (./sessiecontext.js) is waar ze worden afgedwongen. Wie ze in een bestand
   zet, gaat de lijst vanzelf aanpassen om de poort te laten kloppen.

   De vier tabellen hieronder horen bij elkaar en horen nergens anders:

     GRADEN     de bewijsladder van BESTUUR.md, van zwak naar sterk.
     METHODEN   van meetmethode naar graad. Dit is de ENIGE plek waar een graad
                ontstaat; wie een graad wil zetten, voegt eerst een methode toe
                en schrijft daarmee op hoe hij is vastgesteld.
     VELDEN     de gesloten lijst van wat er in een sessie kan. Per veld de
                soort, of hij een persoonsgegeven kan dragen, en na hoeveel tijd
                zijn vaststelling vervalt.
     VERBODEN   wat er met opzet niet in kan, met de reden per regel. Een lijst
                zonder redenen wordt binnen een jaar "even een uitzondering".
   ========================================================================== */
'use strict';


/* De bewijsgraden van BESTUUR.md, van zwak naar sterk. `onbekend` is een
   eersteklas uitslag en geen nul: "wij hebben dit nooit vastgesteld" is iets
   anders dan "dit is er niet". */
const GRADEN = ['onbekend', 'vermoed', 'gemeten', 'bewezen'];

/* Van meetmethode naar graad. Dit is de enige plek waar een graad ontstaat.
   Wie een graad rechtstreeks wil zetten, moet eerst een methode toevoegen --
   en dan staat er tenminste opgeschreven hoe hij is vastgesteld. */
const METHODEN = {
  cryptografisch: { graad: 'bewezen',  uitleg: 'Een sleutel heeft ondertekend; wij hebben de handtekening gecontroleerd.' },
  gemeten:        { graad: 'gemeten',  uitleg: 'Door ons waargenomen op het moment zelf.' },
  afgeleid:       { graad: 'vermoed',  uitleg: 'Uit andere gegevens geconcludeerd, niet direct waargenomen.' },
  opgegeven:      { graad: 'vermoed',  uitleg: 'Door de gebruiker verteld, door ons niet getoetst.' }
};

const UUR = 3600 * 1000;

/* ---------------------------------------------------------------------------
   DE VELDEN. Per veld: de soort, of hij een persoonsgegeven kan dragen, en na
   hoeveel tijd zijn vaststelling vervalt.

   `verval: null` betekent: vervalt niet vanzelf. Dat mag alleen voor iets dat
   per definitie niet verandert zolang de sessie leeft -- waarmee de sessie
   ontstond, bijvoorbeeld. Alles wat over de HUIDIGE toestand van de wereld gaat
   (waar iemand is, hoe riskant iets nu lijkt) vervalt wel, want een meting van
   drie dagen oud is geen meting van nu.
   ------------------------------------------------------------------------- */
const VELDEN = {
  authenticator: {
    soort: 'claim', persoonsgegeven: false, verval: null,
    uitleg: 'Waarmee deze sessie tot stand kwam.',
    /* Niet `mfa: true` maar de identiteit van de authenticator. Alleen zo kun je
       later zeggen "trek alles in dat met credential Y is gemaakt" of "deze
       betaling is bevestigd met passkey X". Een boolean kan dat nooit. */
    vorm: { type: 'tekst', authenticatorId: 'sleutel', assurance: 'tekst' }
  },
  toestel: {
    soort: 'binding', persoonsgegeven: false, verval: null,
    uitleg: 'Aan welk bekend toestel deze sessie gebonden is.',
    /* GEEN toestelnaam. "Rahuls iPhone" is presentatie en hoort in de laag die
       toont, niet in de securitywaarheid. De kern heeft genoeg aan een id, de
       binding en de stand ervan. */
    vorm: { toestelId: 'sleutel', bindingId: 'sleutel', bindingStand: 'tekst' }
  },
  context: {
    soort: 'claim', persoonsgegeven: false, verval: null,
    uitleg: 'Namens wie er in deze sessie gehandeld wordt.',
    /* Dit veld bestaat vanaf dag een, ook al komt contextwisseling later. Zonder
       contextId bouw je sessies opnieuw rond "een login is een actorcontext", en
       dan moet elke sessie bij MIJN RTG weer open. */
    vorm: { contextId: 'sleutel', contextSoort: 'tekst', contextVersie: 'getal' }
  },
  /* HIER STOND `vertrouwen`, en hij is er op 31 augustus 2026 UIT gehaald.

     Niemand schreef hem ooit, en dat was geen achterstand maar een aanwijzing:
     een vertrouwensstand is geen waarneming maar een GEVOLGTREKKING uit de
     claims die hier al staan (authenticator, toestel, sleutelbinding). Zo'n
     gevolgtrekking opslaan maakt er een tweede waarheid van die veroudert -- de
     sessie zegt dan "sterk" terwijl het toestel er inmiddels uit ligt.

     Hij wordt nu berekend op het moment dat iemand hem vraagt, in
     ./vertrouwen.js, en nergens bewaard. Een veld dat niemand vult is een
     belofte die niemand nakomt; die hoort weg en niet stil te blijven staan. */
  /* HIER STOND `risico`, en hij is er om dezelfde reden uit als `vertrouwen`
     hierboven: niemand schreef hem ooit. Er is geen risicoweging in dit huis en
     die komt er voorlopig niet -- dat vraagt beleidskeuzes die de eigenaar
     bewust niet heeft gemaakt (MIJNRTG.md par. 5c).

     GEVOLG DAT ER EERLIJK BIJ HOORT: hiermee draagt GEEN ENKEL veld in deze
     lijst nog een `verval`. De regel eronder -- vervallen bewijs is geen bewijs
     (BESTUUR.md) -- blijft dus wel bestaan maar wordt door niets meer geraakt.
     Hij is met opzet NIET weggehaald: hij geldt op het moment dat er ooit een
     claim bijkomt die over de huidige toestand van de wereld gaat, en een regel
     die je bij het toevoegen van zo'n claim opnieuw moet bedenken, wordt dan
     vergeten. `graadMet` in ./sessiecontext.js houdt hem toetsbaar. */
  sleutelbinding: {
    soort: 'binding', persoonsgegeven: false, verval: null,
    uitleg: 'Of het token aan een sleutel gebonden is (sender-constrained).',
    vorm: { keyRef: 'sleutel', schema: 'tekst' }
  }
};

/* ---------------------------------------------------------------------------
   WAT ER MET OPZET NIET IN KAN, met de reden per regel. Een lijst zonder redenen
   wordt binnen een jaar "even een uitzondering".
   ------------------------------------------------------------------------- */
const VERBODEN = {
  ip:            'Een volledig IP-adres is een persoonsgegeven en zou over de bus repliceren. Meet het bij de bron en geef een risicoRef door.',
  gps:           'Ruwe coordinaten horen niet in een sessie die 30 dagen leeft en naar andere processen reist.',
  locatie:       'Idem. Een plaatsnaam is een AFGELEIDE en hoort bij de risicoweging, niet in de sessiewaarheid.',
  fingerprint:   'Een toestelvingerafdruk is stille herkenning zonder toestemming. De toestelbinding is de vorm die dit huis wel kent.',
  useragent:     'Een volledige user-agent is een fingerprint met een ander woord.',
  toestelnaam:   'Presentatie, geen securitywaarheid. Hoort in de laag die toont (zie het veld toestel).',
  permissies:    'De permissiegraaf heeft een bron (lidboard, functieschakelaars). Een kopie in de sessie is een tweede waarheid die verouderd raakt.',
  mandaten:      'Zelfde reden: de machtigingen zijn de bron.',
  organisaties:  'Zelfde reden: eenaccount is de bron. De sessie draagt de ACTIEVE context, niet de hele lijst.',
  consent:       'Het consentregister is de juridische bron. Een sessie die consent kopieert, kan een ingetrokken toestemming overleven.',
  risicodossier: 'Het dossier blijft bij de bron; de sessie draagt de verwijzing (zie het veld risico).'
};


module.exports = { GRADEN, METHODEN, VELDEN, VERBODEN, UUR };
