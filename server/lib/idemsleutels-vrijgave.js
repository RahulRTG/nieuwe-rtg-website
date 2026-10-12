/* DE VRIJGAVEPOORT EN STRIPE CONNECT -- het duplicaatgedrag van de kantoordeuren
   (server/routes/kantoren/vrijgave.js en ./connect.js).

   GEEN VAN DEZE ROUTES MAG EEN BEWAARD ANTWOORD TERUGKRIJGEN, op de twee lezers
   na. Een stand zetten draagt een VERSIE (een optimistisch slot in
   server/kern/vrijgave/stand.js): een tweede oproep met dezelfde versie hoort de
   botsing te zien, niet het antwoord van de eerste. En het aanzetten vraagt een
   verse passkey die maar een keer geldt -- een teruggespeeld "ok" zou een
   schakeling melden die met die ceremonie niet plaatsvond. De idempotentie van
   deze handelingen zit in de KERN (dezelfde stand twee keer is `ongewijzigd`,
   dezelfde afrekening-id twee keer is `herhaald`), niet in de poort. */
'use strict';

const SLEUTELS = {
  'POST /api/office/vrijgave': { leest: true },
  'POST /api/office/vrijgave/stand': { nietIdempotent: true, waarom:
    'De stand draagt een versie (optimistisch slot) en aanzetten een eenmalige passkey. Een tweede oproep met ' +
    'dezelfde versie hoort de botsing te krijgen; dezelfde stand opnieuw zetten meldt de kern zelf als ongewijzigd.' },
  'POST /api/office/vrijgave/besluit': { nietIdempotent: true, waarom:
    'Vastleggen vraagt een eenmalige passkey en schrijft met een versie; intrekken van wat al is ingetrokken meldt ' +
    'de kern als ongewijzigd. Een teruggespeeld antwoord zou een vastlegging melden die er niet kwam.' },
  'POST /api/office/connect/afrekeningen': { leest: true },
  'POST /api/office/connect/afrekening': { nietIdempotent: true, waarom:
    'Een oproep vraagt een TWEEDE HANDTEKENING aan (een aanvraag per oproep, met een eenmalige passkey). De ' +
    'afrekening zelf is idempotent op haar id: bestaat zij al, dan krijgt de oproep `herhaald` met dezelfde afrekening.' },
  'POST /api/office/connect/veeg': { nietIdempotent: true, waarom:
    'De veeg haalt de HUIDIGE stand bij Stripe op en draait de reconciliatie; een teruggespeeld antwoord meldt een ' +
    'stand van seconden geleden. Wat hij opnieuw indient, gaat met dezelfde Stripe-sleutel (server/betaal/connect/sleutel.js).' }
};

module.exports = { SLEUTELS };
