/* EERST HET SPOOR, DAN DE TOEGANG (Fase 0, D16).

   ./machtiging.js sloeg de machtiging op voordat het inzagejournaal iets
   schreef, en een mislukte regel verdween in een lege catch: toegang zonder
   spoor. Dit legt de regel duurzaam vast met noteerVast() VOORDAT de machtiging
   ontstaat. Kan dat niet -- geen journaal, geen vastlegger, een fout -- dan is
   de uitslag `ok: false` en opent de aanroeper niets. Dezelfde regel als de
   ledenbalie (kern/ledenbalie-inzage.js, besluit 5): geen aantoonbaar journaal,
   geen inzage. */
'use strict';

async function legSpoorVast(inzagelog, regel) {
  if (!inzagelog || typeof inzagelog.noteerVast !== 'function') return { ok: false, status: 503, reden: 'geen-journaal' };
  try {
    const uit = await inzagelog.noteerVast(regel);
    return uit && uit.ok ? uit : Object.assign({ status: 503 }, uit || {}, { ok: false });
  } catch (e) {
    return { ok: false, status: 503, reden: 'journaal-fout' };
  }
}

module.exports = { legSpoorVast };
