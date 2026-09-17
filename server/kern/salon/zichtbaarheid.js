/* De zichtbaarheidspoort van Saloon.

   De Salon-app en de samengestelde Wereld-feed lezen dezelfde posts. Voorheen
   hield alleen de Salon-route rekening met volgen en vriendschap; de
   Wereld-feed las de opslag rechtstreeks. Daardoor kon een tweede ingang een
   andere privacyregel hanteren dan de bronapp. Deze module is de ene poort die
   beide ingangen gebruiken.

   Een expliciet publiek verkleint de bestaande Saloon-regel. Het maakt een
   post nooit breder zichtbaar dan salonviraal.toonInSalon toestaat. Zo kan een
   maker doelgebonden delen zonder dat een nieuw veld per ongeluk de publieke
   kwaliteitsdrempel omzeilt. */
'use strict';

const salonviraal = require('../salonviraal');
const vorm = require('./vorm');

module.exports = ({ db, findSupplier, zijnVrienden }) => {
  function salonRelaties(sess) {
    const key = sess && sess.key;
    const volgtLid = ((((db.data || {}).salon || {}).volgtLid || {})[key]) || [];
    const volgt = (p) => {
      if (!key) return false;
      if (p.partnerCode) {
        const s = findSupplier && findSupplier(p.partnerCode);
        return !!(s && s.salon && Array.isArray(s.salon.volgers) && s.salon.volgers.includes(key));
      }
      return !!(p.authorKey && volgtLid.includes(p.authorKey));
    };
    const bevriend = (p) => !!(key && p.authorKey && sess.tier !== 'guest'
      && zijnVrienden && zijnVrienden(key, p.authorKey));
    return { volgt, bevriend };
  }

  function magSalonPostZien(sess, post) {
    if (!post) return false;
    const key = sess && sess.key;
    if (key && post.authorKey === key) return true;

    const r = salonRelaties(sess || {});
    const publiek = vorm.publiek(post.publiek);
    if (publiek === 'alleenik') return false;
    if (publiek === 'vrienden' && !r.bevriend(post)) return false;
    if (publiek === 'volgers' && !r.volgt(post)) return false;
    if (publiek === 'contacten' && !r.volgt(post) && !r.bevriend(post)) return false;

    /* Iedereen is een expliciete publicatiekeuze, maar de veiligheids- en
       kwaliteitspoort blijft gelden. Vrienden en volgers vormen, net als voor
       deze module bestond, een kijker-afhankelijke uitzondering daarop. */
    return salonviraal.toonInSalon(post, r);
  }

  return { magZien: magSalonPostZien, PUBLIEKEN: vorm.PUBLIEKEN };
};
