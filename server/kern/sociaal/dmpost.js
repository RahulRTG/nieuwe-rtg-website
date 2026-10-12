/* Een Salon-post in een DM: hij reist als ID en wordt bij het LEZEN opgelost met
   de sessie van wie leest.

   Hier stond een bevroren kopie (auteur, plaats, de eerste 120 tekens, de foto)
   in het bericht, en de leespoort keek alleen naar de AFZENDER. Een vriend van A
   kon zo een post "vrienden" van A doorsturen naar iemand die A niet kent, en die
   las de tekst -- ook nog nadat A de post had verwijderd. Dezelfde fout die het
   Media OS-stuk in routes/social/leden.js al niet maakt: een gedeeld stuk gaat
   mee als id, en de ontvanger lost het op met zijn eigen deuren.

   Twee regels:
   - VERSTUREN mag alleen wat de afzender zelf mag lezen (anders is een gesprek
     een manier om te toetsen welke id's bestaan), en er gaat alleen het id mee.
   - LEZEN lost op met de sessie van de lezer, via dezelfde leespoort als De
     Salon (kern/salon/zichtbaarheid.js). Mag hij de post niet (meer) lezen, dan
     krijgt hij `nietBeschikbaar` -- zonder tekst, auteur, plaats of foto. Ook
     een oud bericht met een bevroren kopie wordt zo opgelost; die kopie gaat
     nooit meer de deur uit. */
'use strict';

const { toon } = require('../../media/toegang');

module.exports = function maakDmPost({ posts, magLezen }) {
  const vind = id => (posts() || []).find(p => p && String(p.id) === String(id)) || null;
  const mag = (sess, p) => !!(p && typeof magLezen === 'function' && magLezen(sess, p));

  /* Bij versturen: het id van een post die de afzender mag lezen, of null. */
  function deel(sess, postId) {
    if (postId == null) return null;
    const p = vind(postId);
    return mag(sess, p) ? { id: p.id } : null;
  }

  /* Bij lezen: de post zoals DEZE lezer hem mag zien, of `nietBeschikbaar`. */
  function voorLezer(sess, bijlage) {
    if (!bijlage || bijlage.id == null) return null;
    const p = vind(bijlage.id);
    if (!mag(sess, p)) return { id: bijlage.id, nietBeschikbaar: true };
    return { id: p.id, author: p.author, place: p.place || '', text: String(p.text || '').slice(0, 120),
      photo: toon(p.photo) || null };
  }

  return { deel, voorLezer };
};
