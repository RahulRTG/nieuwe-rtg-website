/* Idempotentiebesluiten voor de finale Connection OS-routes.

   Projecties lezen. Gewenste toestanden en guarded transitions mogen een
   woordelijk gelijke retry binnen het dubbeltikvenster hergebruiken. Uploads
   met rauwe bytes en domeineigen Idempotency-Key blijven bewust buiten de
   generieke JSON-cache: de Connection-kern dedupliceert ze op doel en actor.
   Een tweede identiek tekstbericht is juist een tweede bericht. */
'use strict';

const SLEUTELS = {
  'POST /api/vonk/edge': { leest: true },
  'POST /api/member/rendezvous/edge': { leest: true },

  'POST /api/vonk/profile-photo': { nietIdempotent: true,
    waarom: 'de upload draagt rauwe bytes buiten de JSON-vingerafdruk en wordt in de mediakern op eigenaar plus expliciete Idempotency-Key gededupliceerd' },
  'POST /api/vonk/profile-photo/publish': { zelfdeVerzoek: true },
  'POST /api/vonk/profile-photo/remove': { nietIdempotent: true,
    waarom: 'verwijderen moet de actuele eigenaarstoestand opnieuw beoordelen; de eerste aanroep slaagt en een herhaling hoort 404 te antwoorden, niet het oude 200-antwoord te herhalen' },
  'POST /api/vonk/profile-photo/order': { zelfdeVerzoek: true },
  'POST /api/member/rendezvous/profile-photo': { nietIdempotent: true,
    waarom: 'de upload draagt rauwe bytes buiten de JSON-vingerafdruk en wordt in de mediakern op eigenaar plus expliciete Idempotency-Key gededupliceerd' },
  'POST /api/member/rendezvous/profile-photo/publish': { zelfdeVerzoek: true },
  'POST /api/member/rendezvous/profile-photo/remove': { nietIdempotent: true,
    waarom: 'verwijderen moet de actuele eigenaarstoestand opnieuw beoordelen; de eerste aanroep slaagt en een herhaling hoort 404 te antwoorden, niet het oude 200-antwoord te herhalen' },
  'POST /api/member/rendezvous/profile-photo/order': { zelfdeVerzoek: true },

  'POST /api/member/rendezvous/concierge': { leest: true },
  'POST /api/member/rendezvous/concierge/request': { velden: ['idempotencyKey'] },
  'POST /api/member/rendezvous/concierge/approve': { zelfdeVerzoek: true },
  'POST /api/office/rendezvous/concierge': { leest: true },
  'POST /api/office/rendezvous/concierge/step': { zelfdeVerzoek: true },
  'POST /api/office/rendezvous/arrangements': { leest: true },
  'POST /api/office/rendezvous/arrangement/step': { zelfdeVerzoek: true },

  'POST /api/member/rendezvous/circles': { leest: true },
  'POST /api/member/rendezvous/circle/rsvp': { zelfdeVerzoek: true },
  'POST /api/office/rendezvous/circles': { leest: true },
  'POST /api/office/rendezvous/circle/create': { velden: ['idempotencyKey'] },
  'POST /api/office/rendezvous/circle/invite': { zelfdeVerzoek: true },
  'POST /api/office/rendezvous/circle/gathering': { velden: ['idempotencyKey'] }
};

for (const product of ['vonk', 'rendezvous']) {
  const basis = 'POST /api/connection/' + product;
  SLEUTELS[basis + '/status'] = { leest: true };
  SLEUTELS[basis + '/consent'] = { zelfdeVerzoek: true };
  SLEUTELS[basis + '/text'] = { nietIdempotent: true,
    waarom: 'twee bewust identieke tekstberichten zijn twee berichten; rate limiting en de gesprekstoestand beoordelen iedere verzending opnieuw' };
  SLEUTELS[basis + '/message/remove'] = { zelfdeVerzoek: true };
  SLEUTELS[basis + '/message/report'] = { zelfdeVerzoek: true };
  SLEUTELS[basis + '/message-media'] = { nietIdempotent: true,
    waarom: 'de upload draagt rauwe bytes buiten de JSON-vingerafdruk en wordt in de communicatiekern op actor plus expliciete Idempotency-Key gededupliceerd' };
  SLEUTELS[basis + '/call/start'] = { nietIdempotent: true,
    waarom: 'de oproep gebruikt een expliciete Idempotency-Key en kan een eerdere actieve oproep sluiten; de domeinkern moet daarom iedere aanvraag beoordelen' };
  SLEUTELS[basis + '/call/answer'] = { zelfdeVerzoek: true };
  SLEUTELS[basis + '/call/signal'] = { zelfdeVerzoek: true };
  SLEUTELS[basis + '/call/poll'] = { leest: true };
  SLEUTELS[basis + '/call/end'] = { zelfdeVerzoek: true };
}

module.exports = { SLEUTELS };
