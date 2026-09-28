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
    /* Een profielfoto-ticket is een kortlevende bearer: wie hem bezit kan de
       foto binnen de geprojecteerde context ophalen. Hij mag daarom net zo min
       als een wachtwoord in een log of foutmelding belanden. Deze specifieke
       vorm moet vóór de generieke sleutelregels staan; base64url bevat immers
       niet noodzakelijk zestien hextekens achter elkaar. */
    .replace(/^\/api\/vonk\/profile-photo\/delivery\/[^/]+(?=\/|$)/i,
      '/api/vonk/profile-photo/delivery/:ticket')
    .replace(/^\/api\/member\/rendezvous\/profile-photo\/delivery\/[^/]+(?=\/|$)/i,
      '/api/member/rendezvous/profile-photo/delivery/:ticket')
    .replace(/^\/api\/connection\/(vonk|rendezvous)\/message-media\/delivery\/[^/]+(?=\/|$)/i,
      '/api/connection/$1/message-media/delivery/:ticket')
    /* Oude wervingslinks droegen de zes-teken-bearer in het pad. Nieuwe links
       gebruiken uitsluitend een browserfragment, maar een oude bookmark mag
       ook bij een omleiding nooit alsnog in verzoek-, fout- of journaallogs
       belanden. Deze specifieke vorm moet vóór de generieke id-regels. */
    .replace(/^\/werken\/[^/]+(?=\/|$)/i, '/werken/:code')
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
