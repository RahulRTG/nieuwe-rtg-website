/* DE DEKKINGSVANG: wat een toetsserver uitvoerde, telt mee in de dekking.

   stop() in test/helper.js doodt de toetsserver met SIGKILL, en een proces dat
   zo stopt schrijft zijn V8-dekking (NODE_V8_COVERAGE) nooit weg. Alles wat een
   server in een toets uitvoerde, telde daardoor nergens mee in de dekkingsvloer.

   ALLEEN IN DEKKINGSMODUS, dat wil zeggen: als NODE_V8_COVERAGE gezet is. Dat
   is de natuurkundige voorwaarde -- zonder die variabele heeft takeCoverage()
   geen map om in te schrijven -- en het is precies wat scripts/test-runner.js
   (--dekking) en `node --test --experimental-test-coverage` aan hun kinderen
   meegeven. Zonder: plan() geeft null, de server krijgt geen --require en geen
   luisteraar, en stop() is wat hij was: SIGKILL, verder niets.

   WAAROM EEN SYNCHRONE, BEGRENSDE WACHT IN stop(). stop() wordt ruim duizend
   keer zonder await aangeroepen, ook in after()-haken die direct daarna
   eindigen. Een asynchrone stop zou al die aanroepen stil veranderen in "doe
   het straks misschien". De andere vorm -- takeCoverage na elk verzoek, met
   debounce -- had geen wachten nodig, maar zet een timer en werk in ELK verzoek
   van de server en mist wat na het laatste verzoek gebeurt. Dus: signaal, en
   dan met Atomics.wait in stappen van 5 ms kijken of het bevestigingsbestand er
   is, ten hoogste GRENS_MS. Atomics.wait is een echte slaap zonder bezig
   wachten; de gebeurtenislus van de toets staat zolang stil, en dat is de prijs
   (alleen in dekkingsmodus). Komt de bevestiging niet, dan volgt de SIGKILL
   toch: een hangende server houdt de suite niet langer op dan de grens.

   Getoetst in test/dekkingsvang.test.js. */
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const KIND = path.join(__dirname, 'dekkingsvang-kind.js');
const GRENS_MS = 5000;
const open = new WeakMap();

function actief(env) { return !!(env || process.env).NODE_V8_COVERAGE; }

/* Wat startServer extra meegeeft aan het kind, of null buiten dekkingsmodus. */
function plan(env) {
  if (!actief(env)) return null;
  const bevestig = path.join(os.tmpdir(), 'rtg-dekkingsvang-' + process.pid + '-' +
    crypto.randomBytes(6).toString('hex') + '.ok');
  return { args: ['--require', KIND], env: { RTG_DEKKINGSVANG: bevestig }, bevestig };
}

function onthoud(kind, p) { if (kind && p) open.set(kind, p.bevestig); }

/* Laat het kind zijn dekking wegschrijven en wacht begrensd op de bevestiging.
   Geeft true als die er is, false als de grens verliep, null als er voor dit
   kind niets te vangen viel (geen dekkingsmodus, al weg, al gestopt). */
function vang(kind, grensMs) {
  const pad = open.get(kind);
  if (!pad) return null;
  open.delete(kind);
  if (kind.killed || kind.exitCode != null || kind.signalCode != null) return null;
  try { if (!kind.kill('SIGUSR2')) return null; } catch (e) { return null; }
  const tot = Date.now() + (grensMs || GRENS_MS);
  const slaap = new Int32Array(new SharedArrayBuffer(4));
  while (!fs.existsSync(pad) && Date.now() < tot) Atomics.wait(slaap, 0, 0, 5);
  const ok = fs.existsSync(pad);
  try { fs.rmSync(pad, { force: true }); } catch (e) { /* al weg */ }
  return ok;
}

module.exports = { actief, plan, onthoud, vang, GRENS_MS, KIND };
