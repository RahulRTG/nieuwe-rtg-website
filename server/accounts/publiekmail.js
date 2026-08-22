'use strict';
/* PUBLIEKE MAILADRESSEN VAN LEDEN -- uitgeven en terugzoeken.

   APART, EN NIET ALLEEN OMDAT users.js TE GROOT WERD. Dat was de aanleiding --
   de samenvoeging van 22 augustus 2026 duwde dat bestand over de 10 KB -- maar
   de naad ligt hier echt. users.js gaat over het ACCOUNT: aanmaken, hernoemen,
   wachtwoord, hash. Een publiek mailadres is iets anders: een naar BUITEN
   zichtbare naam die op een codenaam wijst. Wie er een uitgeeft, geeft de
   buitenwereld een manier om iemand te bereiken zonder zijn echte naam te
   kennen -- precies de scheiding die dit huis bewaakt (CLAUDE.md, privacy by
   design). Die twee horen niet door elkaar te lopen in een bestand.

   DE STAAT BLIJFT IN DE KLUIS. Deze module houdt niets eigens bij; hij leest en
   schrijft via dezelfde rijen als users.js.
   ========================================================================== */
const S = require('./state');
const kluis = require('./kluis');
const mirror = require('./mirror');

/* EEN FABRIEK, EN DAT IS GEEN VORMDWANG. `getUserById` woont in users.js, en
   users.js laadt deze module in -- rechtstreeks teruggrijpen maakt daar een
   kring van, en Node geeft dan een half gevulde module terug in plaats van een
   fout. Die vorm is stil, en stil is precies wat hier niet mag. */
module.exports = ({ getUserById, getMemberState, saveMemberState }) => {

  // Alleen de HMAC van de publieke alias staat in de zoekkolom.
  function findByPublicMail(adres) {
    const a = String(adres || '').trim().toLowerCase();
    if (!a) return null;
    return S.zin('SELECT * FROM users WHERE public_mail_hash = ?').get(kluis.emailHash(a)) || null;
  }

  function reservePublicMail(userId, lokaal, domein) {
    const u = getUserById(userId);
    const d = String(domein || '').trim().toLowerCase();
    let basis = String(lokaal || '').trim().toLowerCase().slice(0, 48);
    if (!u || !basis || !/^(?:[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?)$/.test(basis) ||
        !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(d)) return null;
    const md=getMemberState(userId) || {};
    if (/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(String(md.publiekeMailLokaal || '')))
      basis=String(md.publiekeMailLokaal).slice(0,48);
    let kandidaat=basis + '@' + d, n=2;
    while (n < 10000) {
      const ander=findByPublicMail(kandidaat);
      if (!ander || Number(ander.id) === Number(userId)) {
        try {
          S.zin('UPDATE users SET public_mail_hash = ? WHERE id = ?').run(kluis.emailHash(kandidaat), userId);
          const gekozen=kandidaat.slice(0,kandidaat.indexOf('@'));
          if (md.publiekeMailLokaal !== gekozen) {
            md.publiekeMailLokaal=gekozen;
            saveMemberState(userId,md);
          } else mirror.markUser(userId);
          return kandidaat;
        } catch (e) {
          if (!/unique|constraint/i.test(String(e && e.message))) throw e;
        }
      }
      kandidaat=basis.slice(0, 43) + '-' + n++ + '@' + d;
    }
    return null;
  }

  return { findByPublicMail, reservePublicMail };
};
