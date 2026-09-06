/* Eigen raw webhook, voor de generieke idem-poort. De primaire sleutel en
   bodyhash worden in dezelfde duurzame transactie als de ontvangst vastgelegd. */
'use strict';
module.exports = { CONTRACTEN: {
  'POST /api/webhooks/storingen': {
    mutatieId: 'storingen.ontvang', herkomst: 'mens',
    semantiek: { klasse: 'sleutelVereist' },
    toegang: { klasse: 'SERVICE_TO_SERVICE' }, stand: 'PROTECTED',
    bewijs: { gemeten: 'test/storingen-webhook.test.js: twaalf gelijktijdige leveringen over twee echte ' +
      'app-processen schrijven een ontvangst; herstart behoudt deduplicatie; andere bytes geven 409. ' +
      'test/storingen-bezorging.test.js: verloren antwoord na opslag herhaalt dezelfde id zonder tweede ontvangst.', op: '2026-09-06' },
    nagekeken: 'Codex, 2026-09-06: event-id en raw bodyhash zijn HMAC-gebonden; SQLite PRIMARY KEY, ' +
      'BEGIN IMMEDIATE en FULL-fsync gaan voor het ondertekende bewijs. Garantie geldt 30 dagen op dezelfde host.',
    afgetekend: { door: 'Codex, implementatie en geslaagde HTTP-/herstartproeven', op: '2026-09-06' }
  }
} };
