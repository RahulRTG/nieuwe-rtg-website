/* Menselijk in te vullen productievelden. De generator laat ze expres als
   VUL-IN staan. De losse go-live-tool filtert die waarden weg, maar een directe
   serverstart moet ze zelf ook als oningevuld herkennen; anders kan een
   container met een nep-eigenaar of nep-SMTP-adres voorbij de leegtecheck. */
'use strict';

const HANDMATIG = Object.freeze([
  'RTG_OWNER_EMAIL', 'APP_URL', 'DATABASE_URL', 'REDIS_URL', 'SMTP_URL'
]);

function keurInvulplekken(env, fouten) {
  for (const naam of HANDMATIG) {
    if (/VUL-IN/i.test(String(env[naam] || '')))
      fouten.push(naam + ' bevat nog de invulplaceholder VUL-IN. Vul de echte productiewaarde in.');
  }
}

module.exports = { keurInvulplekken, HANDMATIG };
