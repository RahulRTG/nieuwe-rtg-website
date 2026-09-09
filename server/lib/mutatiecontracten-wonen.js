/* Mutatiecontracten van LivingOS Wonen. De lijst is een leesroute; melden
   maakt bewust een nieuwe, door het lid intrekbare melding; intrekken schrijft
   hoogstens eenmaal. Zie mutatiecontracten.js voor de vorm en begrippen. */
'use strict';

const AFGETEKEND = { door: 'Codex, op grond van route, kern en integratietest; niet door een mens nagelezen', op: '2026-09-07' };

const CONTRACTEN = {
  'POST /api/home/onderhoud': {
    mutatieId: 'wonen.onderhoud.lijst', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'NOT_APPLICABLE',
    nagekeken: 'De route projecteert alleen de onderhoudsmeldingen van de ingelogde sleutel. lijst() gebruikt kijk() en roept save() noch bak() aan.',
    bewijs: { gemeten: 'test/homekit.test.js leest eerst een lege lijst en na een melding dezelfde opgeslagen lijst terug.', op: '2026-09-07' },
    afgetekend: AFGETEKEND
  },
  'POST /api/home/onderhoud/meld': {
    mutatieId: 'wonen.onderhoud.meld', herkomst: 'mens',
    semantiek: { klasse: 'compenseerbaar' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: 'Twee gelijke beschrijvingen kunnen twee afzonderlijke defecten of plekken betreffen. Iedere bevestigde inzending krijgt daarom een eigen id. Het lid kan elke nog open melding zelf intrekken en de bovengrens voorkomt een onbegrensde reeks.',
    bewijs: { gemeten: 'test/homekit.test.js meet dat een geldige melding een eigen CSPRNG-id krijgt, als gemeld wordt bewaard en daarna intrekbaar is.', op: '2026-09-07' },
    afgetekend: AFGETEKEND
  },
  'POST /api/home/onderhoud/annuleer': {
    mutatieId: 'wonen.onderhoud.annuleer', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'PROTECTED',
    hoe: 'De route zoekt uitsluitend in de collectie van de sessiesleutel. Een al geannuleerde melding blijft geannuleerd en veroorzaakt geen tweede save; een onbekende id geeft 404.',
    bewijs: { gemeten: 'test/homekit.test.js trekt de eigen melding in en leest daarna precies de stand geannuleerd terug.', op: '2026-09-07' },
    afgetekend: AFGETEKEND
  }
};

module.exports = { CONTRACTEN };
