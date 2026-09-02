/* ============================================================================
   DE ZWARE PADEN -- waar dit huis een bezitsbewijs vraagt, en waarom.

   Pure data, geen gedrag. Dezelfde knip als kern/identiteit/sessievelden.js
   tegenover sessiecontext.js, en om dezelfde reden: de LIJST is waar een besluit
   in wordt vastgelegd, de POORT (./bezitsbewijs.js) is waar het wordt
   afgedwongen. In een bestand gaat de lijst zich vanzelf voegen naar wat de
   poort makkelijk vindt.

   ELKE REGEL DRAAGT EEN REDEN, en dat is een grendel en geen versiering: een
   lijst zonder redenen groeit tot hij overal staat, en dan betaalt het lezen van
   een menukaart de prijs van een overboeking. test/bezitsbewijs.test.js zakt op
   een regel zonder reden.

   DE LIJST STAAT OOK IN DE BROWSER (public/shared/toestelsleutel.js), en dat is
   bewust een kopie en geen gedeelde bron: de client BESLIST niets, hij weet
   alleen wanneer tekenen zin heeft. Lopen ze uit elkaar, dan gebeurt dat stil --
   de server weigert en het scherm snapt niet waarom. Daar staat een toets op.
   ========================================================================== */
'use strict';

/* WELKE PADEN, EN WAAROM. Alleen handelingen waarbij een gestolen token echte,
   moeilijk terug te draaien schade doet. Wie hier iets bij zet, schrijft de
   reden erbij -- een lijst zonder redenen groeit tot hij overal staat en dan is
   de zwaarte weer betekenisloos. */
const PADEN = [
  { pad: '/api/pay/', reden: 'geld verplaatsen' },
  { pad: '/api/betaal/', reden: 'geld verplaatsen' },
  { pad: '/api/wallet/', reden: 'tegoed en passen' },
  { pad: '/api/bank/', reden: 'bankhandelingen' },
  { pad: '/api/auth/password', reden: 'het wachtwoord wijzigen zet alle andere sessies eruit' },
  { pad: '/api/webauthn/registreer', reden: 'een nieuwe passkey is een nieuwe sleutel tot het account' },
  { pad: '/api/webauthn/weg', reden: 'een passkey verwijderen haalt een herstelroute weg' },
  { pad: '/api/mijn/toestel/introk', reden: 'een toestel intrekken sluit sessies' },
  { pad: '/api/privacy/delete', reden: 'onomkeerbaar' },
  { pad: '/api/rtgid/machtig', reden: 'iemand anders bevoegdheid geven' },
  { pad: '/api/mijn/sessies/sluit', reden: 'wie uw token heeft, kan anders uw sessies sluiten' },
  { pad: '/api/privacy/export', reden: 'levert het volledige dossier uit' },
  { pad: '/api/privacy/inzage', reden: 'levert het volledige dossier uit' },
  /* HET TELEFOONNUMMER IS EEN HERSTELKANAAL, en dat maakt deze twee zwaarder
     dan ze eruitzien. /api/auth/reset stuurt een sms naar `phoneOf(u)`; wie dat
     nummer vervangt, verlegt de herstelweg naar zichzelf. Beide routes doen dat
     vandaag zonder dat er opnieuw een wachtwoord wordt gevraagd, terwijl het
     WACHTWOORD wijzigen dat wel eist -- dat is de scheve kant op, want het
     nummer omzetten is de eerste stap van een overname en het wachtwoord de
     tweede. setPhone kan een nummer niet leegmaken maar wel VERVANGEN, en dat
     komt op hetzelfde neer.

     Dit dicht dat niet: een bezitsbewijs vraagt om het toestel, niet om de
     mens. De echte reparatie is her-authenticatie op die routes, en die staat
     nog open. */
  { pad: '/api/gegevens/', reden: 'zet het telefoonnummer, en dat is het herstelkanaal' },
  { pad: '/api/onboarding/inricht', reden: 'zet het telefoonnummer, en dat is het herstelkanaal' }
];

module.exports = { PADEN };
