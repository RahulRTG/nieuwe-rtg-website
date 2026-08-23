/* Eén waarheid voor synthetische RTG-data.

   De vier echte werelden kennen geen demo-stand. Voor geautomatiseerde
   toetsen bestaat één expliciete, geïsoleerde omgeving: Magnaat Test. De
   nieuwe vlag is RTG_MAGNAAT_TEST=1. RTG_DEMO=1 blijft uitsluitend binnen
   NODE_ENV=test als tijdelijke compatibiliteit voor oudere toetsen werken;
   op een gewone lokale, staging- of productie-start doet die vlag niets.

   Daardoor kan een vergeten omgevingsvariabele nooit voorbeeldaccounts,
   voorbeeldzaken of fictieve betalingen in de echte versie openen. */
'use strict';

function actief(env) {
  env = env || process.env;
  if (env.NODE_ENV === 'production') return false;
  if (env.RTG_MAGNAAT_TEST === '1') return true;
  return env.NODE_ENV === 'test' && env.RTG_DEMO === '1';
}

function status(env) {
  const test = actief(env);
  return { omgeving: test ? 'magnaat-test' : 'echt', testomgeving: test };
}

module.exports = { actief, status };
