/* RTG PIN gebruikt Redis als gedeelde frauderem zodra enterprise-modus aanstaat.
   Deze keuring woont apart zodat het algemene productiedossier niet opnieuw
   uitgroeit tot een bestand dat verschillende veiligheidsdomeinen mengt. */
'use strict';

function keurPin(env, fouten, waarschuwingen) {
  if (!env.REDIS_URL)
    waarschuwingen.push('REDIS_URL niet gezet: realtime en de gedeelde RTG-PIN-frauderem werken alleen binnen één proces (niet over meerdere instances).');
  if (env.RTG_PIN_ENTERPRISE === '1' && !env.REDIS_URL)
    fouten.push('RTG_PIN_ENTERPRISE=1 vereist REDIS_URL: zonder gedeelde teller kan een aanval PIN-pogingen over meerdere instances verdelen.');
}

module.exports = { keurPin };
