/* De VORM waarin het journaal dingen opschrijft: een pad zonder de
   veranderlijke stukken, en een bestemming zonder de persoon erin.

   Twee pure functies, hier apart omdat ze ook los worden gebruikt (server/log.js
   normaliseert er het verzoekpad mee) en omdat kern/doorgeefjournaal.js anders
   over de omvangsgrens van de keuring gaat. Ze bewaren niets en lezen niets. */
'use strict';

/* Een pad zonder de veranderlijke stukken: /api/lid/42/pas wordt /api/lid/:id/pas.
   Zo tellen honderd verzoeken naar honderd leden als EEN regel in een overzicht,
   en staat er bovendien geen id in het journaal dat naar een persoon leidt. */
function padVorm(p) {
  return String(p || '')
    .replace(/\/[0-9a-f]{16,}/gi, '/:sleutel')
    .replace(/\/\d+/g, '/:id')
    .slice(0, 120);
}

/* Een bestemming zonder de persoon erin: 'sms:+31612345678' wordt 'sms', en een
   e-mailadres wordt het domein. Het journaal moet laten zien DAT er post uitging
   en of het lukte, niet aan wie. */
function bestemmingVorm(naar) {
  const s = String(naar || '');
  if (s.startsWith('sms:')) return 'sms';
  const at = s.indexOf('@');
  if (at > 0) return 'mail:' + s.slice(at + 1).slice(0, 40);
  return s.slice(0, 40) || 'onbekend';
}

module.exports = { padVorm, bestemmingVorm };
