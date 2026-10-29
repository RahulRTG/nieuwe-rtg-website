/* Zonder Redis is de bestaande PostgreSQL-outbox de duurzame bron voor
   intrekkingen. Een ontbrekende of mislukte lezing is geen toestemming. */
'use strict';

module.exports = async ({ outbox, token, sid, vingerVanToken, goedeSid, lever }) => {
  if (!outbox || typeof outbox.gedeeld !== 'function')
    throw Object.assign(new Error('De gedeelde intrekkingsbron ontbreekt.'), { code: 'INTREKOPSLAG_ONZEKER' });
  const sleutels = ['token:' + vingerVanToken(token)];
  if (goedeSid(sid)) sleutels.push('sessie:' + sid);
  for (const rij of await outbox.gedeeld(sleutels))
    lever({ versie: 1, soort: rij.soort, waarde: rij.waarde, verloopt: rij.verloopt });
};
