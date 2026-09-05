/* Readiness van de geldmotor, los van kale proces-liveness. Dit draait in de
   motorcontainer en leest zijn token uit hetzelfde Docker-secret. Een 200 op
   /api/leeft is hier bewust onvoldoende: beide grootboeken, integerconservatie
   en de duurzame snapshotstatus moeten aantoonbaar groen zijn. */
'use strict';

const { bouwOmgeving } = require('./docker/start');
const { motorProef } = require('./lib/motor-proef');

(async () => {
  try {
    const env = bouwOmgeving({ ...process.env });
    env.RTG_RUST_ALLES_UIT = '0';
    env.RTG_MOTOR_GELD = 'motor';
    env.RTG_MOTOR_GELD_URL = 'http://127.0.0.1:3100';
    const resultaat = await motorProef(env);
    if (!resultaat.ok) throw new Error(resultaat.fout || 'onbekende motorfout');
  } catch (e) {
    console.error('[motor-readiness] ' + String(e.message || e));
    process.exitCode = 1;
  }
})();
